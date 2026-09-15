import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import * as schema from "../db/schemas";
import dbClient from "../db/dbClient";
import { admin as adminPlugin, genericOAuth } from "better-auth/plugins";
import { createAuthMiddleware, getOAuthState } from "better-auth/api";
import { ac, admin, relative, citizen, employee } from "./accessController";
import { hashNin } from "./cryptoService";
import { and, eq, isNull } from "drizzle-orm";

export const auth = betterAuth({
    baseURL: process.env.BETTER_AUTH_URL,
    emailAndPassword: {
        enabled: false,
    },

    database: drizzleAdapter(dbClient, {
        provider: "pg",
        schema: schema,
    }),

    user: {
        additionalFields: {
            birthdate: {
                type: "string",
                required: false,
            },
            nin: {
                type: "string",
                required: false,
            },
            ninHash: {
                type: "string",
                required: false,
            },
            mitidUuid: {
                type: "string",
                required: false,
            },
        },
    },

    plugins: [
        adminPlugin({
            ac,
            adminRole: admin,
            defaultRole: "relative",
            roles: {
                relative: relative,
                citizen: citizen,
                employee: employee,
                admin: admin,
            },
        }),
        genericOAuth({
            config: [
                {
                    providerId: "mitid",
                    clientId: process.env.MITID_CLIENT_ID!,
                    clientSecret: process.env.MITID_CLIENT_SECRET!,
                    discoveryUrl: process.env.MITID_DISCOVERY_URL!,
                    scopes: [
                        "openid",
                        "profile",
                        "email",
                        "nin",
                        "mitid-extra",
                    ],
                    mapProfileToUser: (profile) => {
                        const nin = (profile.nin as string | undefined) ?? null;

                        return {
                            name:
                                profile.name ??
                                `${profile.given_name ?? ""} ${profile.family_name ?? ""}`.trim(),

                            email:
                                profile.email ??
                                `${profile.mitid_uuid}@mitid.invalid`,

                            birthdate: profile.birthdate ?? null,
                            nin,
                            ninHash: nin ? hashNin(nin) : null,
                            mitidUuid: profile.mitid_uuid ?? null,
                        };
                    },
                },
            ],
        }),
    ],

    hooks: {
        after: createAuthMiddleware(async (ctx) => {
            console.log("Request path:", ctx.path);
            // Only run this hook for the MitID callback route
            if (ctx.path !== "/callback/:id") {
                return;
            }

            const session = ctx.context.newSession;

            if (!session?.user) {
                return;
            }

            const userId = session.user.id;

            // Employees are pre-registered by an admin with their CPR, so match
            // them by nin hash before falling back to self-declared account types.
            const ninHash = (session.user as { ninHash?: string | null })
                .ninHash;

            if (ninHash) {
                const [matchedEmployee] = await dbClient
                    .update(schema.employee)
                    .set({ userId })
                    .where(
                        and(
                            eq(schema.employee.ninHash, ninHash),
                            isNull(schema.employee.userId),
                        ),
                    )
                    .returning();

                if (matchedEmployee) {
                    //TODO - Set the role to "employee" for the user
                    return;
                }
            }

            // Get the OAuth state from the request, which contains the account type
            const oauthState = await getOAuthState<{
                accountype: "citizen" | "relative";
            }>();

            const accountType = oauthState?.accountType;
            console.log("Account type from OAuth state:", accountType);
            if (!accountType) {
                return;
            }

            const allowedAccountTypes = ["citizen", "relative"] as const;

            if (!allowedAccountTypes.includes(accountType)) {
                console.error(`Invalid account type: ${accountType}`);
                throw new Error(`Invalid account type: ${accountType}`);
            }

            switch (accountType) {
                case "citizen": {
                    await dbClient
                        .insert(schema.citizen)
                        .values({
                            userId,
                        })
                        .onConflictDoNothing();
                    const headers = ctx.headers ?? ctx.request?.headers;
                    if (!headers) {
                        return;
                    }

                    await auth.api.setRole({
                        body: {
                            userId,
                            role: "citizen",
                        },
                        headers,
                    });
                    break;
                }

                case "relative": {
                    await dbClient
                        .insert(schema.relative)
                        .values({
                            userId,
                        })
                        .onConflictDoNothing();
                    const headers = ctx.headers ?? ctx.request?.headers;
                    if (!headers) {
                        return;
                    }

                    await auth.api.setRole({
                        body: {
                            userId,
                            role: "relative",
                        },
                        headers,
                    });
                    break;
                }
            }
        }),
    },

    trustedOrigins: ["http://localhost:3000", "http://localhost:3001"],
});
