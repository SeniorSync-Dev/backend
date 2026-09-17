import { Hono } from "hono";
import { asc, eq } from "drizzle-orm";
import { dbClient } from "../../db/dbClient";
import { address, facillity } from "../../db/schemas";
import { auth } from "../../utils/auth";

const facilityRoutes = new Hono();

facilityRoutes.get("/", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    const organizationId = session?.session.activeOrganizationId;
    if (!organizationId)
        return c.json({ message: "No active organization" }, 400);

    const facilities = await dbClient
        .select()
        .from(facillity)
        .where(eq(facillity.organizationId, organizationId))
        .orderBy(asc(facillity.name));
    return c.json(facilities);
});

facilityRoutes.post("/", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json({ message: "Unauthorized" }, 401);

    const organizationId = session.session.activeOrganizationId;
    if (!organizationId)
        return c.json({ message: "No active organization" }, 400);

    const body = await c.req.json();
    const { name, type, street, zipCode, city } = body;
    if (!name || !type || !street || !zipCode || !city) {
        return c.json(
            { message: "name, type, street, zipCode and city er påkrævet" },
            400,
        );
    }

    const [newAddress] = await dbClient
        .insert(address)
        .values({ street, zipCode, city })
        .returning();

    const [newFacility] = await dbClient
        .insert(facillity)
        .values({ organizationId, name, type, addressId: newAddress.id })
        .returning();

    return c.json(newFacility, 201);
});

export default facilityRoutes;
