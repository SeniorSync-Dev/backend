import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import * as schema from "../db/schemas";
import { dbClient } from "../db/dbClient";
import { organization, genericOAuth } from "better-auth/plugins";
import {
    getInitialOrganizationAsync,
    getActiveOrganizationIdForUserAsync,
    linkCitizenToFacilityAsync,
} from "./helpers/organizationHelper";
import {
    ac,
    systemAdmin,
    relative,
    citizen,
    servicePartner,
    employee,
} from "./accessController";

export const auth = betterAuth({
    baseURL: process.env.BETTER_AUTH_URL,
    emailAndPassword: {
        enabled: false,
    },

    database: drizzleAdapter(dbClient, {
        provider: "pg",
        schema: schema,
    }),

    account: {
        accountLinking: {
            enabled: true,
            // MitID is a trusted government IdP, and our synthetic MitID email is
            // never "verified" locally, so require neither to auto-link the same
            // MitID identity across the citizen/relative and employee sign-in flows.
            trustedProviders: ["mitid"],
            requireLocalEmailVerified: false,
        },
    },

    user: {
        changeEmail: {
            enabled: true,
            updateEmailWithoutVerification: true,
        },
        additionalFields: {
            birthdate: {
                type: "string",
                required: false,
            },
            nin: {
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
        organization({
            ac,
            roles: {
                systemAdmin,
                relative,
                citizen,
                servicePartner,
                employee,
            },
            creatorRole: "systemAdmin",
            schema: {
                invitation: {
                    additionalFields: {
                        facilityId: {
                            type: "string",
                            required: false,
                        },
                    },
                },
            },
            organizationHooks: {
                afterAcceptInvitation: async ({ invitation, user }) => {
                    const facilityId = invitation.facilityId as
                        | string
                        | null
                        | undefined;
                    if (invitation.role !== "citizen" || !facilityId) return;

                    await linkCitizenToFacilityAsync(user.id, facilityId);
                },
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
                    postLogoutRedirectURI: "http://localhost:3001/",
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
                            mitidUuid: profile.mitid_uuid ?? null,
                        };
                    },
                },
            ],
        }),
    ],

    databaseHooks: {
        session: {
            create: {
                before: async (session) => {
                    const existingActiveOrganizationId =
                        await getActiveOrganizationIdForUserAsync(
                            session.userId,
                        );

                    console.info(
                        "[auth] session create active organization resolved",
                        {
                            hasExistingActiveOrganization: Boolean(
                                existingActiveOrganizationId,
                            ),
                        },
                    );

                    const organization = existingActiveOrganizationId
                        ? null
                        : await getInitialOrganizationAsync(session.userId);

                    return {
                        data: {
                            ...session,
                            activeOrganizationId:
                                existingActiveOrganizationId ??
                                organization?.id,
                        },
                    };
                },
            },
        },
    },

    trustedOrigins: ["http://localhost:3000", "http://localhost:3001"],
});
