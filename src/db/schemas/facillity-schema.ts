import {
    pgTable,
    pgEnum,
    text,
    uuid,
    boolean,
    numeric,
    date,
    timestamp,
} from "drizzle-orm/pg-core";
import { citizen, employee } from "./subUser-schema";

export const facilityTypeEnum = pgEnum("facility_type", [
    "nursing_home",
    "health_center",
    "activity_center",
    "rehab_center",
    "homecare_unit",
    "other",
]);

export const citizenFacilityRelationTypeEnum = pgEnum(
    "citizen_facility_relation_type",
    ["resident", "homecare", "rehab", "activity_member"],
);

export const address = pgTable("addresses", {
    id: uuid("id").primaryKey().defaultRandom(),
    street: text("street").notNull(),
    houseNumber: text("house_number"),
    floor: text("floor"),
    zipCode: text("zip_code").notNull(),
    city: text("city").notNull(),
    municipality: text("municipality"),
    country: text("country").default("DK").notNull(),
    latitude: numeric("latitude"),
    longitude: numeric("longitude"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
        .defaultNow()
        .$onUpdate(() => new Date())
        .notNull(),
});

export const facillity = pgTable("facilities", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    type: facilityTypeEnum("type").notNull(),
    addressId: uuid("address_id")
        .notNull()
        .references(() => address.id),
    phone: text("phone"),
    email: text("email"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
        .defaultNow()
        .$onUpdate(() => new Date())
        .notNull(),
});

export const employeeFacilities = pgTable("employee_facilities", {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
        .notNull()
        .references(() => employee.id, { onDelete: "cascade" }),
    facilityId: uuid("facility_id")
        .notNull()
        .references(() => facillity.id, { onDelete: "cascade" }),
    roleAtFacility: text("role_at_facility"),
    isPrimary: boolean("is_primary").default(false).notNull(),
    startDate: date("start_date"),
    endDate: date("end_date"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const citizenFacilities = pgTable("citizen_facilities", {
    id: uuid("id").primaryKey().defaultRandom(),
    citizenUserId: text("citizen_user_id")
        .notNull()
        .references(() => citizen.userId, { onDelete: "cascade" }),
    facilityId: uuid("facility_id")
        .notNull()
        .references(() => facillity.id, { onDelete: "cascade" }),
    relationType: citizenFacilityRelationTypeEnum("relation_type").notNull(),
    isPrimary: boolean("is_primary").default(false).notNull(),
    startDate: date("start_date"),
    endDate: date("end_date"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
