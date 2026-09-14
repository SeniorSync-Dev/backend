import {
    pgTable,
    pgEnum,
    text,
    uuid,
    integer,
    timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { citizen, employee } from "./subUser-schema";
import { facillity } from "./facillity-schema";

export const careTaskTypeEnum = pgEnum("care_task_type", [
    "visit",
    "medication",
    "check_in",
    "hygiene",
    "training",
    "call",
    "other",
]);

export const careTaskStatusEnum = pgEnum("care_task_status", [
    "planned",
    "in_progress",
    "completed",
    "cancelled",
    "missed",
]);

export const careTask = pgTable("care_tasks", {
    id: uuid("id").primaryKey().defaultRandom(),
    citizenUserId: text("citizen_user_id")
        .notNull()
        .references(() => citizen.userId),
    assignedEmployeeId: uuid("assigned_employee_id").references(
        () => employee.id,
    ),
    facilityId: uuid("facility_id").references(() => facillity.id),
    type: careTaskTypeEnum("type").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    scheduledStart: timestamp("scheduled_start").notNull(),
    scheduledEnd: timestamp("scheduled_end"),
    status: careTaskStatusEnum("status").default("planned").notNull(),
    // Optional: e.g. 1-5
    priority: integer("priority"),
    createdByUserId: text("created_by_user_id")
        .notNull()
        .references(() => user.id),
    completedAt: timestamp("completed_at"),
    completedByEmployeeId: uuid("completed_by_employee_id").references(
        () => employee.id,
    ),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
        .defaultNow()
        .$onUpdate(() => new Date())
        .notNull(),
});
