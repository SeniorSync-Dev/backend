import { dbClient } from "../../db/dbClient";
import { address, facillity } from "../../db/schemas";
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
    
}

async function handleOfflineStatusAsync(statusChange: FallSensorStatusChange): Promise<void> {
    
}