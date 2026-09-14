import {
    pgTable,
    pgEnum,
    text,
    uuid,
    numeric,
    date,
    boolean,
    timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { citizen } from "./subUser-schema";

export const medicationDeviceStatusEnum = pgEnum("medication_device_status", [
    "active",
    "offline",
    "maintenance",
    "retired",
]);

export const medicationPlanStatusEnum = pgEnum("medication_plan_status", [
    "active",
    "paused",
    "ended",
]);

export const medicationScheduleStatusEnum = pgEnum(
    "medication_schedule_status",
    ["planned", "dispensed", "taken", "missed", "cancelled"],
);

export const medicationEventTypeEnum = pgEnum("medication_event_type", [
    "dispensed",
    "taken",
    "missed",
    "skipped",
    "error",
    "refill_needed",
    "low_supply",
]);

export const medicationEventSourceEnum = pgEnum("medication_event_source", [
    "mqtt",
    "employee",
    "system",
]);

export const medicationDevice = pgTable("medication_devices", {
    id: uuid("id").primaryKey().defaultRandom(),
    serialNumber: text("serial_number").notNull().unique(),
    model: text("model"),
    manufacturer: text("manufacturer"),
    mqttTopic: text("mqtt_topic").notNull(),
    status: medicationDeviceStatusEnum("status").default("active").notNull(),
    lastSeenAt: timestamp("last_seen_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const citizenMedicationDevice = pgTable("citizen_medication_devices", {
    id: uuid("id").primaryKey().defaultRandom(),
    citizenUserId: text("citizen_user_id")
        .notNull()
        .references(() => citizen.userId),
    deviceId: uuid("device_id")
        .notNull()
        .references(() => medicationDevice.id),
    assignedAt: timestamp("assigned_at").notNull(),
    unassignedAt: timestamp("unassigned_at"),
    isActive: boolean("is_active").default(true).notNull(),
});

export const medicationPlan = pgTable("medication_plans", {
    id: uuid("id").primaryKey().defaultRandom(),
    citizenUserId: text("citizen_user_id")
        .notNull()
        .references(() => citizen.userId),
    createdByUserId: text("created_by_user_id")
        .notNull()
        .references(() => user.id),
    medicationName: text("medication_name").notNull(),
    // e.g. 500mg
    strength: text("strength"),
    // e.g. 2 tablets morning
    dosageText: text("dosage_text"),
    instructions: text("instructions"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    status: medicationPlanStatusEnum("status").default("active").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
        .defaultNow()
        .$onUpdate(() => new Date())
        .notNull(),
});

export const medicationSchedule = pgTable("medication_schedules", {
    id: uuid("id").primaryKey().defaultRandom(),
    medicationPlanId: uuid("medication_plan_id")
        .notNull()
        .references(() => medicationPlan.id),
    scheduledAt: timestamp("scheduled_at").notNull(),
    doseAmount: numeric("dose_amount"),
    // e.g. tablet, ml
    doseUnit: text("dose_unit"),
    windowStart: timestamp("window_start"),
    windowEnd: timestamp("window_end"),
    status: medicationScheduleStatusEnum("status").default("planned").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const medicationEvent = pgTable("medication_events", {
    id: uuid("id").primaryKey().defaultRandom(),
    citizenUserId: text("citizen_user_id")
        .notNull()
        .references(() => citizen.userId),
    deviceId: uuid("device_id").references(() => medicationDevice.id),
    medicationScheduleId: uuid("medication_schedule_id").references(
        () => medicationSchedule.id,
    ),
    eventType: medicationEventTypeEnum("event_type").notNull(),
    occurredAt: timestamp("occurred_at").notNull(),
    source: medicationEventSourceEnum("source").notNull(),
    // Optional raw/parsed payload as JSON string
    payload: text("payload"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
