// Alt der taler med Cloudflare RealtimeKit ligger her, så resten af koden kun
// kender til "opret et møde" og "giv mig en token".
// Dokumentation: https://developers.cloudflare.com/realtime/realtimekit/

const API_BASE = "https://api.cloudflare.com/client/v4";

// Begge parter i et skærmbesøg er ligestillede: de kommer direkte ind og har
// kamera og mikrofon. "guest" ville kræve at nogen lukker dem ind, og "host"
// giver moderator-rettigheder der ikke er nogen at bruge på i en 1:1-samtale.
const PRESET = "group_call_participant";

type CloudflareEnvelope<T> = {
    success: boolean;
    errors: Array<{ code: number; message: string }>;
    result: T;
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

async function requestAsync<T>(path: string, body: unknown): Promise<T> {
    const { accountId, appId, apiToken } = config();

    const response = await fetch(
        `${API_BASE}/accounts/${accountId}/realtime/kit/${appId}${path}`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        },
    );

    const payload = (await response.json()) as CloudflareEnvelope<T>;

    if (!response.ok || !payload.success) {
        // Cloudflares fejltekster er ikke noget vi viser en borger, så de
        // bliver her og bliver til en generisk 502 længere oppe.
        const reason =
            payload.errors?.map((error) => error.message).join(", ") ??
            `HTTP ${response.status}`;
        throw new Error(`Cloudflare RealtimeKit svarede med fejl: ${reason}`);
    }

    return payload.result;
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
