import { loadDopplerSecrets } from "../../config/load-doppler-secrets";

await loadDopplerSecrets();

const generate = Bun.spawn(
    [
        "bunx",
        "auth@latest",
        "generate",
        // without this, the CLI writes a duplicate schema to ./auth-schema.ts at the repo root
        "--output",
        "./src/db/schemas/auth-schema.ts",
        "--yes",
    ],
    {
        env: { ...process.env },
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
    },
);

const exitCode = await generate.exited;

if (exitCode === 0) {
    const schemaPath = "./src/db/schemas/auth-schema.ts";
    const generatedSchema = await Bun.file(schemaPath).text();
    const legacyRelationsStart = generatedSchema.indexOf(
        "\nexport const userRelations = relations(",
    );

    // Better Auth currently emits Drizzle relations-v1 helpers. The app uses
    // Drizzle relations-v2 in schemas/relations.ts, which owns these mappings.
    const schemaWithoutLegacyRelations = generatedSchema
        .slice(
            0,
            legacyRelationsStart === -1
                ? generatedSchema.length
                : legacyRelationsStart,
        )
        .replace('import { relations } from "drizzle-orm";\n', "");

    await Bun.write(schemaPath, `${schemaWithoutLegacyRelations.trimEnd()}\n`);
}

process.exit(exitCode);
