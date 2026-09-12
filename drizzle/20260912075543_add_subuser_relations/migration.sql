CREATE TABLE "citizen" (
	"userId" text PRIMARY KEY,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee" (
	"userId" text PRIMARY KEY,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "relative" (
	"userId" text PRIMARY KEY,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "relative_citizen" (
	"relative_user_id" text,
	"citizen_user_id" text,
	CONSTRAINT "relative_citizen_pkey" PRIMARY KEY("relative_user_id","citizen_user_id")
);
--> statement-breakpoint
ALTER TABLE "citizen" ADD CONSTRAINT "citizen_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "employee" ADD CONSTRAINT "employee_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "relative" ADD CONSTRAINT "relative_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "relative_citizen" ADD CONSTRAINT "relative_citizen_relative_user_id_relative_userId_fkey" FOREIGN KEY ("relative_user_id") REFERENCES "relative"("userId") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "relative_citizen" ADD CONSTRAINT "relative_citizen_citizen_user_id_citizen_userId_fkey" FOREIGN KEY ("citizen_user_id") REFERENCES "citizen"("userId") ON DELETE CASCADE;