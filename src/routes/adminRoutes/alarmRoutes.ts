import { Hono } from "hono";
import { asc, eq } from "drizzle-orm";
import { dbClient } from "../../db/dbClient";
import { address, facillity } from "../../db/schemas";
import { auth } from "../../utils/auth";

const alarmRoutes = new Hono();

export default alarmRoutes;
