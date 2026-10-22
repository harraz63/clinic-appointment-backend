export const AppointmentStatus = {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    NO_SHOW: 'no_show',
} as const;
export type AppointmentStatusValue = typeof AppointmentStatus[keyof typeof AppointmentStatus];
