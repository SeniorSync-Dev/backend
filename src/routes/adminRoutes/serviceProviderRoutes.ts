import { Hono } from "hono";
import { and, asc, eq } from "drizzle-orm";
import { dbClient } from "../../db/dbClient";
import {
    member,
    serviceProviderCompany,
    serviceProviderCompanyStaff,
    user,
} from "../../db/schemas";
import { auth } from "../../utils/auth";

const serviceProviderRoutes = new Hono();

async function requireSystemAdminAsync(userId: string, organizationId: string) {
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
    return member_?.role === "systemAdmin";
}

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
        .select({ company: serviceProviderCompany })
        .from(serviceProviderCompanyStaff)
        .innerJoin(
            serviceProviderCompany,
            eq(
                serviceProviderCompanyStaff.companyId,
                serviceProviderCompany.id,
            ),
        )
        .where(eq(serviceProviderCompanyStaff.userId, session.user.id))
        .limit(1);

    return c.json({ company: staff?.company ?? null });
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

serviceProviderRoutes.get("/staff", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json({ message: "Unauthorized" }, 401);

    const organizationId = session.session.activeOrganizationId;
    if (!organizationId)
        return c.json({ message: "No active organization" }, 400);

    if (!(await requireSystemAdminAsync(session.user.id, organizationId))) {
        return c.json(
            {
                message:
                    "Kun systemadministratorer kan se serviceudbyderes medarbejdere",
            },
            403,
        );
    }

    const staff = await dbClient
        .select({
            userId: serviceProviderCompanyStaff.userId,
            userName: user.name,
            userEmail: user.email,
            companyId: serviceProviderCompany.id,
            companyName: serviceProviderCompany.name,
        })
        .from(serviceProviderCompanyStaff)
        .innerJoin(
            serviceProviderCompany,
            eq(
                serviceProviderCompanyStaff.companyId,
                serviceProviderCompany.id,
            ),
        )
        .innerJoin(user, eq(serviceProviderCompanyStaff.userId, user.id))
        .where(eq(serviceProviderCompany.organizationId, organizationId))
        .orderBy(asc(serviceProviderCompany.name), asc(user.name));

    return c.json(staff);
});

serviceProviderRoutes.put("/staff/:userId", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json({ message: "Unauthorized" }, 401);

    const organizationId = session.session.activeOrganizationId;
    if (!organizationId)
        return c.json({ message: "No active organization" }, 400);

    if (!(await requireSystemAdminAsync(session.user.id, organizationId))) {
        return c.json(
            { message: "Kun systemadministratorer kan flytte medarbejdere" },
            403,
        );
    }

    const targetUserId = c.req.param("userId");
    const { companyId } = await c.req.json();
    if (!companyId) return c.json({ message: "companyId er påkrævet" }, 400);

    const [company] = await dbClient
        .select({ id: serviceProviderCompany.id })
        .from(serviceProviderCompany)
        .where(
            and(
                eq(serviceProviderCompany.id, companyId),
                eq(serviceProviderCompany.organizationId, organizationId),
            ),
        )
        .limit(1);
    if (!company) return c.json({ message: "Ukendt serviceudbyder" }, 400);

    const [updated] = await dbClient
        .update(serviceProviderCompanyStaff)
        .set({ companyId })
        .where(eq(serviceProviderCompanyStaff.userId, targetUserId))
        .returning();
    if (!updated) return c.json({ message: "Medarbejderen findes ikke" }, 404);

    return c.json(updated);
});

serviceProviderRoutes.delete("/staff/:userId", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json({ message: "Unauthorized" }, 401);

    const organizationId = session.session.activeOrganizationId;
    if (!organizationId)
        return c.json({ message: "No active organization" }, 400);

    if (!(await requireSystemAdminAsync(session.user.id, organizationId))) {
        return c.json(
            { message: "Kun systemadministratorer kan fjerne medarbejdere" },
            403,
        );
    }

    const targetUserId = c.req.param("userId");

    // Scope the delete to this org so admins can't touch other orgs' staff
    const [target] = await dbClient
        .select({ userId: serviceProviderCompanyStaff.userId })
        .from(serviceProviderCompanyStaff)
        .innerJoin(
            serviceProviderCompany,
            eq(
                serviceProviderCompanyStaff.companyId,
                serviceProviderCompany.id,
            ),
        )
        .where(
            and(
                eq(serviceProviderCompanyStaff.userId, targetUserId),
                eq(serviceProviderCompany.organizationId, organizationId),
            ),
        )
        .limit(1);
    if (!target) return c.json({ message: "Medarbejderen findes ikke" }, 404);

    await dbClient
        .delete(serviceProviderCompanyStaff)
        .where(eq(serviceProviderCompanyStaff.userId, targetUserId));

    return c.body(null, 204);
});

export default serviceProviderRoutes;
