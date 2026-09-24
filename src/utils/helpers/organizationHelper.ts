import { dbClient } from "../../db/dbClient";
import {
    organization,
    member,
    session,
    citizen,
    citizenFacilities,
    serviceProviderCompanyStaff,
} from "../../db/schemas";
import { and, eq, InferSelectModel, isNotNull } from "drizzle-orm";

type Organization = InferSelectModel<typeof organization>;

export async function getActiveOrganizationIdForUserAsync(
    userId: string,
): Promise<string | null> {
    const userSessions = await dbClient
        .select({ activeOrganizationId: session.activeOrganizationId })
        .from(session)
        .where(
            and(
                eq(session.userId, userId),
                isNotNull(session.activeOrganizationId),
            ),
        )
        .limit(1);

    console.info("[auth] active organization session lookup", {
        found: userSessions.length > 0,
    });

    return userSessions[0]?.activeOrganizationId ?? null;
}

async function getOrganizationById(
    organizationId: string,
): Promise<Organization | null> {
    const org = await dbClient
        .select()
        .from(organization)
        .where(eq(organization.id, organizationId))
        .limit(1);
    if (org.length === 0) {
        return null;
    }
    return org[0];
}

export async function getInitialOrganizationAsync(
    userid: string,
): Promise<Organization | null> {
    const userMemberships = await dbClient
        .select()
        .from(member)
        .where(eq(member.userId, userid))
        .limit(1);
    if (userMemberships.length === 0) {
        return null;
    }

    return await getOrganizationById(userMemberships[0].organizationId);
}

export async function linkCitizenToFacilityAsync(
    userId: string,
    facilityId: string,
): Promise<void> {
    await dbClient.insert(citizen).values({ userId }).onConflictDoNothing();

    const [existingLink] = await dbClient
        .select({ id: citizenFacilities.id })
        .from(citizenFacilities)
        .where(
            and(
                eq(citizenFacilities.citizenUserId, userId),
                eq(citizenFacilities.facilityId, facilityId),
            ),
        )
        .limit(1);

    if (existingLink) return;

    await dbClient.insert(citizenFacilities).values({
        citizenUserId: userId,
        facilityId,
        relationType: "resident",
        isPrimary: true,
    });
}

export async function linkServiceProviderCompanyStaffAsync(
    userId: string,
    companyId: string,
): Promise<void> {
    await dbClient
        .insert(serviceProviderCompanyStaff)
        .values({ userId, companyId })
        .onConflictDoNothing();
}
