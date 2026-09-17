import { Hono } from "hono";
import { and, asc, eq, inArray } from "drizzle-orm";
import { dbClient } from "../../db/dbClient";
import { activity, facillity } from "../../db/schemas";
import { auth } from "../../utils/auth";
import { getOrCreateFacilityForOrganizationAsync } from "../../utils/helpers/activityHelper";

const activityRoutes = new Hono();

activityRoutes.get("/", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    const organizationId = session?.session.activeOrganizationId;
    if (!organizationId)
        return c.json({ message: "No active organization" }, 400);

    const facilities = await dbClient
        .select({ id: facillity.id })
        .from(facillity)
        .where(eq(facillity.organizationId, organizationId));
    if (facilities.length === 0) return c.json([]);

    const activities = await dbClient
        .select()
        .from(activity)
        .where(
            inArray(
                activity.organizerFacilityId,
                facilities.map((f) => f.id),
            ),
        )
        .orderBy(asc(activity.startsAt));
    return c.json(activities);
});

activityRoutes.post("/", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json({ message: "Unauthorized" }, 401);

    const organizationId = session.session.activeOrganizationId;
    if (!organizationId)
        return c.json({ message: "No active organization" }, 400);

    const body = await c.req.json();
    const {
        title,
        type,
        startsAt,
        endsAt,
        capacity,
        locationName,
        facilityId,
    } = body;
    if (!title || !startsAt || !endsAt) {
        return c.json(
            { message: "title, startsAt and endsAt er påkrævet" },
            400,
        );
    }

    const facility = facilityId
        ? (
              await dbClient
                  .select()
                  .from(facillity)
                  .where(
                      and(
                          eq(facillity.id, facilityId),
                          eq(facillity.organizationId, organizationId),
                      ),
                  )
                  .limit(1)
          )[0]
        : await getOrCreateFacilityForOrganizationAsync(organizationId);
    if (!facility) return c.json({ message: "Ukendt lokation" }, 400);

    const [created] = await dbClient
        .insert(activity)
        .values({
            organizerFacilityId: facility.id,
            createdByUserId: session.user.id,
            title,
            type: type ?? "other",
            startsAt: new Date(startsAt),
            endsAt: new Date(endsAt),
            capacity: capacity ? Number(capacity) : null,
            locationName: locationName || null,
        })
        .returning();

    return c.json(created, 201);
});

activityRoutes.delete("/:id", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json({ message: "Unauthorized" }, 401);

    await dbClient.delete(activity).where(eq(activity.id, c.req.param("id")));
    return c.body(null, 204);
});

export default activityRoutes;
