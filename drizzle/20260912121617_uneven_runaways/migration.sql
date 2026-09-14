CREATE TABLE "adresses" (
	"id" text PRIMARY KEY,
	"street" text NOT NULL,
	"house_number" text NOT NULL,
	"floor" text,
	"city" text NOT NULL,
	"zip_code" text NOT NULL,
	"country" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_facilities" (
	"employee_user_id" text,
	"facility_id" text,
	"role_at_facility" text NOT NULL,
	"is_primary_facility" boolean DEFAULT false NOT NULL,
	"start_date" timestamp DEFAULT now() NOT NULL,
	"end_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "employee_facilities_pkey" PRIMARY KEY("employee_user_id","facility_id")
);
--> statement-breakpoint
CREATE TABLE "facility" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"address_id" text NOT NULL,
	"phone" text NOT NULL,
	"email" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employee_facilities" ADD CONSTRAINT "employee_facilities_employee_user_id_employee_userId_fkey" FOREIGN KEY ("employee_user_id") REFERENCES "employee"("userId") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "employee_facilities" ADD CONSTRAINT "employee_facilities_facility_id_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facility"("id") ON DELETE CASCADE;