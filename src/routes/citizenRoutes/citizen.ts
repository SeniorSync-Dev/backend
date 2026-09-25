import { Hono } from "hono";
import { randomBytes } from "crypto";
import { and, desc, eq, gte, isNull, or, sql } from "drizzle-orm";
import { dbClient } from "../../db/dbClient";
import {
    activitySignup,
    careTask,
    citizenFacilities,
    citizenInviteCode,
    relativeCitizen,
    user,
} from "../../db/schemas";
import { AppointmentModel } from "../../models/appointment";
import { requireSession } from "../../middleware/require-session";
import {
    requireCitizen,
    type CitizenVariables,
} from "../../middleware/require-citizen";
import { LinkedRelativeModel, InviteCodeModel } from "../../models/relative";
import {
    appointmentWindowEnd,
    getAppointmentsForCitizenAsync,
    startOfToday,
    toActivityDto,
    visibleActivitiesForCitizenAsync,
} from "../../utils/helpers/citizenDataHelper";
import { settleEndedScreenVisitsAsync } from "../../utils/helpers/screenVisitHelper";
import { isUuid } from "../../utils/uuid";

const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid confusion
const INVITE_CODE_LENGTH = 6;
const INVITE_CODE_VALID_DAYS = 7;

const citizenRoutes = new Hono<{ Variables: CitizenVariables }>();

citizenRoutes.use("*", requireSession);
citizenRoutes.use("*", requireCitizen);

citizenRoutes.get("/appointments", async (c) => {
    const citizenUserId = c.get("citizenUserId");

    await settleEndedScreenVisitsAsync();

    const appointments = await getAppointmentsForCitizenAsync(citizenUserId, {
        from: startOfToday(),
        to: appointmentWindowEnd(),
    });

    return c.json(appointments);
});

citizenRoutes.post("/visits", async (c) => {
    const citizenUserId = c.get("citizenUserId");
    const body = await c.req.json();
    const { title, description, scheduledStart, scheduledEnd } = body;

    if (!scheduledStart) {
        return c.json({ error: "Starttidspunkt er påkrævet." }, 400);
    }

    const [facilityLink] = await dbClient
        .select({ facilityId: citizenFacilities.facilityId })
        .from(citizenFacilities)
        .where(
            and(
                eq(citizenFacilities.citizenUserId, citizenUserId),
                or(
                    isNull(citizenFacilities.endDate),
                    gte(citizenFacilities.endDate, sql`current_date`),
                ),
            ),
        )
        .orderBy(sql`${citizenFacilities.isPrimary} desc`)
        .limit(1);

    if (!facilityLink) {
        return c.json(
            { error: "Du er ikke tilknyttet et plejehjem endnu." },
            400,
        );
    }

    const [created] = await dbClient
        .insert(careTask)
        .values({
            citizenUserId,
            facilityId: facilityLink.facilityId,
            type: "visit",
            title: title || "Besøg",
            description: description || null,
            scheduledStart: new Date(scheduledStart),
            scheduledEnd: scheduledEnd ? new Date(scheduledEnd) : null,
            createdByUserId: citizenUserId,
        })
        .returning();

    const appointment: AppointmentModel = {
        id: created.id,
        type: "home_visit",
        title: created.title,
        description: created.description ?? undefined,
        start: created.scheduledStart.toISOString(),
        end: created.scheduledEnd?.toISOString(),
    };

    return c.json(appointment, 201);
});

citizenRoutes.get("/activities", async (c) => {
    const citizenUserId = c.get("citizenUserId");
    const rows = await visibleActivitiesForCitizenAsync(citizenUserId);

    return c.json(rows.map(toActivityDto));
});

citizenRoutes.post("/activities/:id/signup", async (c) => {
    const citizenUserId = c.get("citizenUserId");
    const activityId = c.req.param("id");

    if (!isUuid(activityId)) {
        return c.json({ error: "Aktiviteten findes ikke." }, 404);
    }

    const [current] = await visibleActivitiesForCitizenAsync(
        citizenUserId,
        activityId,
    );

    if (!current) {
        return c.json({ error: "Aktiviteten findes ikke." }, 404);
    }

    if (current.isSignedUp) {
        return c.json(toActivityDto(current));
    }

    if (
        current.capacity !== null &&
        current.registeredCount >= current.capacity
    ) {
        return c.json({ error: "Der er ingen ledige pladser." }, 409);
    }

    const [existing] = await dbClient
        .select({ id: activitySignup.id })
        .from(activitySignup)
        .where(
            and(
                eq(activitySignup.activityId, activityId),
                eq(activitySignup.citizenUserId, citizenUserId),
            ),
        )
        .limit(1);

    if (existing) {
        await dbClient
            .update(activitySignup)
            .set({ status: "registered", bookedByUserId: citizenUserId })
            .where(eq(activitySignup.id, existing.id));
    } else {
        await dbClient.insert(activitySignup).values({
            activityId,
            citizenUserId,
            bookedByUserId: citizenUserId,
            status: "registered",
        });
    }

    const [updated] = await visibleActivitiesForCitizenAsync(
        citizenUserId,
        activityId,
    );

    return c.json(toActivityDto(updated ?? current));
});

citizenRoutes.delete("/activities/:id/signup", async (c) => {
    const citizenUserId = c.get("citizenUserId");
    const activityId = c.req.param("id");

    if (!isUuid(activityId)) {
        return c.json({ error: "Aktiviteten findes ikke." }, 404);
    }

    const [current] = await visibleActivitiesForCitizenAsync(
        citizenUserId,
        activityId,
    );

    if (!current) {
        return c.json({ error: "Aktiviteten findes ikke." }, 404);
    }

    await dbClient
        .update(activitySignup)
        .set({ status: "cancelled" })
        .where(
            and(
                eq(activitySignup.activityId, activityId),
                eq(activitySignup.citizenUserId, citizenUserId),
            ),
        );

    const [updated] = await visibleActivitiesForCitizenAsync(
        citizenUserId,
        activityId,
    );

    return c.json(toActivityDto(updated ?? current));
});

citizenRoutes.get("/relatives", async (c) => {
    const citizenUserId = c.get("citizenUserId");

    const rows = await dbClient
        .select({
            relativeUserId: relativeCitizen.relativeUserId,
            relationshipType: relativeCitizen.relationshipType,
            status: relativeCitizen.status,
            name: user.name,
        })
        .from(relativeCitizen)
        .innerJoin(user, eq(relativeCitizen.relativeUserId, user.id))
        .where(eq(relativeCitizen.citizenUserId, citizenUserId))
        .orderBy(desc(relativeCitizen.createdAt));

    const relatives: LinkedRelativeModel[] = rows.map((row) => ({
        relativeUserId: row.relativeUserId,
        name: row.name,
        relationshipType: row.relationshipType,
        status: row.status,
    }));

    return c.json(relatives);
});

citizenRoutes.patch("/relatives/:relativeUserId/approve", async (c) => {
    const citizenUserId = c.get("citizenUserId");
    const relativeUserId = c.req.param("relativeUserId");

    const [updated] = await dbClient
        .update(relativeCitizen)
        .set({ status: "approved", canView: true, canBookActivities: true })
        .where(
            and(
                eq(relativeCitizen.citizenUserId, citizenUserId),
                eq(relativeCitizen.relativeUserId, relativeUserId),
            ),
        )
        .returning();

    if (!updated) {
        return c.json({ error: "Anmodningen findes ikke." }, 404);
    }

    return c.json({ status: "approved" });
});

citizenRoutes.delete("/relatives/:relativeUserId", async (c) => {
    const citizenUserId = c.get("citizenUserId");
    const relativeUserId = c.req.param("relativeUserId");

    const [removed] = await dbClient
        .delete(relativeCitizen)
        .where(
            and(
                eq(relativeCitizen.citizenUserId, citizenUserId),
                eq(relativeCitizen.relativeUserId, relativeUserId),
                eq(relativeCitizen.status, "pending"),
            ),
        )
        .returning();

    if (!removed) {
        return c.json(
            {
                error: "Anmodningen findes ikke, eller den pårørende er allerede godkendt.",
            },
            404,
        );
    }

    return c.json({ status: "removed" });
});

citizenRoutes.get("/invite-code", async (c) => {
    const citizenUserId = c.get("citizenUserId");

    const [current] = await dbClient
        .select({ code: citizenInviteCode.code, expiresAt: citizenInviteCode.expiresAt })
        .from(citizenInviteCode)
        .where(
            and(
                eq(citizenInviteCode.citizenUserId, citizenUserId),
                gte(citizenInviteCode.expiresAt, new Date()),
            ),
        )
        .orderBy(desc(citizenInviteCode.createdAt))
        .limit(1);

    if (!current) {
        return c.json(null);
    }

    const inviteCode: InviteCodeModel = {
        code: current.code,
        expiresAt: current.expiresAt.toISOString(),
    };

    return c.json(inviteCode);
});

citizenRoutes.post("/invite-code", async (c) => {
    const citizenUserId = c.get("citizenUserId");

    await dbClient
        .delete(citizenInviteCode)
        .where(eq(citizenInviteCode.citizenUserId, citizenUserId));

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_CODE_VALID_DAYS);

    const [created] = await dbClient
        .insert(citizenInviteCode)
        .values({
            citizenUserId,
            code: generateInviteCode(),
            expiresAt,
        })
        .returning();

    const inviteCode: InviteCodeModel = {
        code: created.code,
        expiresAt: created.expiresAt.toISOString(),
    };

    return c.json(inviteCode, 201);
});

function generateInviteCode() {
    const bytes = randomBytes(INVITE_CODE_LENGTH);
    let code = "";
    for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
        code += INVITE_CODE_ALPHABET[bytes[i] % INVITE_CODE_ALPHABET.length];
    }
    return code;
}

export default citizenRoutes;
