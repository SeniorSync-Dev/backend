import { pgTable, pgEnum, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { user, organization } from "./auth-schema";

export const serviceProviderCategoryEnum = pgEnum("service_provider_category", [
    "physiotherapy",
    "swimming_pool",
    "fitness_center",
    "other",
]);

export const serviceProviderCompany = pgTable("service_provider_companies", {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
        .notNull()
        .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: serviceProviderCategoryEnum("category")
        .default("other")
        .notNull(),
    phone: text("phone"),
    email: text("email"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
        .defaultNow()
        .$onUpdate(() => new Date())
        .notNull(),
});

// One user belongs to at most one service-provider company
export const serviceProviderCompanyStaff = pgTable(
    "service_provider_company_staff",
    {
        userId: text("user_id")
            .primaryKey()
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        companyId: uuid("company_id")
            .notNull()
            .references(() => serviceProviderCompany.id, {
                onDelete: "cascade",
            }),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
);
