import { Hono } from "hono";
import { and, asc, eq, gte, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { dbClient } from "../../db/dbClient";
import {
    activity,
    activitySignup,
    careTask,
    citizenFacilities,
    employee,
    facillity,
    user,
} from "../../db/schemas";
import {
    requireSession,
    type SessionVariables,
} from "../../middleware/require-session";
import { AppointmentModel } from "../../models/appointment";
import {
    joinWindowState,
    screenVisitListCutoff,
    settleEndedScreenVisitsAsync,
} from "../../utils/helpers/screenVisitHelper";
import { ActivityModel } from "../../models/activity";

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const citizenRoutes = new Hono<{ Variables: SessionVariables }>();

citizenRoutes.use("*", requireSession);

// Tidspunkter gemmes som UTC i en timestamp-kolonne uden tidszone. Sammenligner
// vi med et JS-Date inde i en rå sql-blok, kender Drizzle ikke typen, og
// driveren sender lokal tid med offset — som Postgres kasserer. Det forskyder
// sammenligningen med tidszonens offset, så grænsen bindes eksplicit som UTC.
function endsAtOrAfter(cutoff: Date) {
    return sql`coalesce(${careTask.scheduledEnd}, ${careTask.scheduledStart}) >= ${cutoff.toISOString()}::timestamp`;
}

citizenRoutes.get("/appointments", async (c) => {
    const citizenUserId = c.get("user").id;
    const now = new Date();

    await settleEndedScreenVisitsAsync(now);

    const tasks = await dbClient
        .select({
            id: careTask.id,
            type: careTask.type,
            title: careTask.title,
            description: careTask.description,
            start: careTask.scheduledStart,
            end: careTask.scheduledEnd,
            facilityName: facillity.name,
            staffName: user.name,
        })
        .from(careTask)
        .leftJoin(facillity, eq(careTask.facilityId, facillity.id))
        .leftJoin(employee, eq(careTask.assignedEmployeeId, employee.id))
        .leftJoin(user, eq(employee.userId, user.id))
        .where(
            and(
                eq(careTask.citizenUserId, citizenUserId),
                inArray(careTask.status, ["planned", "in_progress"]),
                or(
                    and(
                        eq(careTask.type, "call"),
                        endsAtOrAfter(screenVisitListCutoff(now)),
                    ),
                    and(ne(careTask.type, "call"), endsAtOrAfter(now)),
                ),
            ),
        )
        .orderBy(asc(careTask.scheduledStart));

    const signups = await dbClient
        .select({
            id: activity.id,
            title: activity.title,
            start: activity.startsAt,
            end: activity.endsAt,
            locationName: activity.locationName,
            facilityName: facillity.name,
        })
        .from(activitySignup)
        .innerJoin(activity, eq(activitySignup.activityId, activity.id))
        .innerJoin(facillity, eq(activity.organizerFacilityId, facillity.id))
        .where(
            and(
                eq(activitySignup.citizenUserId, citizenUserId),
                eq(activitySignup.status, "registered"),
                eq(activity.status, "published"),
                gte(activity.endsAt, now),
            ),
        );

    const appointments: AppointmentModel[] = [
        ...tasks.map(
            (task): AppointmentModel => ({
                id: task.id,
                type: task.type === "call" ? "screen_visit" : "home_visit",
                title: task.title,
                description: task.description ?? undefined,
                start: task.start.toISOString(),
                end: task.end?.toISOString(),
                location: task.facilityName ?? undefined,
                staffName: task.staffName ?? undefined,
                canJoin:
                    task.type === "call"
                        ? joinWindowState(task.start, task.end, now) === "open"
                        : undefined,
            }),
        ),
        ...signups.map(
            (signup): AppointmentModel => ({
                id: signup.id,
                type: "activity",
                title: signup.title,
                start: signup.start.toISOString(),
                end: signup.end.toISOString(),
                location: signup.locationName ?? signup.facilityName,
            }),
        ),
    ].sort((a, b) => a.start.localeCompare(b.start));

    return c.json(appointments);
});

citizenRoutes.post("/visits", async (c) => {
    const citizenUserId = c.get("user").id;
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
    const citizenUserId = c.get("user").id;
    const rows = await visibleActivities(citizenUserId);

    return c.json(rows.map(toActivityDto));
});

citizenRoutes.post("/activities/:id/signup", async (c) => {
    const citizenUserId = c.get("user").id;
    const activityId = c.req.param("id");

    if (!UUID_PATTERN.test(activityId)) {
        return c.json({ error: "Aktiviteten findes ikke." }, 404);
    }

    const [current] = await visibleActivities(citizenUserId, activityId);

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

    const [updated] = await visibleActivities(citizenUserId, activityId);

    return c.json(toActivityDto(updated ?? current));
});

citizenRoutes.delete("/activities/:id/signup", async (c) => {
    const citizenUserId = c.get("user").id;
    const activityId = c.req.param("id");

    if (!UUID_PATTERN.test(activityId)) {
        return c.json({ error: "Aktiviteten findes ikke." }, 404);
    }

    const [current] = await visibleActivities(citizenUserId, activityId);

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
                inArray(activitySignup.status, ["registered", "waitlisted"]),
            ),
        );

    const [updated] = await visibleActivities(citizenUserId, activityId);

    return c.json(toActivityDto(updated ?? current));
});

async function visibleActivities(citizenUserId: string, activityId?: string) {
    const linkedFacilities = dbClient
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
        );

    return dbClient
        .select({
            id: activity.id,
            title: activity.title,
            start: activity.startsAt,
            end: activity.endsAt,
            capacity: activity.capacity,
            locationName: activity.locationName,
            facilityName: facillity.name,
            registeredCount: sql<number>`(
                select count(*) from ${activitySignup}
                where ${activitySignup.activityId} = ${activity.id}
                  and ${activitySignup.status} = 'registered'
            )`.mapWith(Number),
            isSignedUp: sql<boolean>`exists (
                select 1 from ${activitySignup}
                where ${activitySignup.activityId} = ${activity.id}
                  and ${activitySignup.citizenUserId} = ${citizenUserId}
                  and ${activitySignup.status} = 'registered'
            )`,
        })
        .from(activity)
        .innerJoin(facillity, eq(activity.organizerFacilityId, facillity.id))
        .where(
            and(
                inArray(activity.organizerFacilityId, linkedFacilities),
                eq(activity.status, "published"),
                gte(activity.endsAt, new Date()),
                activityId ? eq(activity.id, activityId) : undefined,
            ),
        )
        .orderBy(asc(activity.startsAt));
}

type VisibleActivity = Awaited<ReturnType<typeof visibleActivities>>[number];

function toActivityDto(row: VisibleActivity): ActivityModel {
    return {
        id: row.id,
        title: row.title,
        start: row.start.toISOString(),
        end: row.end.toISOString(),
        location: row.locationName ?? row.facilityName,
        availableSpots:
            row.capacity === null
                ? undefined
                : Math.max(0, row.capacity - row.registeredCount),
        isSignedUp: row.isSignedUp,
    };
}

export default citizenRoutes;
