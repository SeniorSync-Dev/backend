ALTER TABLE "sensor_devices" ADD COLUMN "citizen_user_id" text;--> statement-breakpoint
UPDATE "sensor_devices" AS device
SET "citizen_user_id" = assignment."citizen_user_id"
FROM (
    SELECT DISTINCT ON ("device_id") "device_id", "citizen_user_id"
    FROM "citizen_sensor_devices"
    ORDER BY "device_id", "is_active" DESC, "assigned_at" DESC
) AS assignment
WHERE device."id" = assignment."device_id";--> statement-breakpoint
ALTER TABLE "sensor_devices" ALTER COLUMN "citizen_user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sensor_devices" ADD CONSTRAINT "sensor_devices_citizen_user_id_citizen_userId_fkey" FOREIGN KEY ("citizen_user_id") REFERENCES "citizen"("userId");
--> statement-breakpoint
DROP TABLE "citizen_sensor_devices";
