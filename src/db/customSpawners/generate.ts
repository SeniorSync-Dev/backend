import { loadDopplerSecrets } from "../../config/load-doppler-secrets";

await loadDopplerSecrets();

const generate = Bun.spawn(["bunx", "drizzle-kit", "generate"], {
    env: { ...process.env },
    stdout: "inherit",
    stderr: "inherit",
});

process.exit(await generate.exited);
