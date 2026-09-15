import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./utils/auth";
import { adminUsersRoute } from "./routes/adminUsers";

const app = new Hono();

app.use(
    "*",
    cors({
        origin: ["http://localhost:3001", "http://localhost:3000"],
        allowHeaders: ["Content-Type", "Authorization"],
        allowMethods: ["POST", "GET", "OPTIONS", "PUT", "DELETE"],
        exposeHeaders: ["Content-Length"],
        maxAge: 600,
        credentials: true,
    }),
);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));
app.route("/api/admin", adminUsersRoute);

app.get("/", (c) => c.text("Hello Hono!"));

export default app;
