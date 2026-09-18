import { dbClient } from "../../db/dbClient";
import { employee } from "../../db/schemas";
import { eq } from "drizzle-orm";

// No flow creates employee rows yet (pre-registration by CPR isn't implemented) -
// lazily create a minimal one so a user can be assigned to a visit.
export async function ensureEmployeeRecordAsync(
    userId: string,
): Promise<string> {
    const [existing] = await dbClient
        .select({ id: employee.id })
        .from(employee)
        .where(eq(employee.userId, userId))
        .limit(1);
    if (existing) return existing.id;

    await dbClient
        .insert(employee)
        .values({ userId, employeeNumber: userId, jobTitle: "Medarbejder" })
        .onConflictDoNothing({ target: employee.userId });

    const [created] = await dbClient
        .select({ id: employee.id })
        .from(employee)
        .where(eq(employee.userId, userId))
        .limit(1);

    return created.id;
}
