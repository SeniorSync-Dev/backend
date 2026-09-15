import { drizzle } from "drizzle-orm/node-postgres";

if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
}

// Keep Better Auth independent of the application relation graph. This also
// lets `auth generate` create auth-schema.ts before that graph is loaded.
export const dbClient = drizzle(process.env.DATABASE_URL);

