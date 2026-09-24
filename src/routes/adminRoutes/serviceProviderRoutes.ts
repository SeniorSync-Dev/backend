import { Hono } from "hono";
import { and, asc, eq } from "drizzle-orm";
import { dbClient } from "../../db/dbClient";
import {
    member,
    serviceProviderCompany,
    serviceProviderCompanyStaff,
} from "../../db/schemas";
import { auth } from "../../utils/auth";

const serviceProviderRoutes = new Hono();

serviceProviderRoutes.get("/", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    const organizationId = session?.session.activeOrganizationId;
    if (!organizationId)
        return c.json({ message: "No active organization" }, 400);

    const companies = await dbClient
        .select()
        .from(serviceProviderCompany)
        .where(eq(serviceProviderCompany.organizationId, organizationId))
        .orderBy(asc(serviceProviderCompany.name));
    return c.json(companies);
});

serviceProviderRoutes.get("/me", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json({ message: "Unauthorized" }, 401);

    const [staff] = await dbClient
        .select({ companyId: serviceProviderCompanyStaff.companyId })
        .from(serviceProviderCompanyStaff)
        .where(eq(serviceProviderCompanyStaff.userId, session.user.id))
        .limit(1);

    return c.json({ companyId: staff?.companyId ?? null });
});

serviceProviderRoutes.post("/", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json({ message: "Unauthorized" }, 401);

    const organizationId = session.session.activeOrganizationId;
    if (!organizationId)
        return c.json({ message: "No active organization" }, 400);

    const [member_] = await dbClient
        .select({ role: member.role })
        .from(member)
        .where(
            and(
                eq(member.userId, session.user.id),
                eq(member.organizationId, organizationId),
            ),
        )
        .limit(1);
    if (
        !member_ ||
        (member_.role !== "employee" && member_.role !== "systemAdmin")
    ) {
        return c.json(
            { message: "Kun medarbejdere kan oprette serviceudbydere" },
            403,
        );
    }

    const body = await c.req.json();
    const { name, category, phone, email } = body;
    if (!name) return c.json({ message: "name er påkrævet" }, 400);

    const [created] = await dbClient
        .insert(serviceProviderCompany)
        .values({
            organizationId,
            name,
            category: category ?? "other",
            phone: phone || null,
            email: email || null,
        })
        .returning();

    return c.json(created, 201);
});

export default serviceProviderRoutes;
