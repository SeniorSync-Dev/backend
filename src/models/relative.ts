type RelativeLinkStatus = "pending" | "approved" | "rejected";

interface LinkedCitizenModel {
    citizenUserId: string;
    name: string;
    relationshipType: string;
    status: RelativeLinkStatus;
    age?: number;
    facilityName?: string;
    nextAppointmentTitle?: string;
    nextAppointmentStart?: string;
}

interface LinkedRelativeModel {
    relativeUserId: string;
    name: string;
    relationshipType: string;
    status: RelativeLinkStatus;
}

interface InviteCodeModel {
    code: string;
    expiresAt: string;
}

export type {
    RelativeLinkStatus,
    LinkedCitizenModel,
    LinkedRelativeModel,
    InviteCodeModel,
};
