import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Request, Response } from 'express';
import { Roles } from '../src/constants/roles.js';
import { AppointmentStatus, AppointmentStatusValue } from '../src/constants/appointment-status.js';
import { AppointmentAction, assertAppointmentPermission } from '../src/modules/appointments/v1/appointment.permissions.js';
import { assertLifecyclePolicy } from '../src/modules/appointments/v1/appointment.policy.js';
import { adminAppointmentListSchema, adminStatusSchema, appointmentHistorySchema, appointmentIdSchema, doctorAppointmentListSchema,
    doctorStatusSchema, requestSourceGuard, rescheduleSchema } from '../src/modules/appointments/v1/appointment.validation.js';
import { assertDisposableTestTargets } from './integration/target-guard.js';

test('new lifecycle errors have matching English and intact Arabic translations', () => {
    for (const language of ['en', 'ar']) {
        const messages: unknown = JSON.parse(readFileSync(new URL('../src/i18n/local/' + language + '.json', import.meta.url), 'utf8'));
        assert.ok(messages && typeof messages === 'object');
        for (const key of ['Appointment action is not allowed in its current state or time', 'Appointment already uses this slot']) {
            const message = (messages as Record<string, unknown>)[key];
            assert.ok(typeof message === 'string' && message.length > 0);
            if (language === 'ar') assert.match(message, /[\u0600-\u06ff]/);
        }
    }
});

test('integration guard refuses preloaded development configuration and wrong disposable service targets', () => {
    const expected = new URL('postgres://postgres@127.0.0.1:54321/clinic_tests');
    const redis = 'redis://127.0.0.1:54322';
    const database = { host: '127.0.0.1', port: 54321, database: 'clinic_tests' };
    assert.doesNotThrow(() => assertDisposableTestTargets(database, redis, expected, redis));
    for (const wrong of [
        { ...database, database: 'clinic_appointment_foundation' },
        { ...database, port: 5432 },
        { ...database, host: 'localhost' },
    ]) assert.throws(() => assertDisposableTestTargets(wrong, redis, expected, redis), /refusing all database operations/);
    assert.throws(() => assertDisposableTestTargets(database, 'redis://127.0.0.1:6379', expected, redis), /refusing all service operations/);
    assert.throws(() => assertDisposableTestTargets(database, redis, new URL('postgres://postgres@production:54321/clinic_tests'), redis), /refusing all database operations/);
});

test('lifecycle policies cover every source state, action and exact start boundary', () => {
    const now = new Date('2026-11-01T10:00:00Z');
    const actions: Array<Exclude<AppointmentAction, 'view'>> = ['confirm', 'complete', 'no_show', 'cancel', 'reschedule'];
    const allowedSources: Record<Exclude<AppointmentAction, 'view'>, AppointmentStatusValue[]> = {
        confirm: ['pending'], complete: ['confirmed'], no_show: ['confirmed'], cancel: ['pending', 'confirmed'], reschedule: ['pending', 'confirmed'],
    };
    for (const role of [Roles.USER, Roles.DOCTOR, Roles.ADMIN]) {
        for (const status of Object.values(AppointmentStatus)) {
            for (const action of actions) {
                for (const delta of [-1, 0, 1]) {
                    const appointment = { status, startsAt: new Date(now.getTime() + delta) };
                    const stateAllowed = allowedSources[action].includes(status);
                    const timingAllowed = ['complete', 'no_show'].includes(action) ? delta <= 0 :
                        action === 'cancel' && role === Roles.ADMIN ? true : delta > 0;
                    const run = () => assertLifecyclePolicy({ id: 'actor', role }, appointment, action, now);
                    if (stateAllowed && timingAllowed) assert.doesNotThrow(run);
                    else assert.throws(run, { statusCode: 409 });
                }
            }
        }
    }
});

test('action permissions enforce ownership and keep doctor cancellation/rescheduling forbidden', () => {
    const ownership = { customerId: 'customer', doctorUserId: 'doctor' };
    for (const action of ['confirm', 'complete', 'no_show', 'cancel', 'reschedule'] as const) {
        assert.doesNotThrow(() => assertAppointmentPermission({ id: 'admin', role: Roles.ADMIN }, ownership, action));
        const doctor = () => assertAppointmentPermission({ id: 'doctor', role: Roles.DOCTOR }, ownership, action);
        const customer = () => assertAppointmentPermission({ id: 'customer', role: Roles.USER }, ownership, action);
        if (['cancel', 'reschedule'].includes(action)) {
            assert.throws(doctor, { statusCode: 403 });
            assert.doesNotThrow(customer);
        } else {
            assert.doesNotThrow(doctor);
            assert.throws(customer, { statusCode: 403 });
        }
        assert.throws(() => assertAppointmentPermission({ id: 'other', role: Roles.DOCTOR }, ownership, action), { statusCode: 403 });
        assert.throws(() => assertAppointmentPermission({ id: 'other', role: Roles.USER }, ownership, action), { statusCode: 403 });
    }
});

test('lifecycle validation rejects injected snapshots, invalid timestamps, filters and statuses', () => {
    const id = randomUUID();
    assert.equal(appointmentIdSchema.validate({ id }).error, undefined);
    assert.ok(appointmentIdSchema.validate({ id, reason: 'unexpected' }).error);
    for (const startsAt of ['2026-11-01T10:00:00Z', '2026-11-01T12:00:00.123+02:00']) {
        assert.equal(rescheduleSchema.validate({ id, startsAt }).error, undefined);
    }
    for (const startsAt of ['2026-11-01T10:00:00', '2026-11-01T10:00Z', '2026-02-30T10:00:00Z', '2026-11-01T10:00:00.1234Z']) {
        assert.ok(rescheduleSchema.validate({ id, startsAt }).error);
    }
    for (const field of ['doctorId', 'customerId', 'branchId', 'durationMinutes', 'bookedPrice', 'currency', 'status']) {
        assert.ok(rescheduleSchema.validate({ id, startsAt: '2026-11-01T10:00:00Z', [field]: 'injected' }).error);
    }
    assert.ok(doctorStatusSchema.validate({ id, status: 'cancelled' }).error);
    assert.equal(adminStatusSchema.validate({ id, status: 'cancelled' }).error, undefined);
    for (const status of ['pending', 'rescheduled', 'unknown']) assert.ok(adminStatusSchema.validate({ id, status }).error);
    assert.ok(doctorAppointmentListSchema.validate({ doctorId: id }).error);
    assert.equal(adminAppointmentListSchema.validate({ doctorId: id, from: '2026-11-01T10:00:00Z', to: '2026-11-02T10:00:00Z' }).error, undefined);
    assert.ok(adminAppointmentListSchema.validate({ from: '2026-11-02T10:00:00Z', to: '2026-11-01T10:00:00Z' }).error);
    assert.ok(adminAppointmentListSchema.validate({ from: '2026-11-01T12:00:00+02:00', to: '2026-11-01T10:00:00Z' }).error);
    assert.ok(appointmentHistorySchema.validate({ id, limit: 101 }).error);
    assert.equal(appointmentHistorySchema.validate({ id, page: '2', limit: '1' }).error, undefined);
});

test('source guard rejects PATCH queries, duplicate IDs and GET bodies', () => {
    const guard = (method: string, params: object, body: object, query: object) => {
        let called = false;
        requestSourceGuard({ method, params, body, query } as Request, {} as Response, () => { called = true; });
        assert.equal(called, true);
    };
    assert.doesNotThrow(() => guard('PATCH', { id: 'route-id' }, { startsAt: 'timestamp' }, {}));
    assert.throws(() => guard('PATCH', { id: 'route-id' }, {}, { status: 'cancelled' }), { statusCode: 422 });
    assert.throws(() => guard('PATCH', { id: 'route-id' }, { id: 'body-id' }, {}), { statusCode: 422 });
    assert.throws(() => guard('GET', { id: 'route-id' }, {}, { id: 'query-id' }), { statusCode: 422 });
    assert.throws(() => guard('GET', {}, { status: 'confirmed' }, {}), { statusCode: 422 });
});
