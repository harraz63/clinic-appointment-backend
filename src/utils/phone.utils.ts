import { HttpResponseError } from './appError.js';
import { StatusCodes } from 'http-status-codes';

const EGYPTIAN_MOBILE_PATTERN = /^(010|011|012|015)\d{8}$/;

export function normalizeEgyptianPhone(phone: string): string {
    const compact = phone.trim().replace(/[\s-]/g, '');
    const local = compact.startsWith('+20') ? `0${compact.slice(3)}` : compact.startsWith('20') ? `0${compact.slice(2)}` : compact;
    if (!EGYPTIAN_MOBILE_PATTERN.test(local)) {
        throw new HttpResponseError(StatusCodes.UNPROCESSABLE_ENTITY, 'Phone must be a valid Egyptian mobile number');
    }
    return `+20${local.slice(1)}`;
}
