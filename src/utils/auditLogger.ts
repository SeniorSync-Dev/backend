import type { Context } from "hono";
import { getConnInfo } from "hono/bun";
import dbClient from "../db/dbClient";
import { auditLog } from "../db/schemas/audit-schema";

export type AuditEntry = {
  actorId: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
};

export async function audit(entry: AuditEntry) {
  await dbClient.insert(auditLog).values(entry);
}

export function auditFromRequest(c: Context, entry: Omit<AuditEntry, "ip" | "userAgent">) {
  return audit({
    ...entry,
    ip: c.req.header("x-forwarded-for") ?? getConnInfo(c).remote.address,
    userAgent: c.req.header("user-agent"),
  });
}