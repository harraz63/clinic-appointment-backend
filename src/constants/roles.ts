// USER is retained because migration 001 imports it; its public value is customer.
export const Roles = {
    ADMIN: 'admin',
    DOCTOR: 'doctor',
    USER: 'customer'
} as const;

export type Role = typeof Roles[keyof typeof Roles];
