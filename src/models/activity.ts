interface ActivityModel {
    id: string;
    title: string;
    description?: string;
    start: string;
    end?: string;
    location?: string;
    availableSpots?: number;
    isSignedUp: boolean;
}

export type { ActivityModel };