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
import { facillity, address } from "./facillity-schema";

export const activityTypeEnum = pgEnum("activity_type", [
    "outing",
    "sports",
    "social",
    "healthcare",
    "training",
    "other",
]);

export const activityStatusEnum = pgEnum("activity_status", [
    "draft",
    "published",
    "cancelled",
    "completed",
]);

export const activityLocationTypeEnum = pgEnum("activity_location_type", [
    "facility",
    "external",
    "home",
    "virtual",
]);

export const signupStatusEnum = pgEnum("signup_status", [
    "registered",
    "waitlisted",
    "cancelled",
    "attended",
    "no_show",
]);

export const activity = pgTable("activities", {
    id: uuid("id").primaryKey().defaultRandom(),
    organizerFacilityId: uuid("organizer_facility_id")
        .notNull()
        .references(() => facillity.id),
    createdByUserId: text("created_by_user_id")
        .notNull()
        .references(() => user.id),
    title: text("title").notNull(),
    description: text("description"),
    type: activityTypeEnum("type").default("other").notNull(),
    startsAt: timestamp("starts_at").notNull(),
    endsAt: timestamp("ends_at").notNull(),
    capacity: integer("capacity"),
    status: activityStatusEnum("status").default("draft").notNull(),
    locationType: activityLocationTypeEnum("location_type")
        .default("facility")
        .notNull(),
    locationName: text("location_name"),
    // Nullable if activity happens at facility or virtually
    locationAddressId: uuid("location_address_id").references(() => address.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
        .defaultNow()
        .$onUpdate(() => new Date())
        .notNull(),
});

export const activitySignup = pgTable("activity_signups", {
    id: uuid("id").primaryKey().defaultRandom(),
    activityId: uuid("activity_id")
        .notNull()
        .references(() => activity.id),
    citizenUserId: text("citizen_user_id")
        .notNull()
        .references(() => citizen.userId),
    // Citizen, relative or employee
    bookedByUserId: text("booked_by_user_id")
        .notNull()
        .references(() => user.id),
    status: signupStatusEnum("status").default("registered").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const activityEmployeeAssignment = pgTable(
    "activity_employee_assignments",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        activityId: uuid("activity_id")
            .notNull()
            .references(() => activity.id),
        employeeId: uuid("employee_id")
            .notNull()
            .references(() => employee.id),
        // e.g. host, driver, nurse, assistant
        assignmentRole: text("assignment_role"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
);
