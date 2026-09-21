import { date } from "drizzle-orm/pg-core";
import { dbClient } from "../../db/dbClient";
import { sensorDevice } from "../../db/schemas";
import { getClient } from "../mqttService";
import { eq } from "drizzle-orm";

export interface FallSensorStatusChange {
    deviceId: string;
    event: "device_online" | "device_offline";
    timestamp: Date;
}

export async function handleFallSensorStatusChangeAsync(statusChange: FallSensorStatusChange): Promise<void> {
    if (statusChange.event === "device_online") {
        await handleOnlineStatusAsync(statusChange);
    } else if (statusChange.event === "device_offline") {
        await handleOfflineStatusAsync(statusChange);
    }
}

async function handleOnlineStatusAsync(statusChange: FallSensorStatusChange): Promise<void> {
    const existingDevice = await dbClient
            .select()
            .from(sensorDevice)
            .where(eq(sensorDevice.serialNumber, statusChange.deviceId))
            .limit(1);



    if (!existingDevice || existingDevice.length === 0) {
        console.log(`Device with ID ${statusChange.deviceId} not found in database. Creating new record.`);
        await dbClient
            .insert(sensorDevice)
            .values({
                serialNumber: statusChange.deviceId,
                status: "active",
                type: "fall_alarm",
                mqttTopic: `seniorsync/fallsensor/status/callback/${statusChange.deviceId}`,
                lastSeenAt: statusChange.timestamp,
            })
            .onConflictDoNothing({ target: sensorDevice.serialNumber });
    }
    else {
        console.log(`Device with ID ${statusChange.deviceId} found in database. Updating record.`);
        await dbClient
            .update(sensorDevice)
            .set({
                status: "active",
                lastSeenAt: statusChange.timestamp,
            })
            .where(eq(sensorDevice.serialNumber, statusChange.deviceId));

        if (existingDevice[0].citizenUserId !== null) {
            console.log(`Device with ID ${statusChange.deviceId} is linked to citizen with userId ${existingDevice[0].citizenUserId}.`);    
            const mqttClient = getClient();
            if (mqttClient) {
                mqttClient.publish(
                    existingDevice[0].mqttTopic,
                    "OK",
                    { qos: 2, retain: false },
                );
            }
        }
    }
}

async function handleOfflineStatusAsync(statusChange: FallSensorStatusChange): Promise<void> {
        const existingDevice = await dbClient
            .select()
            .from(sensorDevice)
            .where(eq(sensorDevice.serialNumber, statusChange.deviceId))
            .limit(1);

    if (existingDevice && existingDevice.length > 0) {
        console.log(`Device with ID ${statusChange.deviceId} found in database. Updating record.`);
        await dbClient
            .update(sensorDevice)
            .set({
                status: "offline",
                lastSeenAt: statusChange.timestamp,
            })
            .where(eq(sensorDevice.serialNumber, statusChange.deviceId));
    } else {
        console.log(`Device with ID ${statusChange.deviceId} not found in database. Creating new record.`);
        await dbClient
            .insert(sensorDevice)
            .values({
                serialNumber: statusChange.deviceId,
                status: "active",
                type: "fall_alarm",
                mqttTopic: `seniorsync/fallsensor/status/callback/${statusChange.deviceId}`,
                lastSeenAt: statusChange.timestamp,
            })
            .onConflictDoNothing({ target: sensorDevice.serialNumber });
    }
}