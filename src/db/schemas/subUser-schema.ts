import {
    pgTable,
    pgEnum,
    text,
    uuid,
    date,
    boolean,
    timestamp,
    primaryKey,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { address } from "./facillity-schema";

export const citizenStatusEnum = pgEnum("citizen_status", [
    "active",
    "inactive",
    "deceased",
]);

export const employmentStatusEnum = pgEnum("employment_status", [
    "active",
    "inactive",
    "terminated",
    "on_leave",
]);

export const relative = pgTable("relative", {
    userId: text("userId")
        .primaryKey()
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
    addressId: uuid("address_id").references(() => address.id),
    phone: text("phone"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
        .defaultNow()
        .$onUpdate(() => /* @__PURE__ */ new Date())
        .notNull(),
});

export const citizen = pgTable("citizen", {
    userId: text("userId")
        .primaryKey()
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
    addressId: uuid("address_id").references(() => address.id),
    phone: text("phone"),
    dateOfBirth: date("date_of_birth"),
    status: citizenStatusEnum("status").default("active").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
        .defaultNow()
        .$onUpdate(() => /* @__PURE__ */ new Date())
        .notNull(),
});

export const employee = pgTable("employee", {
    // Pre-registered by an admin using the employee's CPR before their first login; userId is linked once they authenticate via MitID
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
        .unique()
        .references(() => user.id, { onDelete: "cascade" }),
    ninHash: text("nin_hash").notNull().unique(),
    addressId: uuid("address_id").references(() => address.id),
    employeeNumber: text("employee_number").notNull().unique(),
    jobTitle: text("job_title").notNull(),
    phone: text("phone"),
    employmentStatus: employmentStatusEnum("employment_status")
        .default("active")
        .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
        .defaultNow()
        .$onUpdate(() => /* @__PURE__ */ new Date())
        .notNull(),
});

export const relativeCitizen = pgTable(
    "relative_citizen",
    {
        relativeUserId: text("relative_user_id")
            .notNull()
            .references(() => relative.userId, { onDelete: "cascade" }),
        citizenUserId: text("citizen_user_id")
            .notNull()
            .references(() => citizen.userId, { onDelete: "cascade" }),
        // e.g. daughter, son, spouse, guardian
        relationshipType: text("relationship_type").notNull(),
        canView: boolean("can_view").default(true).notNull(),
        canBookActivities: boolean("can_book_activities")
            .default(false)
            .notNull(),
        canManageMedication: boolean("can_manage_medication")
            .default(false)
            .notNull(),
        canReceiveAlerts: boolean("can_receive_alerts")
            .default(false)
            .notNull(),
        canActOnBehalf: boolean("can_act_on_behalf").default(false).notNull(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [
        primaryKey({ columns: [table.relativeUserId, table.citizenUserId] }),
    ],
);
