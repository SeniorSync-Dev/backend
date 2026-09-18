import { dbClient } from "../../db/dbClient";
import { address, facillity } from "../../db/schemas";
import { eq } from "drizzle-orm";

// Every organization needs at least one facility to organize activities under -
// reuse its first facility, or create a placeholder one.
export async function getOrCreateFacilityForOrganizationAsync(
    organizationId: string,
) {
    const [existing] = await dbClient
        .select()
        .from(facillity)
        .where(eq(facillity.organizationId, organizationId))
        .limit(1);
    if (existing) return existing;

    const [defaultAddress] = await dbClient
        .insert(address)
        .values({ street: "Ukendt", zipCode: "0000", city: "Ukendt" })
        .returning();

    const [defaultFacility] = await dbClient
        .insert(facillity)
        .values({
            organizationId,
            name: "Standardlokation",
            type: "other",
            addressId: defaultAddress.id,
        })
        .returning();

    return defaultFacility;
}
