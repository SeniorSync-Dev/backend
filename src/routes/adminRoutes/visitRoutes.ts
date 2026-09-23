import { Hono } from "hono";
import { alias } from "drizzle-orm/pg-core";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { dbClient } from "../../db/dbClient";
import {
    careTask,
    citizen,
    citizenFacilities,
    employee,
    facillity,
    member,
    user,
} from "../../db/schemas";
import { auth } from "../../utils/auth";
import { ensureEmployeeRecordAsync } from "../../utils/helpers/employeeHelper";

const visitRoutes = new Hono();

const employeeUser = alias(user, "employee_user");

async function getOrganizationFacilityIds(organizationId: string) {
    const facilities = await dbClient
        .select({ id: facillity.id })
        .from(facillity)
        .where(eq(facillity.organizationId, organizationId));
    return facilities.map((f) => f.id);
}

visitRoutes.get("/", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    const organizationId = session?.session.activeOrganizationId;
    if (!organizationId)
        return c.json({ message: "No active organization" }, 400);

    const facilityIds = await getOrganizationFacilityIds(organizationId);
    if (facilityIds.length === 0) return c.json([]);

    const visits = await dbClient
        .select({
            id: careTask.id,
            type: careTask.type,
            title: careTask.title,
            description: careTask.description,
            scheduledStart: careTask.scheduledStart,
            scheduledEnd: careTask.scheduledEnd,
            status: careTask.status,
            citizenUserId: careTask.citizenUserId,
            citizenName: user.name,
            assignedEmployeeId: careTask.assignedEmployeeId,
            employeeName: employeeUser.name,
        })
        .from(careTask)
        .innerJoin(citizen, eq(careTask.citizenUserId, citizen.userId))
        .innerJoin(user, eq(citizen.userId, user.id))
        .leftJoin(employee, eq(careTask.assignedEmployeeId, employee.id))
        .leftJoin(employeeUser, eq(employee.userId, employeeUser.id))
        .where(
            and(
                inArray(careTask.type, ["visit", "call"]),
                inArray(careTask.facilityId, facilityIds),
            ),
        )
        .orderBy(asc(careTask.scheduledStart));

    return c.json(visits);
});

visitRoutes.get("/options", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    const organizationId = session?.session.activeOrganizationId;
    if (!organizationId)
        return c.json({ message: "No active organization" }, 400);

    const facilityIds = await getOrganizationFacilityIds(organizationId);

    const citizens =
        facilityIds.length === 0
            ? []
            : await dbClient
                  .selectDistinct({ userId: citizen.userId, name: user.name })
                  .from(citizenFacilities)
                  .innerJoin(
                      citizen,
                      eq(citizenFacilities.citizenUserId, citizen.userId),
                  )
                  .innerJoin(user, eq(citizen.userId, user.id))
                  .where(inArray(citizenFacilities.facilityId, facilityIds))
                  .orderBy(asc(user.name));

    const employeeMembers = await dbClient
        .select({ userId: member.userId, name: user.name })
        .from(member)
        .innerJoin(user, eq(member.userId, user.id))
        .where(
            and(
                eq(member.organizationId, organizationId),
                eq(member.role, "employee"),
            ),
        );

    const employees = await Promise.all(
        employeeMembers.map(async (m) => ({
            id: await ensureEmployeeRecordAsync(m.userId),
            name: m.name,
        })),
    );

    return c.json({ citizens, employees });
});

visitRoutes.post("/", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json({ message: "Unauthorized" }, 401);

    const organizationId = session.session.activeOrganizationId;
    if (!organizationId)
        return c.json({ message: "No active organization" }, 400);

    const body = await c.req.json();
    const {
        citizenUserId,
        assignedEmployeeId,
        title,
        description,
        scheduledStart,
        scheduledEnd,
        type,
    } = body;

    // Kun fysiske besøg og skærmbesøg planlægges herfra. De øvrige care
    // task-typer (medicin, hygiejne, …) hører til andre arbejdsgange.
    const taskType = type === "call" ? "call" : "visit";
    if (!citizenUserId || !scheduledStart) {
        return c.json(
            { message: "citizenUserId og scheduledStart er påkrævet" },
            400,
        );
    }

    const facilityIds = await getOrganizationFacilityIds(organizationId);
    const [citizenLink] = await dbClient
        .select({ facilityId: citizenFacilities.facilityId })
        .from(citizenFacilities)
        .where(
            and(
                eq(citizenFacilities.citizenUserId, citizenUserId),
                inArray(citizenFacilities.facilityId, facilityIds),
            ),
        )
        .limit(1);
    if (!citizenLink)
        return c.json(
            { message: "Borgeren er ikke tilknyttet organisationen" },
            400,
        );

    if (assignedEmployeeId) {
        const [validEmployee] = await dbClient
            .select({ id: employee.id })
            .from(employee)
            .innerJoin(member, eq(employee.userId, member.userId))
            .where(
                and(
                    eq(employee.id, assignedEmployeeId),
                    eq(member.organizationId, organizationId),
                    eq(member.role, "employee"),
                ),
            )
            .limit(1);
        if (!validEmployee)
            return c.json(
                { message: "Medarbejderen er ikke tilknyttet organisationen" },
                400,
            );
    }

    const [created] = await dbClient
        .insert(careTask)
        .values({
            citizenUserId,
            assignedEmployeeId: assignedEmployeeId || null,
            facilityId: citizenLink.facilityId,
            type: taskType,
            title: title || (taskType === "call" ? "Skærmbesøg" : "Besøg"),
            description: description || null,
            scheduledStart: new Date(scheduledStart),
            scheduledEnd: scheduledEnd ? new Date(scheduledEnd) : null,
            createdByUserId: session.user.id,
        })
        .returning();

    return c.json(created, 201);
});

visitRoutes.post("/:id/assign", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json({ message: "Unauthorized" }, 401);

    const organizationId = session.session.activeOrganizationId;
    if (!organizationId)
        return c.json({ message: "No active organization" }, 400);

    const [member_] = await dbClient
        .select({ role: member.role })
        .from(member)
        .where(
            and(
                eq(member.userId, session.user.id),
                eq(member.organizationId, organizationId),
            ),
        )
        .limit(1);
    if (
        !member_ ||
        (member_.role !== "employee" && member_.role !== "systemAdmin")
    ) {
        return c.json({ message: "Kun medarbejdere kan tildele besøg" }, 403);
    }

    const visitId = c.req.param("id");
    const facilityIds = await getOrganizationFacilityIds(organizationId);
    if (facilityIds.length === 0)
        return c.json({ message: "Besøget findes ikke" }, 404);

    const employeeId = await ensureEmployeeRecordAsync(session.user.id);

    const [updated] = await dbClient
        .update(careTask)
        .set({ assignedEmployeeId: employeeId })
        .where(
            and(
                eq(careTask.id, visitId),
                inArray(careTask.type, ["visit", "call"]),
                inArray(careTask.facilityId, facilityIds),
                isNull(careTask.assignedEmployeeId),
            ),
        )
        .returning();

    if (!updated) {
        return c.json(
            { message: "Besøget findes ikke eller er allerede tildelt" },
            409,
        );
    }

    return c.json(updated);
});

export default visitRoutes;
