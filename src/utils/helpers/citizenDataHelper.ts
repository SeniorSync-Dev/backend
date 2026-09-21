import { and, asc, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
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
import { AppointmentModel } from "../../models/appointment";
import { ActivityModel } from "../../models/activity";

export async function getAppointmentsForCitizenAsync(citizenUserId: string) {
    const now = new Date();

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
                gte(
                    sql`coalesce(${careTask.scheduledEnd}, ${careTask.scheduledStart})`,
                    now,
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

    return appointments;
}

export async function visibleActivitiesForCitizenAsync(
    citizenUserId: string,
    activityId?: string,
) {
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

type VisibleActivity = Awaited<
    ReturnType<typeof visibleActivitiesForCitizenAsync>
>[number];

export function toActivityDto(row: VisibleActivity): ActivityModel {
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
