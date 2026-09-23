import { and, eq, inArray } from "drizzle-orm";
import { dbClient } from "../../db/dbClient";
import { careTask, employee, relativeCitizen } from "../../db/schemas";

export type ScreenVisitRole = "citizen" | "employee" | "relative";

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
