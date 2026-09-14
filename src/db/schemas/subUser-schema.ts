import {
  pgTable,
  text,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export const relative = pgTable("relative", {
  userId: text("userId")
    .primaryKey()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const employee = pgTable("employee", {
  userId: text("userId")
    .primaryKey()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
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
  },
  (table) => [primaryKey({ columns: [table.relativeUserId, table.citizenUserId] })],
);
