import {
  pgTable,
  text,
  timestamp,
  primaryKey,
  boolean,
} from "drizzle-orm/pg-core";
import { employee } from "./subUser-schema";


export const facillity = pgTable("facility", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  addressId: text("address_id").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const employeeFacilities = pgTable(
  "employee_facilities",
  {
    employeeUserId: text("employee_user_id")
      .notNull()
      .references(() => employee.userId, { onDelete: "cascade" }),
    facilityId: text("facility_id")
      .notNull()
      .references(() => facillity.id, { onDelete: "cascade" }),
      roleAtFacility: text("role_at_facility").notNull(),
      isPrimaryFacility: boolean("is_primary_facility").default(false).notNull(),
      startDate: timestamp("start_date").defaultNow().notNull(),
      endDate: timestamp("end_date"),
      createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.employeeUserId, table.facilityId] })],
);

export const address = pgTable("adresses", {
    id: text("id").primaryKey(),
    street: text("street").notNull(),
    houseNumber: text("house_number").notNull(),
    floor: text("floor"),
    city: text("city").notNull(),
    zipCode: text("zip_code").notNull(),
    country: text("country").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  });
