interface ActivityModel {
    id: string;
    title: string;
    start: string;
    end?: string;
    location?: string;
    providerCompanyName?: string;
    availableSpots?: number;
    isSignedUp: boolean;
}

export type { ActivityModel };
