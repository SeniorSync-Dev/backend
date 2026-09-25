import { and, eq } from "drizzle-orm";
import { dbClient } from "../../db/dbClient";
import { relativeCitizen } from "../../db/schemas";

type RelativePermission = "canView" | "canBookActivities";

export async function getApprovedRelativeLinkAsync(
    relativeUserId: string,
    citizenUserId: string,
    permission: RelativePermission,
) {
    const [link] = await dbClient
        .select()
        .from(relativeCitizen)
        .where(
            and(
                eq(relativeCitizen.relativeUserId, relativeUserId),
                eq(relativeCitizen.citizenUserId, citizenUserId),
            ),
        )
        .limit(1);

    if (!link || link.status !== "approved" || !link[permission]) return null;

    return link;
}
