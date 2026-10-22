import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { forgotPasswordSchema, registerSchema, sendOtpSchema, updateMeSchema, verifyRegistrationSchema } from '../src/modules/auth/v1/auth.validation.js';
import { localizedTextSchema, timezoneSchema, moneySchema } from '../src/shared/localized-text.js';
import { Roles } from '../src/constants/roles.js';
import { assertAppointmentPermission } from '../src/modules/appointments/v1/appointment.permissions.js';
import { authorizeRoles } from '../src/middleware/authorization.middleware.js';
import { assertActiveSession } from '../src/modules/user-session/v1/user-session.policy.js';
import { UserModel } from '../src/modules/user/v1/model/user.model.js';
import { UserSessionModel } from '../src/modules/user-session/v1/model/user-session.entity.js';
import { initializeAssociations } from '../src/database/associations.js';
import { DoctorModel } from '../src/modules/doctors/v1/model/doctor.model.js';
import { AppointmentModel } from '../src/modules/appointments/v1/model/appointment.model.js';
import { workingIntervalSchema, scheduleExceptionSchema } from '../src/modules/doctor-schedules/v1/doctor-schedule.validation.js';
import { Request, Response } from 'express';
import { normalizeEgyptianPhone } from '../src/utils/phone.utils.js';

const registration = { phone: '01012345678', name: 'Test Patient', password: 'TestOnly#123' };

test('public registration rejects privilege fields and self-profile rejects administrative fields', () => {
    assert.equal(registerSchema.validate(registration).error, undefined);
    assert.ok(registerSchema.validate({ ...registration, provider: 'person@example.com' }).error);
    assert.equal(verifyRegistrationSchema.validate({ phone: registration.phone, otp: '123456' }).error, undefined);
    assert.ok(verifyRegistrationSchema.validate({ phone: registration.phone, otp: '12345' }).error);
    assert.equal(sendOtpSchema.validate({ phone: registration.phone, type: 'register' }).error, undefined);
    assert.ok(sendOtpSchema.validate({ phone: registration.phone, type: 'login' }).error);
    assert.equal(forgotPasswordSchema.validate({ phone: registration.phone }).error, undefined);
    assert.equal(normalizeEgyptianPhone('010 1234 5678'), '+201012345678');
    assert.equal(normalizeEgyptianPhone('+201012345678'), '+201012345678');
    assert.throws(() => normalizeEgyptianPhone('person@example.com'), { statusCode: 422 });
    for (const field of ['role', 'isVerified', 'isBlocked']) {
        assert.ok(registerSchema.validate({ ...registration, [field]: field === 'role' ? Roles.ADMIN : true }).error);
        assert.ok(updateMeSchema.validate({ [field]: field === 'role' ? Roles.ADMIN : true }).error);
    }
    assert.equal(updateMeSchema.validate({ name: 'Updated Patient' }).error, undefined);
    assert.deepEqual(Object.values(Roles).sort(), ['admin', 'customer', 'doctor']);
});

test('bilingual content requires both nonblank strings and preserves both languages', () => {
    const content = { ar: 'اسم', en: 'Name' };
    assert.deepEqual(localizedTextSchema.validate(content).value, content);
    for (const value of [{ en: 'Name' }, { ar: 'اسم' }, { ar: ' ', en: 'Name' }, { ar: 'اسم', en: 42 }]) {
        assert.ok(localizedTextSchema.validate(value).error);
    }
    assert.ok(timezoneSchema.validate('Invalid/Timezone').error);
    assert.equal(timezoneSchema.validate('Africa/Cairo').error, undefined);
    assert.equal(moneySchema.validate('125.50').error, undefined);
    assert.ok(moneySchema.validate(125.5).error);
});

test('doctor and customer access checks enforce ownership and distinct actions', () => {
    const resource = { customerId: 'patient', doctorUserId: 'doctor' };
    assert.doesNotThrow(() => assertAppointmentPermission({ id: 'admin', role: Roles.ADMIN }, resource, 'cancel'));
    assert.doesNotThrow(() => assertAppointmentPermission({ id: 'doctor', role: Roles.DOCTOR }, resource, 'complete'));
    assert.doesNotThrow(() => assertAppointmentPermission({ id: 'patient', role: Roles.USER }, resource, 'reschedule'));
    for (const [id, role, action] of [
        ['other', Roles.USER, 'view'], ['other', Roles.DOCTOR, 'confirm'],
        ['doctor', Roles.DOCTOR, 'cancel'], ['patient', Roles.USER, 'complete'],
    ] as const) assert.throws(() => assertAppointmentPermission({ id, role }, resource, action), { statusCode: 403 });
});

test('role middleware only allows configured roles', () => {
    let passed = false;
    const middleware = authorizeRoles(Roles.ADMIN);
    middleware({ user: { role: Roles.ADMIN } } as Request, {} as Response, () => { passed = true; });
    assert.equal(passed, true);
    assert.throws(() => middleware({ user: { role: Roles.USER } } as Request, {} as Response, () => {}), { statusCode: 403 });
});

test('password-inclusive model serialization never exposes a password hash', () => {
    const user = UserModel.build({ ...registration, id: randomUUID(), password: 'sensitive-hash' });
    assert.equal(user.password, 'sensitive-hash');
    assert.equal('password' in user.toJSON(), false);
    assert.equal(JSON.stringify(user).includes('sensitive-hash'), false);
});

test('authentication rejects missing, foreign, expired sessions and blocked accounts', () => {
    const user = UserModel.build({ ...registration, id: randomUUID(), isBlocked: false });
    const session = UserSessionModel.build({ userId: user.id, expiresAt: new Date(Date.now() + 60000) });
    assert.doesNotThrow(() => assertActiveSession(user, session));
    assert.throws(() => assertActiveSession(user, null), { statusCode: 401 });
    session.userId = randomUUID();
    assert.throws(() => assertActiveSession(user, session), { statusCode: 401 });
    session.userId = user.id;
    session.expiresAt = new Date(0);
    assert.throws(() => assertActiveSession(user, session), { statusCode: 401 });
    session.expiresAt = new Date(Date.now() + 60000);
    user.isBlocked = true;
    assert.throws(() => assertActiveSession(user, session), { statusCode: 403 });
});

test('associations initialize once and distinguish user accounts from doctor profiles', () => {
    initializeAssociations();
    initializeAssociations();
    assert.equal(DoctorModel.associations.user.foreignKey, 'userId');
    assert.equal(DoctorModel.associations.branch.foreignKey, 'branchId');
    assert.equal(AppointmentModel.associations.customer.foreignKey, 'customerId');
    assert.equal(AppointmentModel.associations.doctor.target, DoctorModel);
    assert.ok(UserModel.associations.notifications);
});

test('working intervals and exceptions reject reversed intervals and invalid day-off data', () => {
    assert.equal(workingIntervalSchema.validate({ weekday: 0, startTime: '09:00', endTime: '17:00' }).error, undefined);
    assert.ok(workingIntervalSchema.validate({ weekday: 7, startTime: '17:00', endTime: '09:00' }).error);
    assert.equal(scheduleExceptionSchema.validate({ date: '2026-12-01', isDayOff: true }).error, undefined);
    assert.ok(scheduleExceptionSchema.validate({ date: '2026-12-01', isDayOff: true, startTime: '09:00' }).error);
});
