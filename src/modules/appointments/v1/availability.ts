import { Temporal } from '@js-temporal/polyfill';
import { HttpResponseError } from '../../../utils/appError.js';

export interface Slot { startsAt: string; endsAt: string }
export interface AvailabilityDay { date: string; slots: Slot[] }
export interface ScheduleInterval { weekday: number; startTime: string; endTime: string }
export interface ScheduleOverride { date: string; isDayOff: boolean; startTime: string | null; endTime: string | null }
export interface BusyInterval { startsAt: Date; endsAt: Date }

export function assertAvailabilityRange(from: string, to: string, timezone: string, now: Date): void {
    try {
        const first = Temporal.PlainDate.from(from);
        const last = Temporal.PlainDate.from(to);
        const today = Temporal.Instant.from(now.toISOString()).toZonedDateTimeISO(timezone).toPlainDate();
        if (Temporal.PlainDate.compare(first, today) < 0 || Temporal.PlainDate.compare(last, today.add({ days: 90 })) > 0 ||
            Temporal.PlainDate.compare(last, first) < 0 || first.until(last).days > 30) {
            throw new Error('range');
        }
    } catch {
        throw new HttpResponseError(422, 'Invalid availability date range');
    }
}

// Pure generator: callers provide a fixed clock and database-derived scheduling facts.
export function generateSlots(input: {
    from: string; to: string; timezone: string; durationMinutes: number; now: Date;
    weekly: ScheduleInterval[]; exceptions: ScheduleOverride[]; busy: BusyInterval[];
}): AvailabilityDay[] {
    const { timezone, durationMinutes, weekly, exceptions, busy, now } = input;
    const days: AvailabilityDay[] = [];
    for (let date = Temporal.PlainDate.from(input.from); Temporal.PlainDate.compare(date, input.to) <= 0; date = date.add({ days: 1 })) {
        const dateText = date.toString();
        const overrides = exceptions.filter(row => row.date === dateText);
        const intervals = overrides.length ? (overrides.some(row => row.isDayOff) ? [] : overrides) :
            weekly.filter(row => row.weekday === date.dayOfWeek % 7);
        const slots: Slot[] = [];
        for (const interval of intervals) {
            const intervalEnd = date.toPlainDateTime(interval.endTime.slice(0, 5));
            for (let local = date.toPlainDateTime(interval.startTime.slice(0, 5)); ; local = local.add({ minutes: durationMinutes })) {
                const localEnd = local.add({ minutes: durationMinutes });
                if (Temporal.PlainDateTime.compare(localEnd, intervalEnd) > 0) break;
                try {
                    const start = local.toZonedDateTime(timezone, { disambiguation: 'reject' });
                    const end = localEnd.toZonedDateTime(timezone, { disambiguation: 'reject' });
                    const transition = start.getTimeZoneTransition('next');
                    if (end.epochMilliseconds - start.epochMilliseconds !== durationMinutes * 60000 ||
                        (transition && transition.epochMilliseconds < end.epochMilliseconds)) continue;
                    const starts = start.epochMilliseconds;
                    const ends = end.epochMilliseconds;
                    if (starts <= now.getTime() || busy.some(row => row.startsAt.getTime() < ends && row.endsAt.getTime() > starts)) continue;
                    slots.push({ startsAt: new Date(starts).toISOString(), endsAt: new Date(ends).toISOString() });
                } catch (error) {
                    if (!(error instanceof RangeError)) throw error;
                    // Reject ambiguous or nonexistent local boundaries without shifting them.
                }
            }
        }
        days.push({ date: dateText, slots: slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt)) });
    }
    return days;
}
