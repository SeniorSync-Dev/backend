import { loadDopplerSecrets } from "../../config/load-doppler-secrets";

await loadDopplerSecrets();

// Import database modules only after Doppler has populated DATABASE_URL.
const [{ dbClient }, { organization }, { eq }] = await Promise.all([
  import("../dbClient"),
  import("../schemas/auth-schema"),
  import("drizzle-orm"),
]);

const [name = "Soenderborg Kommune", slug = "soenderborg-kommune"] =
  process.argv.slice(2);

const existingOrganization = await dbClient
  .select({ id: organization.id, name: organization.name, slug: organization.slug })
  .from(organization)
  .where(eq(organization.slug, slug))
  .limit(1);

if (existingOrganization[0]) {
  console.log(
    `Organization already exists: ${existingOrganization[0].name} (${existingOrganization[0].slug})`,
  );
} else {
  await dbClient.insert(organization).values({
    id: crypto.randomUUID(),
    name,
    slug,
    createdAt: new Date(),
  });

  console.log(`Seeded organization: ${name} (${slug})`);
}
