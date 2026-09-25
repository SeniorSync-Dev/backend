import { Hono } from "hono";
import { and, eq, isNull } from "drizzle-orm";
import { dbClient } from "../../db/dbClient";
import { careTask } from "../../db/schemas";
import {
    requireSession,
    type SessionVariables,
} from "../../middleware/require-session";
import {
    findJoinableScreenVisitAsync,
    joinWindowState,
} from "../../utils/helpers/screenVisitHelper";
import {
    addParticipantAsync,
    createMeetingAsync,
} from "../../utils/realtimeKit";
import { isUuid } from "../../utils/uuid";

const screenVisitRoutes = new Hono<{ Variables: SessionVariables }>();

screenVisitRoutes.use("*", requireSession);

screenVisitRoutes.post("/:id/join", async (c) => {
    const user = c.get("user");
    const careTaskId = c.req.param("id");

    if (!isUuid(careTaskId)) {
        return c.json({ error: "Skærmbesøget findes ikke." }, 404);
    }

    const visit = await findJoinableScreenVisitAsync(user.id, careTaskId);

    if (!visit) {
        return c.json(
            { error: "Du har ikke adgang til dette skærmbesøg." },
            403,
        );
    }

    const window = joinWindowState(
        visit.task.scheduledStart,
        visit.task.scheduledEnd,
    );

    if (window !== "open") {
        return c.json(
            {
                error:
                    window === "early"
                        ? "Skærmbesøget åbner et kvarter før aftalt tid."
                        : "Skærmbesøget er afsluttet.",
            },
            409,
        );
    }

    try {
        const meetingId =
            visit.task.meetingId ?? (await claimMeetingAsync(visit.task));

        const token = await addParticipantAsync(meetingId, {
            userId: user.id,
            name: user.name,
        });

        return c.json({ token, role: visit.role });
    } catch (cause) {
        console.error(`Skærmbesøg ${careTaskId} kunne ikke startes:`, cause);

        return c.json(
            { error: "Vi kunne ikke starte skærmbesøget. Prøv igen." },
            502,
        );
    }
});

async function claimMeetingAsync(task: { id: string; title: string }) {
    const created = await createMeetingAsync(task.title);

    const [claimed] = await dbClient
        .update(careTask)
        .set({ meetingId: created })
        .where(and(eq(careTask.id, task.id), isNull(careTask.meetingId)))
        .returning({ meetingId: careTask.meetingId });

    if (claimed?.meetingId) return claimed.meetingId;

    const [winner] = await dbClient
        .select({ meetingId: careTask.meetingId })
        .from(careTask)
        .where(eq(careTask.id, task.id))
        .limit(1);

    return winner!.meetingId!;
}

export default screenVisitRoutes;
