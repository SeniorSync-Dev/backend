import { eq } from "drizzle-orm";
import { dbClient } from "../../db/dbClient";
import { sensorDevice, sensorEvent } from "../../db/schemas";
import { getClient } from "../mqttService";

export interface StatusChange {
    deviceId: string;
    event: "device_online" | "device_offline" | "fall_detected";
    timestamp: Date;
}

export async function handleFallSensorStatusChangeAsync(statusChange: StatusChange): Promise<void> {
    const handlers = {
        device_online: handleOnlineStatusAsync,
        device_offline: handleOfflineStatusAsync,
        fall_detected: handleFallStatusAsync,
    };

    const handler = (handlers as Record<string, (change: StatusChange) => Promise<void>>)[statusChange.event];

    if (!handler) {
        console.warn(`Received unknown fall-sensor event "${statusChange.event}" for device ${statusChange.deviceId}. Ignoring.`);
        return;
    }

    await handler(statusChange);
}

async function handleOnlineStatusAsync(statusChange: StatusChange): Promise<void> {
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

async function handleOfflineStatusAsync(statusChange: StatusChange): Promise<void> {
    const device = await findDeviceAsync(statusChange.deviceId);

    if (!device) {
        await createDeviceAsync(statusChange, "offline");
        return;
    }

    await updateDeviceStatusAsync(statusChange, "offline");
}

export async function handleFallStatusAsync(statusChange: StatusChange): Promise<void> {
    const device = await findDeviceAsync(statusChange.deviceId);
    console.log(`Received fall_detected event for device ${statusChange.deviceId}. Device found: ${!!device}`);
    if (!device) {
        console.warn(`Received fall_detected event for unknown device ${statusChange.deviceId}. Ignoring.`);
        return;
    }

    if (device.citizenUserId === null) {
        console.warn(`Received fall_detected event for device ${statusChange.deviceId} which is not linked to a citizen. Ignoring.`);
        return;
    }

    await dbClient
        .insert(sensorEvent)
        .values({
            deviceId: device.id,
            citizenUserId: device.citizenUserId,
            eventType: "fall_detected",
            severity: "emergency",
            status: "new",
            payload: JSON.stringify(statusChange),
            occurredAt: statusChange.timestamp,
        })
        .onConflictDoNothing({
            target: [
                sensorEvent.deviceId,
                sensorEvent.eventType,
                sensorEvent.occurredAt,
            ],
        });
}

async function findDeviceAsync(deviceId: string) {
    const [device] = await dbClient
        .select()
        .from(sensorDevice)
        .where(eq(sensorDevice.serialNumber, deviceId))
        .limit(1);

    return device;
}

async function createDeviceAsync({ deviceId, timestamp }: StatusChange, status: "active" | "offline",): Promise<void> {
    console.log(`Device with ID ${deviceId} not found in database. Creating new record.`);

    await dbClient
        .insert(sensorDevice)
        .values({
            serialNumber: deviceId,
            status,
            type: "fall_alarm",
            mqttTopic: `seniorsync/fallsensor/callback/${deviceId}`,
            lastSeenAt: timestamp,
        })
        .onConflictDoNothing({ target: sensorDevice.serialNumber });
}

async function updateDeviceStatusAsync({ deviceId, timestamp }: StatusChange, status: "active" | "offline",): Promise<void> {
    console.log(`Device with ID ${deviceId} found in database. Updating record.`);
    await dbClient
        .update(sensorDevice)
        .set({ status, lastSeenAt: timestamp })
        .where(eq(sensorDevice.serialNumber, deviceId));
}
