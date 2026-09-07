import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import * as schema from '../db/schemas';
import dbClient from "../db/dbClient";
import { admin } from "better-auth/plugins"

export const auth = betterAuth({
  baseURL: process.env.AUTH_BASE_URL || "http://localhost:3000",
  emailAndPassword: {
        enabled: true,
    },

  database: drizzleAdapter(dbClient, {
        provider: "pg",
        schema: schema,
    }),

    plugins: [
        admin() 
    ],

     trustedOrigins: ["http://localhost:3000", "http://localhost:3001"],
});