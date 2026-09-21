import { loadDopplerSecrets } from "./config/load-doppler-secrets";

await loadDopplerSecrets();

const { connectMqtt } = await import("./utils/mqttService");
connectMqtt();

const { default: app } = await import("./app");

export default app;
