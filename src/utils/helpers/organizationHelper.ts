import { dbClient } from "../../db/dbClient";
import { organization, member } from "../../db/schemas";
import { eq, InferSelectModel } from "drizzle-orm";

type Organization = InferSelectModel<typeof organization>;

async function getOrganizationById(organizationId: string): Promise<Organization | null> {
    const org = await dbClient.select()
        .from(organization)
        .where(eq(organization.id, organizationId))
        .limit(1);
    if (org.length === 0) {
        return null;
    }
    return org[0];
}

export default async function getInitialOrganizationAsync(userid: string): Promise<Organization | null> {
    const userMemberships = await dbClient.select()
        .from(member)
        .where(eq(member.userId, userid))
        .limit(1);
    if (userMemberships.length === 0) {
        return null;
    }
    return await getOrganizationById(userMemberships[0].organizationId);
}