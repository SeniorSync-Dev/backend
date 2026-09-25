import { Hono } from "hono";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { dbClient } from "../../db/dbClient";
import {
    employee,
    member,
    sensorDevice,
    sensorEvent,
    user,
} from "../../db/schemas";
import {
    requireSession,
    type SessionVariables,
} from "../../middleware/require-session";
import { hasPermission } from "../../utils/helpers/permissionHelper";
import { getClient } from "../../utils/mqttService";

const sensorEventRoutes = new Hono<{ Variables: SessionVariables }>();

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

sensorEventRoutes.use("*", requireSession);

sensorEventRoutes.get("/", async (c) => {
    const organizationId = c.get("session").activeOrganizationId;
    if (!organizationId) {
        return c.json({ message: "No active organization" }, 400);
    }

    if (await hasPermission(c.req.raw.headers, "sensor", "read") === false) {
        return c.json(
            { message: "You do not have permission to read sensor events." },
            403,
        );
    }

    const status = c.req.query("status") ?? "all";
    const severity = c.req.query("severity") ?? "all";
    const validStatuses = [
        "new",
        "acknowledged",
        "in_progress",
        "resolved",
        "false_alarm",
        "dismissed",
    ] as const;
    const validSeverities = ["info", "warning", "critical", "emergency"] as const;

    if (status !== "all" && !validStatuses.includes(status as (typeof validStatuses)[number])) {
        return c.json(
            { message: "status must be one of: all, new, acknowledged, in_progress, resolved, false_alarm, dismissed" },
            400,
        );
    }

    if (severity !== "all" && !validSeverities.includes(severity as (typeof validSeverities)[number])) {
        return c.json(
            { message: "severity must be one of: all, info, warning, critical, emergency" },
            400,
        );
    }

    const page = parsePositiveInteger(c.req.query("page"), 1);
    const pageSize = parsePositiveInteger(
        c.req.query("pageSize"),
        DEFAULT_PAGE_SIZE,
        MAX_PAGE_SIZE,
    );

    const citizensInOrganization = dbClient
        .select({ userId: member.userId })
        .from(member)
        .where(eq(member.organizationId, organizationId));
    const filters = and(
        inArray(sensorEvent.citizenUserId, citizensInOrganization),
        status === "all"
            ? undefined
            : eq(sensorEvent.status, status as (typeof validStatuses)[number]),
        severity === "all"
            ? undefined
            : eq(
                  sensorEvent.severity,
                  severity as (typeof validSeverities)[number],
              ),
    );

    const [sensorEvents, [total]] = await Promise.all([
        dbClient
            .select({
                id: sensorEvent.id,
                citizenUserId: sensorEvent.citizenUserId,
                citizenName: user.name,
                deviceId: sensorEvent.deviceId,
                deviceSerialNumber: sensorDevice.serialNumber,
                deviceType: sensorDevice.type,
                eventType: sensorEvent.eventType,
                severity: sensorEvent.severity,
                status: sensorEvent.status,
                occurredAt: sensorEvent.occurredAt,
                payload: sensorEvent.payload,
                acknowledgedAt: sensorEvent.acknowledgedAt,
                acknowledgedByEmployeeId: sensorEvent.acknowledgedByEmployeeId,
                acknowledgedByEmployeeName: sensorEvent.acknowledgedByEmployeeName,
                resolvedAt: sensorEvent.resolvedAt,
                resolvedByEmployeeId: sensorEvent.resolvedByEmployeeId,
                resolvedByEmployeeName: sensorEvent.resolvedByEmployeeName,
                resolutionNotes: sensorEvent.resolutionNotes,
                createdAt: sensorEvent.createdAt,
            })
            .from(sensorEvent)
            .innerJoin(sensorDevice, eq(sensorEvent.deviceId, sensorDevice.id))
            .innerJoin(user, eq(sensorEvent.citizenUserId, user.id))
            .where(filters)
            .orderBy(desc(sensorEvent.occurredAt))
            .limit(pageSize)
            .offset((page - 1) * pageSize),
        dbClient.select({ value: count() }).from(sensorEvent).where(filters),
    ]);

    const totalItems = Number(total.value);

    return c.json({
        sensorEvents,
        pagination: {
            page,
            pageSize,
            totalItems,
            totalPages: Math.ceil(totalItems / pageSize),
        },
    });
});

sensorEventRoutes.patch("/:id/acknowledge", async (c) => {
    const organizationId = c.get("session").activeOrganizationId;
    if (!organizationId) {
        return c.json({ message: "No active organization" }, 400);
    }

    if (await hasPermission(c.req.raw.headers, "sensor", "update") === false) {
        return c.json(
            { message: "You do not have permission to acknowledge sensor events." },
            403,
        );
    }

    const employeeId = await getCurrentEmployeeId(c.get("user").id);
    const employeeName = await getCurrentEmployeeName(c.get("user").id);

    if (!employeeId || !employeeName) {
        return c.json({ message: "Current user is not an employee" }, 400);
    }

    const [updatedEvent] = await dbClient
        .update(sensorEvent)
        .set({
            status: "acknowledged",
            acknowledgedAt: new Date(),
            acknowledgedByEmployeeId: employeeId,
            acknowledgedByEmployeeName: employeeName,
        })
        .where(
            and(
                eq(sensorEvent.id, c.req.param("id")),
                eq(sensorEvent.status, "new"),
                inArray(sensorEvent.citizenUserId, citizensInOrganization(organizationId)),
            ),
        )
        .returning();

    if (!updatedEvent) {
        return c.json(
            { message: "Sensor event not found or cannot be acknowledged" },
            404,
        );
    }

    return c.json(updatedEvent);
});

sensorEventRoutes.patch("/:id/resolve", async (c) => {
    const organizationId = c.get("session").activeOrganizationId;
    if (!organizationId) {
        return c.json({ message: "No active organization" }, 400);
    }

    if (await hasPermission(c.req.raw.headers, "sensor", "update") === false) {
        return c.json(
            { message: "You do not have permission to resolve sensor events." },
            403,
        );
    }

    const employeeId = await getCurrentEmployeeId(c.get("user").id);
    const employeeName = await getCurrentEmployeeName(c.get("user").id);

    if (!employeeId || !employeeName) {
        return c.json({ message: "Current user is not an employee" }, 400);
    }

    const body: { resolutionNotes?: unknown } = await c.req
        .json<{ resolutionNotes?: unknown }>()
        .catch(() => ({}));
    if (
        body.resolutionNotes !== undefined &&
        typeof body.resolutionNotes !== "string"
    ) {
        return c.json({ message: "resolutionNotes must be a string" }, 400);
    }

    const [updatedEvent] = await dbClient
        .update(sensorEvent)
        .set({
            status: "resolved",
            resolvedAt: new Date(),
            resolvedByEmployeeName: employeeName,
            resolvedByEmployeeId: employeeId,
            ...(body.resolutionNotes !== undefined && {
                resolutionNotes: body.resolutionNotes,
            }),
        })
        .where(
            and(
                eq(sensorEvent.id, c.req.param("id")),
                inArray(sensorEvent.status, ["new", "acknowledged", "in_progress"]),
                inArray(sensorEvent.citizenUserId, citizensInOrganization(organizationId)),
            ),
        )
        .returning();

    if (!updatedEvent) {
        return c.json(
            { message: "Sensor event not found or cannot be resolved" },
            404,
        );
    }

    const mqttClient = getClient();
    const device = await dbClient
        .select({ serialNumber: sensorDevice.serialNumber })
        .from(sensorDevice)
        .where(eq(sensorDevice.id, updatedEvent.deviceId))
        .limit(1)
        .then((rows) => rows[0]);

    if (mqttClient && device)
    {
        mqttClient.publish(`seniorsync/fallsensor/reset/${device.serialNumber}`, "RESOLVED", { qos: 2, retain: false });
    }

    return c.json(updatedEvent);
});

function citizensInOrganization(organizationId: string) {
    return dbClient
        .select({ userId: member.userId })
        .from(member)
        .where(eq(member.organizationId, organizationId));
}

async function getCurrentEmployeeId(userId: string): Promise<string | undefined> {
    const [currentEmployee] = await dbClient
        .select({ id: employee.id })
        .from(employee)
        .where(eq(employee.userId, userId))
        .limit(1);

    return currentEmployee?.id;
}

async function getCurrentEmployeeName(userId: string): Promise<string | undefined> {
    const [currentEmployee] = await dbClient
        .select({ name: user.name })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

    return currentEmployee?.name;
}

function parsePositiveInteger(
    value: string | undefined,
    fallback: number,
    max = Number.MAX_SAFE_INTEGER,
): number {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) return fallback;

    return Math.min(parsed, max);
}

export default sensorEventRoutes;
