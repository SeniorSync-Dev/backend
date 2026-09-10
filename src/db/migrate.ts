import { loadDopplerSecrets } from "../config/load-doppler-secrets";

await loadDopplerSecrets();

const migration = Bun.spawn(["bunx", "drizzle-kit", "migrate"], {
    stdout: "inherit",
    stderr: "inherit",
});

process.exit(await migration.exited);
