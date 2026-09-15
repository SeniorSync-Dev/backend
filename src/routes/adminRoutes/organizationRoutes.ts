import { Hono } from "hono";
import { dbClient } from "../../db/dbClient";
import { auth } from "../../utils/auth";

const organizationRoutes = new Hono<{
    Variables: {
        user: typeof auth.$Infer.Session.user | null;
        session: typeof auth.$Infer.Session.session | null
    }
}>();

organizationRoutes.get("/", (c) => {
    return c.json({ message: "organization route" });
});
