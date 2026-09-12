import DopplerSDK from "@dopplerhq/node-sdk";

const requiredSecrets = [
    "DATABASE_URL",
    "BETTER_AUTH_SECRET",
    "BETTER_AUTH_URL",
    "ENCRYPTION_KEY",
    "MITID_CLIENT_ID",
    "MITID_CLIENT_SECRET",
    "MITID_DISCOVERY_URL",
] as const;

export async function loadDopplerSecrets(): Promise<void> {
    const accessToken = process.env.DOPPLER_TOKEN;
    const project = process.env.DOPPLER_PROJECT;
    const config = process.env.DOPPLER_CONFIG;

    if (!accessToken || !project || !config) {
        throw new Error(
            "DOPPLER_TOKEN, DOPPLER_PROJECT, and DOPPLER_CONFIG must be set before starting the backend",
        );
    }

    try {
        const doppler = new DopplerSDK({ accessToken });
        const secrets = await doppler.secrets.download(project, config, {
            format: "json",
        });

        for (const [name, value] of Object.entries(secrets)) {
            if (typeof value === "string") {
                process.env[name] = value;
            }
        }
    } catch (error) {
        throw new Error("Unable to load secrets from Doppler", {
            cause: error,
        });
    }

    const missingSecrets = requiredSecrets.filter((name) => !process.env[name]);
    if (missingSecrets.length > 0) {
        throw new Error(
            `Missing required Doppler secrets: ${missingSecrets.join(", ")}`,
        );
    }
}
