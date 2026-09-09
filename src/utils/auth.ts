import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import * as schema from '../db/schemas';
import dbClient from "../db/dbClient";
import { admin, genericOAuth } from "better-auth/plugins"

export const auth = betterAuth({
    baseURL: process.env.AUTH_BASE_URL || "http://localhost:3000",
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
                    clientId: "sandbox-pompous-blade-464",
                    clientSecret: "YhScfzg326C9mmYS7qLfMSPhEwKHPqz4bK0xLoIVtsaPPE9c",
                    discoveryUrl: "https://seniorsync.sandbox.signicat.com/auth/open/.well-known/openid-configuration",
                    scopes: [
                        "openid",
                        "profile",
                        "email",
                        "nin",
                        "mitid-extra",
                    ],
                    mapProfileToUser: (profile) => {
                        return {
                            name: profile.name ??
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

            ]
        })
    ],

    trustedOrigins: ["http://localhost:3000", "http://localhost:3001"],
});