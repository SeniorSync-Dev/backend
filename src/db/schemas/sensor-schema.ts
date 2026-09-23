import {
    pgTable,
    pgEnum,
    text,
    uuid,
    integer,
    timestamp,
    unique,
} from "drizzle-orm/pg-core";
import { citizen, employee } from "./subUser-schema";

export const sensorDeviceTypeEnum = pgEnum("sensor_device_type", [
    "fall_alarm",
    "motion_sensor",
    "door_sensor",
    "panic_button",
    "bed_sensor",
    "other",
]);

export const sensorDeviceStatusEnum = pgEnum("sensor_device_status", [
    "active",
    "offline",
    "maintenance",
    "retired",
    "low_battery",
]);

export const sensorEventTypeEnum = pgEnum("sensor_event_type", [
    "fall_detected",
    "fall_confirmed",
    "fall_false_alarm",
    "motion_detected",
    "no_motion_warning",
    "door_opened",
    "door_closed",
    "panic_pressed",
    "battery_low",
    "device_offline",
    "device_online",
    "error",
]);

export const sensorEventSeverityEnum = pgEnum("sensor_event_severity", [
    "info",
    "warning",
    "critical",
    "emergency",
]);

export const sensorEventStatusEnum = pgEnum("sensor_event_status", [
    "new",
    "acknowledged",
    "in_progress",
    "resolved",
    "false_alarm",
    "dismissed",
]);

export const sensorDevice = pgTable("sensor_devices", {
    id: uuid("id").primaryKey().defaultRandom(),
    citizenUserId: text("citizen_user_id")
        .references(() => citizen.userId),
    serialNumber: text("serial_number").notNull().unique(),
    type: sensorDeviceTypeEnum("type").notNull(),
    model: text("model"),
    manufacturer: text("manufacturer"),
    mqttTopic: text("mqtt_topic").notNull(),
    status: sensorDeviceStatusEnum("status").default("active").notNull(),
    // Percentage 0-100, nullable if wired
    batteryLevel: integer("battery_level"),
    lastSeenAt: timestamp("last_seen_at"),
    // e.g. bedroom, bathroom, worn by citizen
    locationDescription: text("location_description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
        .defaultNow()
        .$onUpdate(() => new Date())
        .notNull(),
});

export const sensorEvent = pgTable(
    "sensor_events",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        citizenUserId: text("citizen_user_id")
            .notNull()
            .references(() => citizen.userId),
        deviceId: uuid("device_id")
            .notNull()
            .references(() => sensorDevice.id),
        eventType: sensorEventTypeEnum("event_type").notNull(),
        severity: sensorEventSeverityEnum("severity").default("info").notNull(),
        status: sensorEventStatusEnum("status").default("new").notNull(),
        occurredAt: timestamp("occurred_at").notNull(),
        // Raw/parsed MQTT payload as JSON string
        payload: text("payload"),
        acknowledgedAt: timestamp("acknowledged_at"),
        acknowledgedByEmployeeId: uuid("acknowledged_by_employee_id").references(
            () => employee.id,
        ),
        acknowledgedByEmployeeName: text("acknowledged_by_employee_name"),
        resolvedAt: timestamp("resolved_at"),
        resolvedByEmployeeId: uuid("resolved_by_employee_id").references(
            () => employee.id,
        ),
        resolvedByEmployeeName: text("resolved_by_employee_name"),
        resolutionNotes: text("resolution_notes"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [
        unique("sensor_events_device_type_occurred_at_unique").on(
            table.deviceId,
            table.eventType,
            table.occurredAt,
        ),
    ],
);
