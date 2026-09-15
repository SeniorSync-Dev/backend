CREATE TYPE "citizen_status" AS ENUM('active', 'inactive', 'deceased');--> statement-breakpoint
CREATE TYPE "employment_status" AS ENUM('active', 'inactive', 'terminated', 'on_leave');--> statement-breakpoint
CREATE TYPE "citizen_facility_relation_type" AS ENUM('resident', 'homecare', 'rehab', 'activity_member');--> statement-breakpoint
CREATE TYPE "facility_type" AS ENUM('nursing_home', 'health_center', 'activity_center', 'rehab_center', 'homecare_unit', 'other');--> statement-breakpoint
CREATE TYPE "activity_location_type" AS ENUM('facility', 'external', 'home', 'virtual');--> statement-breakpoint
CREATE TYPE "activity_status" AS ENUM('draft', 'published', 'cancelled', 'completed');--> statement-breakpoint
CREATE TYPE "activity_type" AS ENUM('outing', 'sports', 'social', 'healthcare', 'training', 'other');--> statement-breakpoint
CREATE TYPE "signup_status" AS ENUM('registered', 'waitlisted', 'cancelled', 'attended', 'no_show');--> statement-breakpoint
CREATE TYPE "care_task_status" AS ENUM('planned', 'in_progress', 'completed', 'cancelled', 'missed');--> statement-breakpoint
CREATE TYPE "care_task_type" AS ENUM('visit', 'medication', 'check_in', 'hygiene', 'training', 'call', 'other');--> statement-breakpoint
CREATE TYPE "medication_device_status" AS ENUM('active', 'offline', 'maintenance', 'retired');--> statement-breakpoint
CREATE TYPE "medication_event_source" AS ENUM('mqtt', 'employee', 'system');--> statement-breakpoint
CREATE TYPE "medication_event_type" AS ENUM('dispensed', 'taken', 'missed', 'skipped', 'error', 'refill_needed', 'low_supply');--> statement-breakpoint
CREATE TYPE "medication_plan_status" AS ENUM('active', 'paused', 'ended');--> statement-breakpoint
CREATE TYPE "medication_schedule_status" AS ENUM('planned', 'dispensed', 'taken', 'missed', 'cancelled');--> statement-breakpoint
CREATE TYPE "sensor_device_status" AS ENUM('active', 'offline', 'maintenance', 'retired', 'low_battery');--> statement-breakpoint
CREATE TYPE "sensor_device_type" AS ENUM('fall_alarm', 'motion_sensor', 'door_sensor', 'panic_button', 'bed_sensor', 'other');--> statement-breakpoint
CREATE TYPE "sensor_event_severity" AS ENUM('info', 'warning', 'critical', 'emergency');--> statement-breakpoint
CREATE TYPE "sensor_event_status" AS ENUM('new', 'acknowledged', 'in_progress', 'resolved', 'false_alarm', 'dismissed');--> statement-breakpoint
CREATE TYPE "sensor_event_type" AS ENUM('fall_detected', 'fall_confirmed', 'fall_false_alarm', 'motion_detected', 'no_motion_warning', 'door_opened', 'door_closed', 'panic_pressed', 'battery_low', 'device_offline', 'device_online', 'error');--> statement-breakpoint
CREATE TABLE "citizen_facilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"citizen_user_id" text NOT NULL,
	"facility_id" uuid NOT NULL,
	"relation_type" "citizen_facility_relation_type" NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"start_date" date,
	"end_date" date,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organizer_facility_id" uuid NOT NULL,
	"created_by_user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"type" "activity_type" DEFAULT 'other'::"activity_type" NOT NULL,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL,
	"capacity" integer,
	"status" "activity_status" DEFAULT 'draft'::"activity_status" NOT NULL,
	"location_type" "activity_location_type" DEFAULT 'facility'::"activity_location_type" NOT NULL,
	"location_name" text,
	"location_address_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_employee_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"activity_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"assignment_role" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_signups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"activity_id" uuid NOT NULL,
	"citizen_user_id" text NOT NULL,
	"booked_by_user_id" text NOT NULL,
	"status" "signup_status" DEFAULT 'registered'::"signup_status" NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "care_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"citizen_user_id" text NOT NULL,
	"assigned_employee_id" uuid,
	"facility_id" uuid,
	"type" "care_task_type" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"scheduled_start" timestamp NOT NULL,
	"scheduled_end" timestamp,
	"status" "care_task_status" DEFAULT 'planned'::"care_task_status" NOT NULL,
	"priority" integer,
	"created_by_user_id" text NOT NULL,
	"completed_at" timestamp,
	"completed_by_employee_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "citizen_medication_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"citizen_user_id" text NOT NULL,
	"device_id" uuid NOT NULL,
	"assigned_at" timestamp NOT NULL,
	"unassigned_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medication_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"serial_number" text NOT NULL UNIQUE,
	"model" text,
	"manufacturer" text,
	"mqtt_topic" text NOT NULL,
	"status" "medication_device_status" DEFAULT 'active'::"medication_device_status" NOT NULL,
	"last_seen_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medication_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"citizen_user_id" text NOT NULL,
	"device_id" uuid,
	"medication_schedule_id" uuid,
	"event_type" "medication_event_type" NOT NULL,
	"occurred_at" timestamp NOT NULL,
	"source" "medication_event_source" NOT NULL,
	"payload" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medication_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"citizen_user_id" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"medication_name" text NOT NULL,
	"strength" text,
	"dosage_text" text,
	"instructions" text,
	"start_date" date NOT NULL,
	"end_date" date,
	"status" "medication_plan_status" DEFAULT 'active'::"medication_plan_status" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medication_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"medication_plan_id" uuid NOT NULL,
	"scheduled_at" timestamp NOT NULL,
	"dose_amount" numeric,
	"dose_unit" text,
	"window_start" timestamp,
	"window_end" timestamp,
	"status" "medication_schedule_status" DEFAULT 'planned'::"medication_schedule_status" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "citizen_sensor_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"citizen_user_id" text NOT NULL,
	"device_id" uuid NOT NULL,
	"assigned_at" timestamp NOT NULL,
	"unassigned_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "sensor_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"serial_number" text NOT NULL UNIQUE,
	"type" "sensor_device_type" NOT NULL,
	"model" text,
	"manufacturer" text,
	"mqtt_topic" text NOT NULL,
	"status" "sensor_device_status" DEFAULT 'active'::"sensor_device_status" NOT NULL,
	"battery_level" integer,
	"last_seen_at" timestamp,
	"location_description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sensor_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"citizen_user_id" text NOT NULL,
	"device_id" uuid NOT NULL,
	"event_type" "sensor_event_type" NOT NULL,
	"severity" "sensor_event_severity" DEFAULT 'info'::"sensor_event_severity" NOT NULL,
	"status" "sensor_event_status" DEFAULT 'new'::"sensor_event_status" NOT NULL,
	"occurred_at" timestamp NOT NULL,
	"payload" text,
	"acknowledged_at" timestamp,
	"acknowledged_by_employee_id" uuid,
	"resolved_at" timestamp,
	"resolved_by_employee_id" uuid,
	"resolution_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "adresses" RENAME TO "addresses";--> statement-breakpoint
ALTER TABLE "facility" RENAME TO "facilities";--> statement-breakpoint
ALTER TABLE "employee_facilities" DROP CONSTRAINT "employee_facilities_employee_user_id_employee_userId_fkey";--> statement-breakpoint
ALTER TABLE "employee" RENAME COLUMN "userId" TO "user_id";--> statement-breakpoint
ALTER TABLE "employee_facilities" RENAME COLUMN "is_primary_facility" TO "is_primary";--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "nin_hash" text;--> statement-breakpoint
ALTER TABLE "citizen" ADD COLUMN "address_id" uuid;--> statement-breakpoint
ALTER TABLE "citizen" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "citizen" ADD COLUMN "date_of_birth" date;--> statement-breakpoint
ALTER TABLE "citizen" ADD COLUMN "status" "citizen_status" DEFAULT 'active'::"citizen_status" NOT NULL;--> statement-breakpoint
ALTER TABLE "citizen" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "employee" ADD COLUMN "id" uuid DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "employee" ADD COLUMN "nin_hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "employee" ADD COLUMN "address_id" uuid;--> statement-breakpoint
ALTER TABLE "employee" ADD COLUMN "employee_number" text NOT NULL;--> statement-breakpoint
ALTER TABLE "employee" ADD COLUMN "job_title" text NOT NULL;--> statement-breakpoint
ALTER TABLE "employee" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "employee" ADD COLUMN "employment_status" "employment_status" DEFAULT 'active'::"employment_status" NOT NULL;--> statement-breakpoint
ALTER TABLE "relative" ADD COLUMN "address_id" uuid;--> statement-breakpoint
ALTER TABLE "relative" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "relative_citizen" ADD COLUMN "relationship_type" text NOT NULL;--> statement-breakpoint
ALTER TABLE "relative_citizen" ADD COLUMN "can_view" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "relative_citizen" ADD COLUMN "can_book_activities" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "relative_citizen" ADD COLUMN "can_manage_medication" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "relative_citizen" ADD COLUMN "can_receive_alerts" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "relative_citizen" ADD COLUMN "can_act_on_behalf" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "relative_citizen" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "municipality" text;--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "latitude" numeric;--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "longitude" numeric;--> statement-breakpoint
ALTER TABLE "employee_facilities" ADD COLUMN "id" uuid DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "employee_facilities" ADD COLUMN "employee_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "type" "facility_type" NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_facilities" DROP COLUMN "employee_user_id";--> statement-breakpoint
ALTER TABLE "employee_facilities" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "employee" DROP CONSTRAINT "employee_pkey";--> statement-breakpoint
ALTER TABLE "employee" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "employee" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "addresses" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;--> statement-breakpoint
ALTER TABLE "addresses" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "addresses" ALTER COLUMN "house_number" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "addresses" ALTER COLUMN "country" SET DEFAULT 'DK';--> statement-breakpoint
ALTER TABLE "employee_facilities" DROP CONSTRAINT "employee_facilities_facility_id_facility_id_fkey";--> statement-breakpoint
ALTER TABLE "employee_facilities" ALTER COLUMN "facility_id" SET DATA TYPE uuid USING "facility_id"::uuid;--> statement-breakpoint
ALTER TABLE "employee_facilities" ALTER COLUMN "role_at_facility" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_facilities" ALTER COLUMN "start_date" SET DATA TYPE date USING "start_date"::date;--> statement-breakpoint
ALTER TABLE "employee_facilities" ALTER COLUMN "start_date" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "employee_facilities" ALTER COLUMN "start_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_facilities" ALTER COLUMN "end_date" SET DATA TYPE date USING "end_date"::date;--> statement-breakpoint
ALTER TABLE "facilities" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;--> statement-breakpoint
ALTER TABLE "facilities" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "facilities" ALTER COLUMN "address_id" SET DATA TYPE uuid USING "address_id"::uuid;--> statement-breakpoint
ALTER TABLE "facilities" ALTER COLUMN "phone" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "facilities" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_nin_hash_key" UNIQUE("nin_hash");--> statement-breakpoint
ALTER TABLE "employee" ADD CONSTRAINT "employee_user_id_key" UNIQUE("user_id");--> statement-breakpoint
ALTER TABLE "employee" ADD CONSTRAINT "employee_nin_hash_key" UNIQUE("nin_hash");--> statement-breakpoint
ALTER TABLE "employee" ADD CONSTRAINT "employee_employee_number_key" UNIQUE("employee_number");--> statement-breakpoint
ALTER TABLE "citizen" ADD CONSTRAINT "citizen_address_id_addresses_id_fkey" FOREIGN KEY ("address_id") REFERENCES "addresses"("id");--> statement-breakpoint
ALTER TABLE "employee" ADD CONSTRAINT "employee_address_id_addresses_id_fkey" FOREIGN KEY ("address_id") REFERENCES "addresses"("id");--> statement-breakpoint
ALTER TABLE "relative" ADD CONSTRAINT "relative_address_id_addresses_id_fkey" FOREIGN KEY ("address_id") REFERENCES "addresses"("id");--> statement-breakpoint
ALTER TABLE "citizen_facilities" ADD CONSTRAINT "citizen_facilities_citizen_user_id_citizen_userId_fkey" FOREIGN KEY ("citizen_user_id") REFERENCES "citizen"("userId") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "citizen_facilities" ADD CONSTRAINT "citizen_facilities_facility_id_facilities_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "employee_facilities" ADD CONSTRAINT "employee_facilities_employee_id_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "employee_facilities" ADD CONSTRAINT "employee_facilities_facility_id_facilities_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_address_id_addresses_id_fkey" FOREIGN KEY ("address_id") REFERENCES "addresses"("id");--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_organizer_facility_id_facilities_id_fkey" FOREIGN KEY ("organizer_facility_id") REFERENCES "facilities"("id");--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_location_address_id_addresses_id_fkey" FOREIGN KEY ("location_address_id") REFERENCES "addresses"("id");--> statement-breakpoint
ALTER TABLE "activity_employee_assignments" ADD CONSTRAINT "activity_employee_assignments_activity_id_activities_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id");--> statement-breakpoint
ALTER TABLE "activity_employee_assignments" ADD CONSTRAINT "activity_employee_assignments_employee_id_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id");--> statement-breakpoint
ALTER TABLE "activity_signups" ADD CONSTRAINT "activity_signups_activity_id_activities_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id");--> statement-breakpoint
ALTER TABLE "activity_signups" ADD CONSTRAINT "activity_signups_citizen_user_id_citizen_userId_fkey" FOREIGN KEY ("citizen_user_id") REFERENCES "citizen"("userId");--> statement-breakpoint
ALTER TABLE "activity_signups" ADD CONSTRAINT "activity_signups_booked_by_user_id_user_id_fkey" FOREIGN KEY ("booked_by_user_id") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "care_tasks" ADD CONSTRAINT "care_tasks_citizen_user_id_citizen_userId_fkey" FOREIGN KEY ("citizen_user_id") REFERENCES "citizen"("userId");--> statement-breakpoint
ALTER TABLE "care_tasks" ADD CONSTRAINT "care_tasks_assigned_employee_id_employee_id_fkey" FOREIGN KEY ("assigned_employee_id") REFERENCES "employee"("id");--> statement-breakpoint
ALTER TABLE "care_tasks" ADD CONSTRAINT "care_tasks_facility_id_facilities_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id");--> statement-breakpoint
ALTER TABLE "care_tasks" ADD CONSTRAINT "care_tasks_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "care_tasks" ADD CONSTRAINT "care_tasks_completed_by_employee_id_employee_id_fkey" FOREIGN KEY ("completed_by_employee_id") REFERENCES "employee"("id");--> statement-breakpoint
ALTER TABLE "citizen_medication_devices" ADD CONSTRAINT "citizen_medication_devices_citizen_user_id_citizen_userId_fkey" FOREIGN KEY ("citizen_user_id") REFERENCES "citizen"("userId");--> statement-breakpoint
ALTER TABLE "citizen_medication_devices" ADD CONSTRAINT "citizen_medication_devices_device_id_medication_devices_id_fkey" FOREIGN KEY ("device_id") REFERENCES "medication_devices"("id");--> statement-breakpoint
ALTER TABLE "medication_events" ADD CONSTRAINT "medication_events_citizen_user_id_citizen_userId_fkey" FOREIGN KEY ("citizen_user_id") REFERENCES "citizen"("userId");--> statement-breakpoint
ALTER TABLE "medication_events" ADD CONSTRAINT "medication_events_device_id_medication_devices_id_fkey" FOREIGN KEY ("device_id") REFERENCES "medication_devices"("id");--> statement-breakpoint
ALTER TABLE "medication_events" ADD CONSTRAINT "medication_events_B29e9dcMjGAm_fkey" FOREIGN KEY ("medication_schedule_id") REFERENCES "medication_schedules"("id");--> statement-breakpoint
ALTER TABLE "medication_plans" ADD CONSTRAINT "medication_plans_citizen_user_id_citizen_userId_fkey" FOREIGN KEY ("citizen_user_id") REFERENCES "citizen"("userId");--> statement-breakpoint
ALTER TABLE "medication_plans" ADD CONSTRAINT "medication_plans_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "medication_schedules" ADD CONSTRAINT "medication_schedules_hnWYdFIRdSwx_fkey" FOREIGN KEY ("medication_plan_id") REFERENCES "medication_plans"("id");--> statement-breakpoint
ALTER TABLE "citizen_sensor_devices" ADD CONSTRAINT "citizen_sensor_devices_citizen_user_id_citizen_userId_fkey" FOREIGN KEY ("citizen_user_id") REFERENCES "citizen"("userId");--> statement-breakpoint
ALTER TABLE "citizen_sensor_devices" ADD CONSTRAINT "citizen_sensor_devices_device_id_sensor_devices_id_fkey" FOREIGN KEY ("device_id") REFERENCES "sensor_devices"("id");--> statement-breakpoint
ALTER TABLE "sensor_events" ADD CONSTRAINT "sensor_events_citizen_user_id_citizen_userId_fkey" FOREIGN KEY ("citizen_user_id") REFERENCES "citizen"("userId");--> statement-breakpoint
ALTER TABLE "sensor_events" ADD CONSTRAINT "sensor_events_device_id_sensor_devices_id_fkey" FOREIGN KEY ("device_id") REFERENCES "sensor_devices"("id");--> statement-breakpoint
ALTER TABLE "sensor_events" ADD CONSTRAINT "sensor_events_acknowledged_by_employee_id_employee_id_fkey" FOREIGN KEY ("acknowledged_by_employee_id") REFERENCES "employee"("id");--> statement-breakpoint
ALTER TABLE "sensor_events" ADD CONSTRAINT "sensor_events_resolved_by_employee_id_employee_id_fkey" FOREIGN KEY ("resolved_by_employee_id") REFERENCES "employee"("id");