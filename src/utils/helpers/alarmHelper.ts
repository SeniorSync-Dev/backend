import { eq } from "drizzle-orm";
import { dbClient } from "../../db/dbClient";
import { sensorDevice } from "../../db/schemas";
import { getClient } from "../mqttService";

export interface FallSensorStatusChange {
    deviceId: string;
    event: "device_online" | "device_offline";
    timestamp: Date;
}

export async function handleFallSensorStatusChangeAsync(statusChange: FallSensorStatusChange): Promise<void> {
    const handlers = {
        device_online: handleOnlineStatusAsync,
        device_offline: handleOfflineStatusAsync,
    };

    await handlers[statusChange.event](statusChange);
}

async function handleOnlineStatusAsync(statusChange: FallSensorStatusChange): Promise<void> {
    const device = await findDeviceAsync(statusChange.deviceId);

    if (!device) {
        await createDeviceAsync(statusChange, "active");
        return;
    }

    await updateDeviceStatusAsync(statusChange, "active");

    if (device.citizenUserId !== null) {
        getClient()?.publish(device.mqttTopic, "OK", { qos: 2, retain: false });
    }
}

async function handleOfflineStatusAsync(statusChange: FallSensorStatusChange): Promise<void> {
    const device = await findDeviceAsync(statusChange.deviceId);

    if (!device) {
        await createDeviceAsync(statusChange, "offline");
        return;
    }

    await updateDeviceStatusAsync(statusChange, "offline");
}

async function findDeviceAsync(deviceId: string) {
    const [device] = await dbClient
        .select()
        .from(sensorDevice)
        .where(eq(sensorDevice.serialNumber, deviceId))
        .limit(1);

    return device;
}

async function createDeviceAsync({ deviceId, timestamp }: FallSensorStatusChange, status: "active" | "offline",): Promise<void> {
    console.log(`Device with ID ${deviceId} not found in database. Creating new record.`);

    await dbClient
        .insert(sensorDevice)
        .values({
            serialNumber: deviceId,
            status,
            type: "fall_alarm",
            mqttTopic: `seniorsync/fallsensor/status/callback/${deviceId}`,
            lastSeenAt: timestamp,
        })
        .onConflictDoNothing({ target: sensorDevice.serialNumber });
}

async function updateDeviceStatusAsync({ deviceId, timestamp }: FallSensorStatusChange, status: "active" | "offline",): Promise<void> {
    console.log(`Device with ID ${deviceId} found in database. Updating record.`);
    await dbClient
        .update(sensorDevice)
        .set({ status, lastSeenAt: timestamp })
        .where(eq(sensorDevice.serialNumber, deviceId));
}
