import { Hono } from "hono";
import { randomBytes } from "crypto";
import { and, desc, eq, gte } from "drizzle-orm";
import { dbClient } from "../../db/dbClient";
import { activitySignup, citizenInviteCode, relativeCitizen, user } from "../../db/schemas";
import {
    requireSession,
    type SessionVariables,
} from "../../middleware/require-session";
import { LinkedRelativeModel, InviteCodeModel } from "../../models/relative";
import {
    getAppointmentsForCitizenAsync,
    toActivityDto,
    visibleActivitiesForCitizenAsync,
} from "../../utils/helpers/citizenDataHelper";

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid confusion
const INVITE_CODE_LENGTH = 6;
const INVITE_CODE_VALID_DAYS = 7;

const citizenRoutes = new Hono<{ Variables: SessionVariables }>();

citizenRoutes.use("*", requireSession);

citizenRoutes.get("/appointments", async (c) => {
    const citizenUserId = c.get("user").id;
    const appointments = await getAppointmentsForCitizenAsync(citizenUserId);

    return c.json(appointments);
});

citizenRoutes.get("/activities", async (c) => {
    const citizenUserId = c.get("user").id;
    const rows = await visibleActivitiesForCitizenAsync(citizenUserId);

    return c.json(rows.map(toActivityDto));
});

citizenRoutes.post("/activities/:id/signup", async (c) => {
    const citizenUserId = c.get("user").id;
    const activityId = c.req.param("id");

    if (!UUID_PATTERN.test(activityId)) {
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

    if (current.capacity !== null && current.registeredCount >= current.capacity) {
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
    const citizenUserId = c.get("user").id;
    const activityId = c.req.param("id");

    if (!UUID_PATTERN.test(activityId)) {
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
    const citizenUserId = c.get("user").id;

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
    const citizenUserId = c.get("user").id;
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
        return c.json({ error: "The request does not exist." }, 404);
    }

    return c.json({ status: "approved" });
});

citizenRoutes.delete("/relatives/:relativeUserId", async (c) => {
    const citizenUserId = c.get("user").id;
    const relativeUserId = c.req.param("relativeUserId");

    await dbClient
        .delete(relativeCitizen)
        .where(
            and(
                eq(relativeCitizen.citizenUserId, citizenUserId),
                eq(relativeCitizen.relativeUserId, relativeUserId),
            ),
        );

    return c.json({ status: "removed" });
});

citizenRoutes.get("/invite-code", async (c) => {
    const citizenUserId = c.get("user").id;

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
    const citizenUserId = c.get("user").id;

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
