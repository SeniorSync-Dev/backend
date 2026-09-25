const API_BASE = "https://api.cloudflare.com/client/v4";
const PRESET = "group_call_participant";

// RealtimeKit pakker svaret i "data" 
// Ikke i "result", som resten af Cloudflares client/v4-API bruger.
type RealtimeKitEnvelope<T> = {
    success: boolean;
    errors?: Array<{ code: number; message: string }>;
    data: T;
};

function config() {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const appId = process.env.CLOUDFLARE_REALTIME_APP_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !appId || !apiToken) {
        throw new Error(
            "Cloudflare RealtimeKit er ikke konfigureret. Sæt CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_REALTIME_APP_ID og CLOUDFLARE_API_TOKEN.",
        );
    }

    return { accountId, appId, apiToken };
}

async function requestAsync<T>(
    path: string,
    body?: unknown,
    method: "POST" | "PATCH" = "POST",
): Promise<T> {
    const { accountId, appId, apiToken } = config();

    const response = await fetch(
        `${API_BASE}/accounts/${accountId}/realtime/kit/${appId}${path}`,
        {
            method,
            headers: {
                Authorization: `Bearer ${apiToken}`,
                "Content-Type": "application/json",
            },
            body: body === undefined ? undefined : JSON.stringify(body),
        },
    );

    const payload = (await response.json()) as RealtimeKitEnvelope<T>;

    if (!response.ok || !payload.success) {
        const reason =
            payload.errors?.map((error) => error.message).join(", ") ??
            `HTTP ${response.status}`;
        throw new Error(`Cloudflare RealtimeKit svarede med fejl: ${reason}`);
    }

    return payload.data;
}

export async function createMeetingAsync(title: string) {
    const result = await requestAsync<{ id: string }>("/meetings", { title });
    return result.id;
}

export async function addParticipantAsync(
    meetingId: string,
    participant: { userId: string; name: string },
) {
    const result = await requestAsync<{ id: string; token: string }>(
        `/meetings/${meetingId}/participants`,
        {
            name: participant.name,
            preset_name: PRESET,
            custom_participant_id: participant.userId,
        },
    );

    return result.token;
}

export async function endMeetingAsync(meetingId: string) {
    await requestAsync(`/meetings/${meetingId}/active-session/kick-all`);
    await requestAsync(`/meetings/${meetingId}`, { status: "INACTIVE" }, "PATCH");
}
