import { PaymentRecordModel } from './model/payment-record.model.js';

// Internal input; amount/currency must be derived from the appointment by services.
export type PaymentRecordInput = Pick<PaymentRecordModel, 'appointmentId' | 'paymentMethodId' | 'amount' | 'currency'>;
