import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./utils/auth";

const app = new Hono();

app.use(
    "*",
    cors({
        origin: [
            "http://localhost:3001",
            "http://localhost:3000",
            "https://app.recuro.dk",
        ],
        allowHeaders: ["Content-Type", "Authorization"],
        allowMethods: ["POST", "GET", "OPTIONS", "PUT", "DELETE"],
        exposeHeaders: ["Content-Length"],
        maxAge: 600,
        credentials: true,
    }),
);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.get("/", (c) => c.text("Hello Hono!"));

export default app;
