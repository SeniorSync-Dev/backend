import { createMiddleware } from "hono/factory";
import { eq } from "drizzle-orm";
import { dbClient } from "../db/dbClient";
import { relative } from "../db/schemas";
import type { SessionVariables } from "./require-session";

export type RelativeVariables = SessionVariables & {
    relativeUserId: string;
};

export const requireRelative = createMiddleware<{
    Variables: RelativeVariables;
}>(async (c, next) => {
    const [row] = await dbClient
        .select({ userId: relative.userId })
        .from(relative)
        .where(eq(relative.userId, c.get("user").id))
        .limit(1);

    if (!row) {
        return c.json({ error: "Du er ikke registreret som pårørende." }, 403);
    }

    c.set("relativeUserId", row.userId);
    await next();
});
