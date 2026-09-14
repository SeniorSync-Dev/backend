import { loadDopplerSecrets } from "./config/load-doppler-secrets";

await loadDopplerSecrets();

const { default: app } = await import("./app");

export default app;
