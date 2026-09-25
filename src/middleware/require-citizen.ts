import { createMiddleware } from "hono/factory";
import { eq } from "drizzle-orm";
import { dbClient } from "../db/dbClient";
import { citizen } from "../db/schemas";
import type { SessionVariables } from "./require-session";

export type CitizenVariables = SessionVariables & {
    citizenUserId: string;
};

export const requireCitizen = createMiddleware<{ Variables: CitizenVariables }>(
    async (c, next) => {
        const [row] = await dbClient
            .select({ userId: citizen.userId })
            .from(citizen)
            .where(eq(citizen.userId, c.get("user").id))
            .limit(1);

        if (!row) {
            return c.json({ error: "Du er ikke registreret som borger." }, 403);
        }

        c.set("citizenUserId", row.userId);
        await next();
    },
);
