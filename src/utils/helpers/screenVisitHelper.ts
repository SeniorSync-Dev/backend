import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { dbClient } from "../../db/dbClient";
import { careTask, employee, relativeCitizen } from "../../db/schemas";
import { endMeetingAsync } from "../realtimeKit";

export type ScreenVisitRole = "citizen" | "employee" | "relative";

const OPENS_MINUTES_BEFORE = 15;
const CLOSES_MINUTES_AFTER = 30;
const MINUTE_MS = 60_000;

export type JoinWindowState = "early" | "open" | "over";

export function joinWindowState(
    scheduledStart: Date,
    scheduledEnd: Date | null,
    now = new Date(),
): JoinWindowState {
    const opensAt = scheduledStart.getTime() - OPENS_MINUTES_BEFORE * MINUTE_MS;
    const closesAt =
        (scheduledEnd ?? scheduledStart).getTime() +
        CLOSES_MINUTES_AFTER * MINUTE_MS;

    if (now.getTime() < opensAt) return "early";
    if (now.getTime() > closesAt) return "over";
    return "open";
}

// Hvor langt tilbage et afsluttet skærmbesøg stadig skal med i en liste, så
// knappen ikke når at forsvinde mens vinduet er åbent.
export function screenVisitListCutoff(now = new Date()) {
    return new Date(now.getTime() - CLOSES_MINUTES_AFTER * MINUTE_MS);
}

export async function findJoinableScreenVisitAsync(
    userId: string,
    careTaskId: string,
) {
    const [task] = await dbClient
        .select({
            id: careTask.id,
            title: careTask.title,
            citizenUserId: careTask.citizenUserId,
            assignedEmployeeId: careTask.assignedEmployeeId,
            meetingId: careTask.meetingId,
            scheduledStart: careTask.scheduledStart,
            scheduledEnd: careTask.scheduledEnd,
        })
        .from(careTask)
        .where(
            and(
                eq(careTask.id, careTaskId),
                eq(careTask.type, "call"),
                inArray(careTask.status, ["planned", "in_progress"]),
            ),
        )
        .limit(1);

    if (!task) return null;

    if (task.citizenUserId === userId) {
        return { task, role: "citizen" as ScreenVisitRole };
    }

    if (task.assignedEmployeeId) {
        const [assigned] = await dbClient
            .select({ id: employee.id })
            .from(employee)
            .where(
                and(
                    eq(employee.id, task.assignedEmployeeId),
                    eq(employee.userId, userId),
                ),
            )
            .limit(1);

        if (assigned) return { task, role: "employee" as ScreenVisitRole };
    }

    const [link] = await dbClient
        .select({ relativeUserId: relativeCitizen.relativeUserId })
        .from(relativeCitizen)
        .where(
            and(
                eq(relativeCitizen.relativeUserId, userId),
                eq(relativeCitizen.citizenUserId, task.citizenUserId),
                eq(relativeCitizen.canView, true),
            ),
        )
        .limit(1);

    if (link) return { task, role: "relative" as ScreenVisitRole };

    return null;
}

export async function settleEndedScreenVisitsAsync(now = new Date()) {
    const closed = screenVisitListCutoff(now).toISOString();

    const ended = and(
        eq(careTask.type, "call"),
        inArray(careTask.status, ["planned", "in_progress"]),
        sql`coalesce(${careTask.scheduledEnd}, ${careTask.scheduledStart}) < ${closed}::timestamp`,
    );

    const completed = await dbClient
        .update(careTask)
        .set({
            status: "completed",
            completedAt: sql`coalesce(${careTask.scheduledEnd}, ${careTask.scheduledStart})`,
        })
        .where(and(ended, isNotNull(careTask.meetingId)))
        .returning({ meetingId: careTask.meetingId });

    await dbClient
        .update(careTask)
        .set({ status: "missed" })
        .where(and(ended, isNull(careTask.meetingId)));

    for (const visit of completed) {
        if (!visit.meetingId) continue;

        try {
            await endMeetingAsync(visit.meetingId);
        } catch (cause) {
            console.error(
                `Mødet ${visit.meetingId} kunne ikke lukkes:`,
                cause,
            );
        }
    }
}
