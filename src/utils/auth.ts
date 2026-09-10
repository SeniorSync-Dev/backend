import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import * as schema from "../db/schemas";
import dbClient from "../db/dbClient";
import { admin, genericOAuth } from "better-auth/plugins";

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
            mitidUuid: {
                type: "string",
                required: false,
            },
        },
    },

    plugins: [
        admin(),
        genericOAuth({
            config: [
                {
                    providerId: "mitid",
                    clientId: process.env.MITID_CLIENT_ID!,
                    clientSecret: process.env.MITID_CLIENT_SECRET!,
                    discoveryUrl:
                        "https://seniorsync.sandbox.signicat.com/auth/open/.well-known/openid-configuration",
                    scopes: [
                        "openid",
                        "profile",
                        "email",
                        "nin",
                        "mitid-extra",
                    ],
                    mapProfileToUser: (profile) => {
                        return {
                            name:
                                profile.name ??
                                `${profile.given_name ?? ""} ${profile.family_name ?? ""}`.trim(),

                            email:
                                profile.email ??
                                `${profile.mitid_uuid}@mitid.invalid`,

                            birthdate: profile.birthdate ?? null,
                            nin: profile.nin ?? null,
                            mitidUuid: profile.mitid_uuid ?? null,
                        };
                    },
                },
            ],
        }),
    ],

    trustedOrigins: ["http://localhost:3000", "http://localhost:3001"],
});
