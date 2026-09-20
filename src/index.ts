import { loadDopplerSecrets } from "./config/load-doppler-secrets";
import { connectMqtt } from "./utils/mqttService";

await loadDopplerSecrets();
connectMqtt();

const { default: app } = await import("./app");

export default app;
