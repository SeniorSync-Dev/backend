import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { APIError } from "better-auth/api";
import { auth } from "../utils/auth";
import { dbClient } from "../db/dbClient";
import { user, member, organization } from "../db/schemas";

const DEFAULT_ORG_ID = "default";
const ASSIGNABLE_ROLES = [
    "citizen",
    "relative",
    "employee",
    "systemAdmin",
] as const;
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

async function ensureDefaultOrganization() {
    await dbClient
        .insert(organization)
        .values({
            id: DEFAULT_ORG_ID,
            name: "SeniorSync",
            slug: "seniorsync",
            createdAt: new Date(),
        })
        .onConflictDoNothing({ target: organization.id });
}

/**
 * Requires the caller to be a systemAdmin member of the default organization.
 * If nobody is a member yet, the first authenticated caller is bootstrapped as systemAdmin.
 */
async function requireSystemAdmin(headers: Headers) {
    const session = await auth.api.getSession({ headers });
    if (!session) return { error: 401 as const };

    await ensureDefaultOrganization();

    const memberships = await dbClient
        .select()
        .from(member)
        .where(eq(member.organizationId, DEFAULT_ORG_ID));

    if (memberships.length === 0) {
        await auth.api.addMember({
            body: {
                organizationId: DEFAULT_ORG_ID,
                userId: session.user.id,
                role: "systemAdmin",
            },
        });
        return { session };
    }

    const isAdmin = memberships.some(
        (m) => m.userId === session.user.id && m.role === "systemAdmin",
    );
    if (!isAdmin) return { error: 403 as const };

    return { session };
}

export const adminUsersRoute = new Hono()
    .get("/users", async (c) => {
        const auth_ = await requireSystemAdmin(c.req.raw.headers);
        if ("error" in auth_)
            return c.json({ error: "Unauthorized" }, auth_.error);

        const rows = await dbClient
            .select({
                id: user.id,
                name: user.name,
                email: user.email,
                image: user.image,
                createdAt: user.createdAt,
                role: member.role,
            })
            .from(user)
            .leftJoin(
                member,
                and(
                    eq(member.userId, user.id),
                    eq(member.organizationId, DEFAULT_ORG_ID),
                ),
            )
            .orderBy(user.createdAt);

        return c.json({ users: rows });
    })
    .post("/users/:userId/role", async (c) => {
        const auth_ = await requireSystemAdmin(c.req.raw.headers);
        if ("error" in auth_)
            return c.json({ error: "Unauthorized" }, auth_.error);

        const userId = c.req.param("userId");
        const body = await c.req
            .json<{ role?: string }>()
            .catch(() => ({}) as { role?: string });
        if (!ASSIGNABLE_ROLES.includes(body.role as AssignableRole)) {
            return c.json({ error: "Invalid role" }, 400);
        }
        const role = body.role as AssignableRole;

        const [existing] = await dbClient
            .select({ id: member.id })
            .from(member)
            .where(
                and(
                    eq(member.userId, userId),
                    eq(member.organizationId, DEFAULT_ORG_ID),
                ),
            );

        try {
            if (existing) {
                await auth.api.updateMemberRole({
                    headers: c.req.raw.headers,
                    body: {
                        organizationId: DEFAULT_ORG_ID,
                        memberId: existing.id,
                        role,
                    },
                });
            } else {
                await auth.api.addMember({
                    body: { organizationId: DEFAULT_ORG_ID, userId, role },
                });
            }
        } catch (err) {
            if (err instanceof APIError)
                return c.json({ error: err.message }, 400);
            throw err;
        }

        return c.json({ ok: true });
    });
