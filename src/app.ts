import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./utils/auth";
import activityRoutes from "./routes/adminRoutes/activityRoutes";
import facilityRoutes from "./routes/adminRoutes/facilityRoutes";
import visitRoutes from "./routes/adminRoutes/visitRoutes";
import citizenRoutes from "./routes/citizenRoutes/citizen";
import relativeRoutes from "./routes/relativeRoutes/relative";

const app = new Hono();

app.use(
    "*",
    cors({
        origin: ["http://localhost:3001", "http://localhost:3000"],
        allowHeaders: ["Content-Type", "Authorization"],
        allowMethods: ["POST", "GET", "OPTIONS", "PUT", "PATCH", "DELETE"],
        exposeHeaders: ["Content-Length"],
        maxAge: 600,
        credentials: true,
    }),
);

app.onError((error, c) => {
    console.error(error);
    return c.json({ error: "Der opstod en fejl. Prøv venligst igen." }, 500);
});

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.route("/api/activities", activityRoutes);
app.route("/api/facilities", facilityRoutes);
app.route("/api/visits", visitRoutes);
app.route("/citizen", citizenRoutes);
app.route("/relative", relativeRoutes);

app.get("/", (c) => c.text("Hello Hono!"));

export default app;
