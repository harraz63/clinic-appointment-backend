import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateSlots, assertAvailabilityRange } from '../src/modules/appointments/v1/availability.js';
import { bookingSchema } from '../src/modules/appointments/v1/appointment.validation.js';

const base = {
    from: '2026-01-05', to: '2026-01-05', timezone: 'Africa/Cairo', durationMinutes: 30,
    now: new Date('2026-01-04T12:00:00Z'),
    weekly: [{ weekday: 1, startTime: '09:10', endTime: '10:25' }], exceptions: [], busy: [],
};

test('slots align to interval start, omit trailing duration, and honor exact non-overlap boundaries', () => {
    const result = generateSlots(base)[0].slots;
    assert.deepEqual(result, [
        { startsAt: '2026-01-05T07:10:00.000Z', endsAt: '2026-01-05T07:40:00.000Z' },
        { startsAt: '2026-01-05T07:40:00.000Z', endsAt: '2026-01-05T08:10:00.000Z' },
    ]);
    assert.deepEqual(generateSlots({ ...base, busy: [{ startsAt: new Date(result[0].startsAt), endsAt: new Date(result[0].endsAt) }] })[0].slots, [result[1]]);
    assert.deepEqual(generateSlots({ ...base, busy: [{ startsAt: new Date('2026-01-05T07:25:00Z'), endsAt: new Date('2026-01-05T07:55:00Z') }] })[0].slots, []);
    assert.deepEqual(generateSlots({ ...base, now: new Date(result[0].startsAt) })[0].slots, [result[1]]);
    assert.deepEqual(generateSlots({ ...base, weekly: [] })[0].slots, []);
});

test('dated exceptions replace regular hours and whole-day closures win', () => {
    const exceptions = [{ date: base.from, isDayOff: false, startTime: '14:00', endTime: '14:30' }];
    assert.equal(generateSlots({ ...base, exceptions })[0].slots[0].startsAt, '2026-01-05T12:00:00.000Z');
    assert.deepEqual(generateSlots({ ...base, exceptions: [...exceptions, { date: base.from, isDayOff: true, startTime: null, endTime: null }] })[0].slots, []);
});

test('availability dates enforce valid calendars, inclusive 31-day ranges and 90-day horizon', () => {
    assert.doesNotThrow(() => assertAvailabilityRange('2026-01-04', '2026-02-03', base.timezone, base.now));
    assert.doesNotThrow(() => assertAvailabilityRange('2026-04-04', '2026-04-04', base.timezone, base.now));
    for (const [from, to] of [['2026-01-03', '2026-01-04'], ['2026-01-04', '2026-02-04'], ['2026-04-05', '2026-04-05'], ['2026-02-30', '2026-03-01'], ['2026-01-05', '2026-01-04']]) {
        assert.throws(() => assertAvailabilityRange(from, to, base.timezone, base.now));
    }
});

test('Cairo spring gap and fall repeated times are omitted without shifting', () => {
    const spring = generateSlots({ ...base, from: '2026-04-24', to: '2026-04-24', weekly: [{ weekday: 5, startTime: '00:00', endTime: '02:00' }] })[0].slots;
    assert.equal(spring.length, 2);
    assert.equal(spring[0].startsAt, '2026-04-23T22:00:00.000Z');
    const fall = generateSlots({ ...base, from: '2026-10-29', to: '2026-10-29', weekly: [{ weekday: 4, startTime: '22:00', endTime: '23:59' }] })[0].slots;
    assert.equal(fall.length, 1);
});

test('repeated and transition-crossing slots in New York are omitted', () => {
    const slots = generateSlots({ ...base, timezone: 'America/New_York', from: '2026-11-01', to: '2026-11-01',
        weekly: [{ weekday: 0, startTime: '00:00', endTime: '03:00' }] })[0].slots;
    assert.deepEqual(slots.map(slot => slot.startsAt), ['2026-11-01T04:00:00.000Z', '2026-11-01T07:00:00.000Z', '2026-11-01T07:30:00.000Z']);
    const crossing = generateSlots({ ...base, timezone: 'America/New_York', from: '2026-11-01', to: '2026-11-01', durationMinutes: 180,
        weekly: [{ weekday: 0, startTime: '00:00', endTime: '03:00' }] });
    assert.deepEqual(crossing[0].slots, []);
});

test('booking input requires explicit offsets and refuses server-derived fields', () => {
    const body = { doctorId: 'b9d27db2-27f6-450f-b376-7bec2feea4c9', startsAt: '2026-01-05T09:10:00+02:00' };
    assert.equal(bookingSchema.validate(body).error, undefined);
    for (const startsAt of ['2026-01-05T09:10:00', '2026-02-30T09:10:00Z', '2026-01-05T24:10:00Z']) {
        assert.ok(bookingSchema.validate({ ...body, startsAt }).error);
    }
    for (const field of ['customerId', 'status', 'branchId', 'bookedPrice', 'currency', 'durationMinutes', 'endsAt']) {
        assert.ok(bookingSchema.validate({ ...body, [field]: 'injected' }).error);
    }
});
