import { Hono } from "hono";
import { and, asc, count, eq, isNotNull, isNull } from "drizzle-orm";
import { dbClient } from "../../db/dbClient";
import { sensorDevice, user } from "../../db/schemas";
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
    const filters = and(assignmentFilter, statusFilter);

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
