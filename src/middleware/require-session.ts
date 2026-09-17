import { createMiddleware } from "hono/factory";
import { auth } from "../utils/auth";

type Session = typeof auth.$Infer.Session;

export type SessionVariables = {
    user: Session["user"];
    session: Session["session"];
};

export const requireSession = createMiddleware<{ Variables: SessionVariables }>(
    async (c, next) => {
        const session = await auth.api.getSession({ headers: c.req.raw.headers });

        if (!session) {
            return c.json({ error: "Du er ikke logget ind." }, 401);
        }

        c.set("user", session.user);
        c.set("session", session.session);
        await next();
    },
);
