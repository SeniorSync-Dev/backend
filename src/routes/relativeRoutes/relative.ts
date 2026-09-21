import { Hono } from "hono";
import { and, desc, eq, gte, isNull, or, sql } from "drizzle-orm";
import { dbClient } from "../../db/dbClient";
import {
    activitySignup,
    citizen,
    citizenFacilities,
    citizenInviteCode,
    facillity,
    relative,
    relativeCitizen,
    user,
} from "../../db/schemas";
import {
    requireSession,
    type SessionVariables,
} from "../../middleware/require-session";
import { getApprovedRelativeLinkAsync } from "../../utils/helpers/relativeAccessHelper";
import {
    getAppointmentsForCitizenAsync,
    toActivityDto,
    visibleActivitiesForCitizenAsync,
} from "../../utils/helpers/citizenDataHelper";
import { LinkedCitizenModel } from "../../models/relative";

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const relativeRoutes = new Hono<{ Variables: SessionVariables }>();

relativeRoutes.use("*", requireSession);

relativeRoutes.get("/citizens", async (c) => {
    const relativeUserId = c.get("user").id;

    const links = await dbClient
        .select({
            citizenUserId: relativeCitizen.citizenUserId,
            relationshipType: relativeCitizen.relationshipType,
            status: relativeCitizen.status,
            canView: relativeCitizen.canView,
            name: user.name,
            dateOfBirth: citizen.dateOfBirth,
        })
        .from(relativeCitizen)
        .innerJoin(citizen, eq(relativeCitizen.citizenUserId, citizen.userId))
        .innerJoin(user, eq(citizen.userId, user.id))
        .where(eq(relativeCitizen.relativeUserId, relativeUserId))
        .orderBy(desc(relativeCitizen.createdAt));

    const citizens: LinkedCitizenModel[] = await Promise.all(
        links.map(async (link): Promise<LinkedCitizenModel> => {
            const [facility] = await dbClient
                .select({ name: facillity.name })
                .from(citizenFacilities)
                .innerJoin(facillity, eq(citizenFacilities.facilityId, facillity.id))
                .where(
                    and(
                        eq(citizenFacilities.citizenUserId, link.citizenUserId),
                        or(
                            isNull(citizenFacilities.endDate),
                            gte(citizenFacilities.endDate, sql`current_date`),
                        ),
                    ),
                )
                .orderBy(desc(citizenFacilities.isPrimary))
                .limit(1);

            const [nextAppointment] = link.canView
                ? await getAppointmentsForCitizenAsync(link.citizenUserId)
                : [];

            return {
                citizenUserId: link.citizenUserId,
                name: link.name,
                relationshipType: link.relationshipType,
                status: link.status,
                age: ageFromDateOfBirth(link.dateOfBirth),
                facilityName: facility?.name,
                nextAppointmentTitle: nextAppointment?.title,
                nextAppointmentStart: nextAppointment?.start,
            };
        }),
    );

    return c.json(citizens);
});

relativeRoutes.get("/citizens/:citizenId/appointments", async (c) => {
    const relativeUserId = c.get("user").id;
    const citizenId = c.req.param("citizenId");

    const link = await getApprovedRelativeLinkAsync(relativeUserId, citizenId, "canView");
    if (!link) return c.json({ error: "You do not have access to this citizen." }, 403);

    const appointments = await getAppointmentsForCitizenAsync(citizenId);
    return c.json(appointments);
});

relativeRoutes.get("/citizens/:citizenId/activities", async (c) => {
    const relativeUserId = c.get("user").id;
    const citizenId = c.req.param("citizenId");

    const link = await getApprovedRelativeLinkAsync(relativeUserId, citizenId, "canView");
    if (!link) return c.json({ error: "You do not have access to this citizen." }, 403);

    const rows = await visibleActivitiesForCitizenAsync(citizenId);
    return c.json(rows.map(toActivityDto));
});

relativeRoutes.post("/citizens/:citizenId/activities/:activityId/signup", async (c) => {
    const relativeUserId = c.get("user").id;
    const citizenId = c.req.param("citizenId");
    const activityId = c.req.param("activityId");

    const link = await getApprovedRelativeLinkAsync(relativeUserId, citizenId, "canBookActivities");
    if (!link) return c.json({ error: "You do not have access to sign up this citizen." }, 403);

    if (!UUID_PATTERN.test(activityId)) {
        return c.json({ error: "The activity does not exist." }, 404);
    }

    const [current] = await visibleActivitiesForCitizenAsync(citizenId, activityId);
    if (!current) return c.json({ error: "The activity does not exist." }, 404);

    if (current.isSignedUp) {
        return c.json(toActivityDto(current));
    }

    if (current.capacity !== null && current.registeredCount >= current.capacity) {
        return c.json({ error: "There are no spots left." }, 409);
    }

    const [existing] = await dbClient
        .select({ id: activitySignup.id })
        .from(activitySignup)
        .where(
            and(
                eq(activitySignup.activityId, activityId),
                eq(activitySignup.citizenUserId, citizenId),
            ),
        )
        .limit(1);

    if (existing) {
        await dbClient
            .update(activitySignup)
            .set({ status: "registered", bookedByUserId: relativeUserId })
            .where(eq(activitySignup.id, existing.id));
    } else {
        await dbClient.insert(activitySignup).values({
            activityId,
            citizenUserId: citizenId,
            bookedByUserId: relativeUserId,
            status: "registered",
        });
    }

    const [updated] = await visibleActivitiesForCitizenAsync(citizenId, activityId);
    return c.json(toActivityDto(updated ?? current));
});

relativeRoutes.delete("/citizens/:citizenId/activities/:activityId/signup", async (c) => {
    const relativeUserId = c.get("user").id;
    const citizenId = c.req.param("citizenId");
    const activityId = c.req.param("activityId");

    const link = await getApprovedRelativeLinkAsync(relativeUserId, citizenId, "canBookActivities");
    if (!link) return c.json({ error: "You do not have access to cancel for this citizen." }, 403);

    if (!UUID_PATTERN.test(activityId)) {
        return c.json({ error: "The activity does not exist." }, 404);
    }

    const [current] = await visibleActivitiesForCitizenAsync(citizenId, activityId);
    if (!current) return c.json({ error: "The activity does not exist." }, 404);

    await dbClient
        .update(activitySignup)
        .set({ status: "cancelled" })
        .where(
            and(
                eq(activitySignup.activityId, activityId),
                eq(activitySignup.citizenUserId, citizenId),
            ),
        );

    const [updated] = await visibleActivitiesForCitizenAsync(citizenId, activityId);
    return c.json(toActivityDto(updated ?? current));
});

relativeRoutes.get("/invitations/:code", async (c) => {
    const code = c.req.param("code").toUpperCase();

    const [invite] = await dbClient
        .select({ citizenUserId: citizenInviteCode.citizenUserId })
        .from(citizenInviteCode)
        .where(
            and(
                eq(citizenInviteCode.code, code),
                gte(citizenInviteCode.expiresAt, new Date()),
            ),
        )
        .limit(1);

    if (!invite) {
        return c.json({ error: "The code is invalid or has expired." }, 404);
    }

    const [citizenRow] = await dbClient
        .select({ name: user.name, dateOfBirth: citizen.dateOfBirth })
        .from(citizen)
        .innerJoin(user, eq(citizen.userId, user.id))
        .where(eq(citizen.userId, invite.citizenUserId))
        .limit(1);

    const [facility] = await dbClient
        .select({ name: facillity.name })
        .from(citizenFacilities)
        .innerJoin(facillity, eq(citizenFacilities.facilityId, facillity.id))
        .where(
            and(
                eq(citizenFacilities.citizenUserId, invite.citizenUserId),
                or(
                    isNull(citizenFacilities.endDate),
                    gte(citizenFacilities.endDate, sql`current_date`),
                ),
            ),
        )
        .orderBy(desc(citizenFacilities.isPrimary))
        .limit(1);

    return c.json({
        name: citizenRow?.name,
        age: ageFromDateOfBirth(citizenRow?.dateOfBirth ?? null),
        facilityName: facility?.name,
    });
});

relativeRoutes.post("/invitations/redeem", async (c) => {
    const relativeUserId = c.get("user").id;
    const { code, relationshipType } = await c.req.json();

    if (!code || !relationshipType) {
        return c.json({ error: "Code and relationship are required." }, 400);
    }

    const [invite] = await dbClient
        .select()
        .from(citizenInviteCode)
        .where(
            and(
                eq(citizenInviteCode.code, String(code).toUpperCase()),
                gte(citizenInviteCode.expiresAt, new Date()),
            ),
        )
        .limit(1);

    if (!invite) {
        return c.json({ error: "The code is invalid or has expired." }, 404);
    }

    const [existing] = await dbClient
        .select({ status: relativeCitizen.status })
        .from(relativeCitizen)
        .where(
            and(
                eq(relativeCitizen.relativeUserId, relativeUserId),
                eq(relativeCitizen.citizenUserId, invite.citizenUserId),
            ),
        )
        .limit(1);

    if (existing) {
        return c.json({ error: "You already have a request for this citizen." }, 409);
    }

    // No relative row exists yet for a user until they link their first citizen.
    await dbClient.insert(relative).values({ userId: relativeUserId }).onConflictDoNothing();

    await dbClient.insert(relativeCitizen).values({
        relativeUserId,
        citizenUserId: invite.citizenUserId,
        relationshipType: String(relationshipType),
    });

    return c.json({ status: "pending" }, 201);
});

function ageFromDateOfBirth(dateOfBirth: string | null) {
    if (!dateOfBirth) return undefined;

    const birth = new Date(dateOfBirth);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const hasHadBirthdayThisYear =
        now.getMonth() > birth.getMonth() ||
        (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate());
    if (!hasHadBirthdayThisYear) age--;

    return age;
}

export default relativeRoutes;
