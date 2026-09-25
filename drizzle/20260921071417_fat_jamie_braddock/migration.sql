CREATE TYPE "relative_link_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "citizen_invite_code" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"citizen_user_id" text NOT NULL,
	"code" text NOT NULL UNIQUE,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "relative_citizen" ADD COLUMN "status" "relative_link_status" DEFAULT 'pending'::"relative_link_status" NOT NULL;--> statement-breakpoint
ALTER TABLE "relative_citizen" ALTER COLUMN "can_view" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "citizen_invite_code" ADD CONSTRAINT "citizen_invite_code_citizen_user_id_citizen_userId_fkey" FOREIGN KEY ("citizen_user_id") REFERENCES "citizen"("userId") ON DELETE CASCADE;