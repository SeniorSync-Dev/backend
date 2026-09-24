CREATE TYPE "service_provider_category" AS ENUM('physiotherapy', 'swimming_pool', 'fitness_center', 'other');--> statement-breakpoint
CREATE TABLE "service_provider_companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"category" "service_provider_category" DEFAULT 'other'::"service_provider_category" NOT NULL,
	"phone" text,
	"email" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_provider_company_staff" (
	"user_id" text PRIMARY KEY,
	"company_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invitation" ADD COLUMN "service_provider_company_id" text;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "provider_company_id" uuid;--> statement-breakpoint
ALTER TABLE "service_provider_companies" ADD CONSTRAINT "service_provider_companies_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "service_provider_company_staff" ADD CONSTRAINT "service_provider_company_staff_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "service_provider_company_staff" ADD CONSTRAINT "service_provider_company_staff_GZXJFnMChrcg_fkey" FOREIGN KEY ("company_id") REFERENCES "service_provider_companies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_lHyLHokSCwE3_fkey" FOREIGN KEY ("provider_company_id") REFERENCES "service_provider_companies"("id");