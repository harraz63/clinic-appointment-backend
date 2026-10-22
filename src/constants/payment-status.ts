export const PaymentStatus = { UNPAID: 'unpaid', PAID: 'paid', REFUNDED: 'refunded' } as const;
export type PaymentStatusValue = typeof PaymentStatus[keyof typeof PaymentStatus];
