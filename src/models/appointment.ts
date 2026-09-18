type AppointmentType = "screen_visit" | "home_visit" | "activity";

interface AppointmentModel {
    id: string;
    type: AppointmentType;
    title: string;
    description?: string;
    start: string;
    end?: string;
    location?: string;
    staffName?: string;
}

export type { AppointmentType, AppointmentModel };