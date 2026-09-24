import { Hono } from "hono";
import { and, asc, eq, inArray } from "drizzle-orm";
import { dbClient } from "../../db/dbClient";
import {
    activity,
    facillity,
    member,
    serviceProviderCompany,
    serviceProviderCompanyStaff,
} from "../../db/schemas";
import { auth } from "../../utils/auth";
import { getOrCreateFacilityForOrganizationAsync } from "../../utils/helpers/activityHelper";

const activityRoutes = new Hono();

async function getMemberRoleAsync(userId: string, organizationId: string) {
    const [member_] = await dbClient
        .select({ role: member.role })
        .from(member)
        .where(
            and(
                eq(member.userId, userId),
                eq(member.organizationId, organizationId),
            ),
        )
        .limit(1);
    return member_?.role;
}

async function getServiceProviderCompanyIdAsync(userId: string) {
    const [staff] = await dbClient
        .select({ companyId: serviceProviderCompanyStaff.companyId })
        .from(serviceProviderCompanyStaff)
        .where(eq(serviceProviderCompanyStaff.userId, userId))
        .limit(1);
    return staff?.companyId ?? null;
}

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
        .select({
            id: activity.id,
            organizerFacilityId: activity.organizerFacilityId,
            createdByUserId: activity.createdByUserId,
            providerCompanyId: activity.providerCompanyId,
            providerCompanyName: serviceProviderCompany.name,
            title: activity.title,
            type: activity.type,
            startsAt: activity.startsAt,
            endsAt: activity.endsAt,
            capacity: activity.capacity,
            status: activity.status,
            locationName: activity.locationName,
        })
        .from(activity)
        .leftJoin(
            serviceProviderCompany,
            eq(activity.providerCompanyId, serviceProviderCompany.id),
        )
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

    const role = await getMemberRoleAsync(session.user.id, organizationId);
    if (
        role !== "employee" &&
        role !== "systemAdmin" &&
        role !== "servicePartner"
    ) {
        return c.json(
            { message: "Du har ikke adgang til at oprette aktiviteter" },
            403,
        );
    }

    let providerCompanyId: string | null = null;
    if (role === "servicePartner") {
        providerCompanyId = await getServiceProviderCompanyIdAsync(
            session.user.id,
        );
        if (!providerCompanyId) {
            return c.json(
                {
                    message:
                        "Din konto er ikke tilknyttet en serviceudbyder endnu",
                },
                400,
            );
        }
    }

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
            { message: "title, startsAt og endsAt er påkrævet" },
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
            providerCompanyId,
            title,
            type: type ?? "other",
            startsAt: new Date(startsAt),
            endsAt: new Date(endsAt),
            capacity: capacity ? Number(capacity) : null,
            locationName: locationName || null,
            status: "published",
        })
        .returning();

    return c.json(created, 201);
});

activityRoutes.put("/:id", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json({ message: "Unauthorized" }, 401);

    const organizationId = session.session.activeOrganizationId;
    if (!organizationId)
        return c.json({ message: "No active organization" }, 400);

    const role = await getMemberRoleAsync(session.user.id, organizationId);
    if (
        role !== "employee" &&
        role !== "systemAdmin" &&
        role !== "servicePartner"
    ) {
        return c.json(
            { message: "Du har ikke adgang til at redigere aktiviteter" },
            403,
        );
    }

    const activityId = c.req.param("id");
    const [target] = await dbClient
        .select({
            id: activity.id,
            providerCompanyId: activity.providerCompanyId,
        })
        .from(activity)
        .innerJoin(facillity, eq(activity.organizerFacilityId, facillity.id))
        .where(
            and(
                eq(activity.id, activityId),
                eq(facillity.organizationId, organizationId),
            ),
        )
        .limit(1);
    if (!target) return c.json({ message: "Aktiviteten findes ikke" }, 404);

    if (role === "servicePartner") {
        const companyId = await getServiceProviderCompanyIdAsync(
            session.user.id,
        );
        if (!companyId || target.providerCompanyId !== companyId) {
            return c.json(
                {
                    message:
                        "Du kan kun redigere din egen serviceudbyders aktiviteter",
                },
                403,
            );
        }
    }

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
            { message: "title, startsAt og endsAt er påkrævet" },
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

    const [updated] = await dbClient
        .update(activity)
        .set({
            organizerFacilityId: facility.id,
            title,
            type: type ?? "other",
            startsAt: new Date(startsAt),
            endsAt: new Date(endsAt),
            capacity: capacity ? Number(capacity) : null,
            locationName: locationName || null,
        })
        .where(eq(activity.id, activityId))
        .returning();

    return c.json(updated);
});

activityRoutes.delete("/:id", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json({ message: "Unauthorized" }, 401);

    const organizationId = session.session.activeOrganizationId;
    if (!organizationId)
        return c.json({ message: "No active organization" }, 400);

    const role = await getMemberRoleAsync(session.user.id, organizationId);
    if (
        role !== "employee" &&
        role !== "systemAdmin" &&
        role !== "servicePartner"
    ) {
        return c.json(
            { message: "Du har ikke adgang til at slette aktiviteter" },
            403,
        );
    }

    const activityId = c.req.param("id");
    const [target] = await dbClient
        .select({
            id: activity.id,
            providerCompanyId: activity.providerCompanyId,
        })
        .from(activity)
        .innerJoin(facillity, eq(activity.organizerFacilityId, facillity.id))
        .where(
            and(
                eq(activity.id, activityId),
                eq(facillity.organizationId, organizationId),
            ),
        )
        .limit(1);
    if (!target) return c.json({ message: "Aktiviteten findes ikke" }, 404);

    if (role === "servicePartner") {
        const companyId = await getServiceProviderCompanyIdAsync(
            session.user.id,
        );
        if (!companyId || target.providerCompanyId !== companyId) {
            return c.json(
                {
                    message:
                        "Du kan kun slette din egen serviceudbyders aktiviteter",
                },
                403,
            );
        }
    }

    await dbClient.delete(activity).where(eq(activity.id, activityId));
    return c.body(null, 204);
});

export default activityRoutes;
