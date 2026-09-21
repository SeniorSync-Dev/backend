import { Hono } from "hono";
import { and, asc, count, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { dbClient } from "../../db/dbClient";
import { citizen, member, sensorDevice, user } from "../../db/schemas";
import {
    requireSession,
    type SessionVariables,
} from "../../middleware/require-session";
import { hasPermission } from "../../utils/helpers/permissionHelper";

const sensorRoutes = new Hono<{ Variables: SessionVariables }>();

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

sensorRoutes.use("*", requireSession);

sensorRoutes.get("/", async (c) => {
    const organizationId = c.get("session").activeOrganizationId;
    if (!organizationId) {
        return c.json({ message: "No active organization" }, 400);
    }

    const authHeaders = c.req.raw.headers;
    if (await hasPermission(authHeaders, "sensor", "read") === false) {
        return c.json(
            {
                message: "You do not have permission to read sensors.",
            },
            403,
        );
    }

    const assignment = c.req.query("assignment") ?? "all";
    const status = c.req.query("status") ?? "all";
    if (
        assignment !== "all" &&
        assignment !== "assigned" &&
        assignment !== "unassigned"
    ) {
        return c.json(
            {
                message:
                    "assignment must be one of: all, assigned, unassigned",
            },
            400,
        );
    }

    if (status !== "all" && status !== "active" && status !== "offline") {
        return c.json(
            { message: "status must be one of: all, active, offline" },
            400,
        );
    }

    const page = parsePositiveInteger(c.req.query("page"), 1);
    const pageSize = parsePositiveInteger(
        c.req.query("pageSize"),
        DEFAULT_PAGE_SIZE,
        MAX_PAGE_SIZE,
    );

    const assignmentFilter =
        assignment === "assigned"
            ? isNotNull(sensorDevice.citizenUserId)
            : assignment === "unassigned"
              ? isNull(sensorDevice.citizenUserId)
              : undefined;
    const statusFilter =
        status === "all" ? undefined : eq(sensorDevice.status, status);
    const visibleToOrganizationFilter = or(
        isNull(sensorDevice.citizenUserId),
        inArray(
            sensorDevice.citizenUserId,
            dbClient
                .select({ userId: member.userId })
                .from(member)
                .where(eq(member.organizationId, organizationId)),
        ),
    );
    const filters = and(
        assignmentFilter,
        statusFilter,
        visibleToOrganizationFilter,
    );

    const [sensors, [total]] = await Promise.all([
        dbClient
            .select({
                id: sensorDevice.id,
                serialNumber: sensorDevice.serialNumber,
                type: sensorDevice.type,
                model: sensorDevice.model,
                manufacturer: sensorDevice.manufacturer,
                mqttTopic: sensorDevice.mqttTopic,
                status: sensorDevice.status,
                batteryLevel: sensorDevice.batteryLevel,
                lastSeenAt: sensorDevice.lastSeenAt,
                locationDescription: sensorDevice.locationDescription,
                citizenUserId: sensorDevice.citizenUserId,
                citizenName: user.name,
                createdAt: sensorDevice.createdAt,
                updatedAt: sensorDevice.updatedAt,
            })
            .from(sensorDevice)
            .leftJoin(user, eq(sensorDevice.citizenUserId, user.id))
            .where(filters)
            .orderBy(asc(sensorDevice.serialNumber))
            .limit(pageSize)
            .offset((page - 1) * pageSize),
        dbClient
            .select({ value: count() })
            .from(sensorDevice)
            .where(filters),
    ]);

    const totalItems = Number(total.value);

    return c.json({
        sensors,
        pagination: {
            page,
            pageSize,
            totalItems,
            totalPages: Math.ceil(totalItems / pageSize),
        },
    });
});

sensorRoutes.patch("/:id/assignment", async (c) => {
    const organizationId = c.get("session").activeOrganizationId;
    if (!organizationId) {
        return c.json({ message: "No active organization" }, 400);
    }

    if (await hasPermission(c.req.raw.headers, "sensor", "update") === false) {
        return c.json(
            { message: "You do not have permission to assign sensors." },
            403,
        );
    }

    const sensorId = c.req.param("id");

    const body = await c.req.json<{ citizenUserId?: string }>();
    if (typeof body.citizenUserId !== "string" || !body.citizenUserId) {
        return c.json({ message: "citizenUserId is required" }, 400);
    }

    const [citizenInOrganization] = await dbClient
        .select({ userId: citizen.userId })
        .from(citizen)
        .innerJoin(member, eq(member.userId, citizen.userId))
        .where(
            and(
                eq(citizen.userId, body.citizenUserId),
                eq(member.organizationId, organizationId),
            ),
        )
        .limit(1);

    if (!citizenInOrganization) {
        return c.json({ message: "Citizen not found" }, 404);
    }

    const citizensInOrganization = dbClient
        .select({ userId: member.userId })
        .from(member)
        .where(eq(member.organizationId, organizationId));

    const [updatedSensor] = await dbClient
        .update(sensorDevice)
        .set({ citizenUserId: citizenInOrganization.userId })
        .where(
            and(
                eq(sensorDevice.id, sensorId),
                or(
                    isNull(sensorDevice.citizenUserId),
                    inArray(sensorDevice.citizenUserId, citizensInOrganization),
                ),
            ),
        )
        .returning();

    if (!updatedSensor) {
        return c.json({ message: "Sensor not found" }, 404);
    }

    return c.json(updatedSensor);
});

sensorRoutes.patch("/:id/unassignment", async (c) => {
    const organizationId = c.get("session").activeOrganizationId;
    if (!organizationId) {
        return c.json({ message: "No active organization" }, 400);
    }

    if (await hasPermission(c.req.raw.headers, "sensor", "update") === false) {
        return c.json(
            { message: "You do not have permission to unassign sensors." },
            403,
        );
    }

    const sensorId = c.req.param("id");

    const [updatedSensor] = await dbClient
        .update(sensorDevice)
        .set({ citizenUserId: null })
        .where(eq(sensorDevice.id, sensorId))
        .returning();

    if (!updatedSensor) {
        return c.json({ message: "Sensor not found" }, 404);
    }

    return c.json(updatedSensor);
});

function parsePositiveInteger(
    value: string | undefined,
    fallback: number,
    max = Number.MAX_SAFE_INTEGER,
): number {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) return fallback;

    return Math.min(parsed, max);
}

export default sensorRoutes;
