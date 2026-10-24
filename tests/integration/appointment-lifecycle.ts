import assert from 'node:assert/strict';
import { TestContext } from 'node:test';
import { randomUUID } from 'node:crypto';
import { Sequelize } from 'sequelize';
import { Temporal } from '@js-temporal/polyfill';
import { UserModel } from '../../src/modules/user/v1/model/user.model.js';
import { DoctorService } from '../../src/modules/doctors/v1/doctor.service.js';
import { DoctorScheduleService } from '../../src/modules/doctor-schedules/v1/doctor-schedule.service.js';
import { BranchModel } from '../../src/modules/branches/v1/model/branch.model.js';
import { SpecialtyModel } from '../../src/modules/specialties/v1/model/specialty.model.js';
import { AppointmentModel } from '../../src/modules/appointments/v1/model/appointment.model.js';
import { AppointmentHistoryModel, AppointmentSnapshot } from '../../src/modules/appointments/v1/model/appointment-history.model.js';
import { AppointmentLifecycleService } from '../../src/modules/appointments/v1/appointment-lifecycle.service.js';
import { AppointmentService } from '../../src/modules/appointments/v1/appointment.service.js';
import { Roles } from '../../src/constants/roles.js';
import * as historyMigration from '../../src/database/migrations/006-appointment-history.js';

interface WireAppointment extends AppointmentSnapshot { id: string; customerId: string; doctorId: string }
interface ApiReply {
    status: number;
    body: { status: string; message: string; data: {
        appointment: WireAppointment; accessToken: { token: string }; total: number; totalPages: number;
        items: Array<Record<string, unknown>>;
    } };
}
type Request = (path: string, method?: string, body?: unknown, token?: string, language?: string) => Promise<ApiReply>;

export async function exerciseAppointmentLifecycle(t: TestContext, request: Request, sequelize: Sequelize): Promise<void> {
    const text = { ar: 'عيادة المواعيد', en: 'Lifecycle Clinic' };
    const branch = await BranchModel.create({ name: text, address: text, timezone: 'Africa/Cairo' });
    const specialty = await SpecialtyModel.create({ name: text });
    const password = 'LifecycleOnly#123';
    const users = [];
    const tokens: string[] = [];
    for (const [index, role] of [Roles.USER, Roles.USER, Roles.ADMIN].entries()) {
        const user = await UserModel.create({ phone: '+20109999100' + index, name: 'Lifecycle Account', password, role, isVerified: true });
        users.push(user);
        const login = await request('/api/v1/auth/login', 'POST', { phone: user.phone, password });
        assert.equal(login.status, 200);
        tokens.push(login.body.data.accessToken.token);
    }
    const doctor = await DoctorService.create({ phone: '01199991001', accountName: 'Lifecycle Doctor', password,
        name: text, branchId: branch.id, specialtyId: specialty.id, appointmentPrice: '125.50', currency: 'EGP', appointmentDurationMinutes: 30 });
    const secondDoctor = await DoctorService.create({ phone: '01199991002', accountName: 'Other Lifecycle Doctor', password,
        name: text, branchId: branch.id, specialtyId: specialty.id, appointmentPrice: '125.50', currency: 'EGP', appointmentDurationMinutes: 30 });
    const doctorLogin = await request('/api/v1/auth/login', 'POST', { phone: '01199991001', password });
    const otherLogin = await request('/api/v1/auth/login', 'POST', { phone: '01199991002', password });
    const doctorToken = doctorLogin.body.data.accessToken.token;
    const otherDoctorToken = otherLogin.body.data.accessToken.token;
    const date = Temporal.Now.plainDateISO(branch.timezone).add({ days: 3 });
    await DoctorScheduleService.replaceWeekly(doctor.id, [{ weekday: date.dayOfWeek % 7, startTime: '08:00', endTime: '20:00' }]);
    await DoctorScheduleService.replaceWeekly(secondDoctor.id, [{ weekday: date.dayOfWeek % 7, startTime: '08:00', endTime: '20:00' }]);
    const slots = (await AppointmentService.availability(doctor.id, date.toString(), date.toString())).days[0].slots;
    const book = async (index: number, customer = 0, doctorId = doctor.id): Promise<WireAppointment> => {
        const response = await request('/api/v1/appointments', 'POST', { doctorId, startsAt: slots[index].startsAt }, tokens[customer]);
        assert.equal(response.status, 201, JSON.stringify(response.body));
        return response.body.data.appointment;
    };
    const customerPath = (id: string) => '/api/v1/appointments/' + id;
    const doctorPath = (id: string) => '/api/v1/doctor/appointments/' + id;
    const adminPath = (id: string) => '/api/v1/admin/appointments/' + id;
    let appointment: WireAppointment;

    await t.test('ownership, validation, staff filters and audit projections', async () => {
        appointment = await book(0);
        assert.equal((await request(customerPath(appointment.id) + '/cancel', 'PATCH', {}, tokens[1])).status, 404);
        assert.equal((await request(doctorPath(appointment.id), 'GET', undefined, otherDoctorToken)).status, 404);
        assert.equal((await request(doctorPath(appointment.id), 'GET', undefined, doctorToken)).status, 200);
        assert.equal((await request(adminPath(appointment.id), 'GET', undefined, tokens[2])).status, 200);
        assert.equal((await request(adminPath(appointment.id), 'GET', undefined, tokens[0])).status, 403);
        assert.equal((await request(customerPath(appointment.id) + '/cancel', 'PATCH', {})).status, 401);
        assert.equal((await request(customerPath(appointment.id) + '/cancel', 'PATCH', {}, doctorToken)).status, 403);
        for (const suffix of ['/cancel?id=' + randomUUID(), '/reschedule?startsAt=' + encodeURIComponent(slots[1].startsAt)]) {
            assert.equal((await request(customerPath(appointment.id) + suffix, 'PATCH', {}, tokens[0])).status, 422);
        }
        assert.equal((await request(customerPath(appointment.id) + '/cancel', 'PATCH', { id: randomUUID() }, tokens[0])).status, 422);
        assert.equal((await request(doctorPath(appointment.id) + '/status', 'PATCH', { status: 'cancelled' }, doctorToken)).status, 422);
        assert.equal((await request(adminPath(appointment.id) + '/status', 'PATCH', { status: 'pending' }, tokens[2])).status, 422);
        const filter = `?customerId=${users[0].id}&branchId=${branch.id}&from=${encodeURIComponent(slots[0].startsAt)}&to=${encodeURIComponent(slots[1].startsAt)}&status=confirmed&limit=1`;
        for (const [path, token] of [['/api/v1/doctor/appointments', doctorToken], ['/api/v1/admin/appointments', tokens[2]]]) {
            const response = await request(path + filter, 'GET', undefined, token);
            assert.equal(response.status, 200);
            assert.equal(response.body.data.total, 1);
            assert.equal(response.body.data.items[0].id, appointment.id);
        }
        assert.equal((await request('/api/v1/doctor/appointments?doctorId=' + doctor.id, 'GET', undefined, doctorToken)).status, 422);
        assert.equal((await request('/api/v1/doctor/appointments' + filter, 'GET', undefined, otherDoctorToken)).body.data.total, 0);
        const exclusive = await request('/api/v1/admin/appointments?doctorId=' + doctor.id + '&to=' + encodeURIComponent(slots[0].startsAt), 'GET', undefined, tokens[2]);
        assert.equal(exclusive.body.data.total, 0);
        for (const [path, token] of [[customerPath(appointment.id), tokens[0]], [doctorPath(appointment.id), doctorToken], [adminPath(appointment.id), tokens[2]]]) {
            const history = await request(path + '/history?limit=1', 'GET', undefined, token);
            assert.equal(history.status, 200);
            assert.equal(history.body.data.total, 1);
            assert.deepEqual(Object.keys(history.body.data.items[0]).sort(), ['id', 'action', 'occurredAt', 'actorRole', 'before', 'after'].sort());
            assert.equal(history.body.data.items[0].action, 'booked');
            assert.equal(history.body.data.items[0].before, null);
        }
        assert.equal((await request(customerPath(appointment.id) + '/history', 'GET', undefined, tokens[1])).status, 404);
        assert.equal((await request(doctorPath(appointment.id) + '/history', 'GET', undefined, otherDoctorToken)).status, 404);
        await assert.rejects(() => (AppointmentModel.findByPk(appointment.id)).then(row => row.destroy()));
    });

    await t.test('rescheduling preserves terms, excludes itself, rejects conflicts and releases old slots', async () => {
        await DoctorService.update(doctor.id, { appointmentPrice: '999.00', currency: 'USD' });
        const unchanged = await request(customerPath(appointment.id) + '/reschedule', 'PATCH', { startsAt: slots[0].startsAt }, tokens[0]);
        assert.equal(unchanged.status, 409);
        const unchangedArabic = await request(customerPath(appointment.id) + '/reschedule', 'PATCH', { startsAt: slots[0].startsAt }, tokens[0], 'ar');
        assert.equal(unchangedArabic.status, 409);
        assert.match(unchangedArabic.body.message, /[\u0600-\u06ff]/);
        const moved = await request(customerPath(appointment.id) + '/reschedule', 'PATCH', { startsAt: slots[1].startsAt }, tokens[0]);
        assert.equal(moved.status, 200);
        assert.equal(moved.body.data.appointment.id, appointment.id);
        assert.equal(moved.body.data.appointment.bookedPrice, '125.50');
        assert.equal(moved.body.data.appointment.currency, 'EGP');
        const oldSlot = await book(0, 1);
        const occupied = await request(customerPath(appointment.id) + '/reschedule', 'PATCH', { startsAt: slots[0].startsAt }, tokens[0]);
        assert.equal(occupied.status, 409);
        assert.equal((await AppointmentModel.findByPk(appointment.id)).startsAt.toISOString(), slots[1].startsAt);
        await book(2, 0, secondDoctor.id);
        assert.equal((await request(customerPath(appointment.id) + '/reschedule', 'PATCH', { startsAt: slots[2].startsAt }, tokens[0])).status, 409);
        assert.equal((await AppointmentHistoryModel.count({ where: { appointmentId: appointment.id } })), 2);
        const cancelled = await request(customerPath(oldSlot.id) + '/cancel', 'PATCH', {}, tokens[1]);
        assert.equal(cancelled.status, 200);
        assert.equal(cancelled.body.data.appointment.status, 'cancelled');
        assert.equal((await request(customerPath(oldSlot.id) + '/cancel', 'PATCH', {}, tokens[1])).status, 409);
        await book(0, 1);
        const history = await request(customerPath(appointment.id) + '/history?limit=1&page=2', 'GET', undefined, tokens[0]);
        assert.equal(history.body.data.totalPages, 2);
        assert.equal(history.body.data.items[0].action, 'reschedule');
    });

    let pastIndex = 0;
    const past = async (status: string) => {
        const start = Date.now() - (3 + pastIndex++) * 3600000;
        return AppointmentModel.create({ customerId: users[0].id, doctorId: doctor.id, branchId: branch.id,
            startsAt: new Date(start), endsAt: new Date(start + 1800000), timezone: branch.timezone,
            durationMinutes: 30, bookedPrice: '125.50', currency: 'EGP', status });
    };
    await t.test('staff transitions, terminal states and admin late cancellation work on inactive profiles', async () => {
        const future = await book(4);
        assert.equal((await request(doctorPath(future.id) + '/status', 'PATCH', { status: 'completed' }, doctorToken)).status, 409);
        assert.equal((await request(doctorPath(future.id) + '/status', 'PATCH', { status: 'no_show' }, doctorToken)).status, 409);
        await AppointmentModel.update({ status: 'pending' }, { where: { id: future.id } });
        assert.equal((await request(doctorPath(future.id) + '/status', 'PATCH', { status: 'confirmed' }, doctorToken)).status, 200);
        assert.equal((await request(doctorPath(future.id) + '/status', 'PATCH', { status: 'confirmed' }, doctorToken)).status, 409);
        const row = await past('confirmed');
        assert.equal((await request(customerPath(row.id) + '/cancel', 'PATCH', {}, tokens[0])).status, 409);
        const lateArabic = await request(customerPath(row.id) + '/cancel', 'PATCH', {}, tokens[0], 'ar');
        assert.equal(lateArabic.status, 409);
        assert.match(lateArabic.body.message, /[\u0600-\u06ff]/);
        assert.equal((await request(adminPath(row.id) + '/reschedule', 'PATCH', { startsAt: slots[5].startsAt }, tokens[2])).status, 409);
        const pending = await past('pending');
        assert.equal((await request(doctorPath(pending.id) + '/status', 'PATCH', { status: 'confirmed' }, doctorToken)).status, 409);
        await doctor.update({ isActive: false });
        await branch.update({ isActive: false });
        assert.equal((await request(doctorPath(row.id) + '/status', 'PATCH', { status: 'completed' }, doctorToken)).status, 200);
        assert.equal((await request(adminPath(pending.id) + '/status', 'PATCH', { status: 'cancelled' }, tokens[2])).status, 200);
        const noShow = await past('confirmed');
        assert.equal((await request(doctorPath(noShow.id) + '/status', 'PATCH', { status: 'no_show' }, doctorToken)).status, 200);
        for (const terminal of [row, noShow, pending]) {
            for (const status of ['confirmed', 'completed', 'no_show', 'cancelled']) {
                assert.equal((await request(adminPath(terminal.id) + '/status', 'PATCH', { status }, tokens[2])).status, 409);
            }
            assert.equal((await AppointmentHistoryModel.count({ where: { appointmentId: terminal.id } })), 1);
        }
        await doctor.update({ isActive: true });
        await branch.update({ isActive: true });
    });

    await t.test('racing reschedules/bookings and competing terminal actions serialize without audit leaks', async () => {
        const source = await book(6);
        const race = await Promise.all([
            request(customerPath(source.id) + '/reschedule', 'PATCH', { startsAt: slots[7].startsAt }, tokens[0]),
            request('/api/v1/appointments', 'POST', { doctorId: doctor.id, startsAt: slots[7].startsAt }, tokens[1]),
        ]);
        assert.deepEqual(race.map(result => result.status).sort(), race[0].status === 200 ? [200, 409] : [201, 409]);
        // Whichever transaction wins owns the destination, and a failed move retains the source.
        const sourceRow = await AppointmentModel.findByPk(source.id);
        assert.equal(sourceRow.startsAt.toISOString(), race[0].status === 200 ? slots[7].startsAt : slots[6].startsAt);
        assert.equal(await AppointmentHistoryModel.count({ where: { appointmentId: source.id } }), race[0].status === 200 ? 2 : 1);
        const row = await past('confirmed');
        const terminalRace = await Promise.all([
            request(adminPath(row.id) + '/status', 'PATCH', { status: 'cancelled' }, tokens[2]),
            request(doctorPath(row.id) + '/status', 'PATCH', { status: 'completed' }, doctorToken),
        ]);
        assert.deepEqual(terminalRace.map(result => result.status).sort(), [200, 409]);
        assert.equal(await AppointmentHistoryModel.count({ where: { appointmentId: row.id } }), 1);
    });

    await t.test('audit insert failure rolls back booking and lifecycle writes', async () => {
        const source = await book(9);
        const before = (await AppointmentModel.findByPk(source.id)).toJSON();
        const count = await AppointmentModel.count();
        const historyCount = await AppointmentHistoryModel.count();
        AppointmentHistoryModel.addHook('beforeCreate', 'reject-audit', () => { throw new Error('simulated history insert failure'); });
        try {
            await assert.rejects(() => AppointmentService.book(users[1].id, { doctorId: doctor.id, startsAt: slots[10].startsAt }), /simulated history/);
            await assert.rejects(() => AppointmentLifecycleService.change({ id: users[0].id, role: Roles.USER }, source.id, 'cancel'), /simulated history/);
            await assert.rejects(() => AppointmentLifecycleService.change({ id: users[0].id, role: Roles.USER }, source.id, 'reschedule', slots[11].startsAt), /simulated history/);
        } finally {
            AppointmentHistoryModel.removeHook('beforeCreate', 'reject-audit');
        }
        assert.equal(await AppointmentModel.count(), count);
        assert.equal(await AppointmentHistoryModel.count(), historyCount);
        assert.deepEqual((await AppointmentModel.findByPk(source.id)).toJSON(), before);
    });

    await t.test('rescheduling honors self-exclusion, new durations, exceptions and eligibility without changing pending status', async () => {
        const source = await book(13, 1);
        await AppointmentModel.update({ status: 'pending' }, { where: { id: source.id } });
        await DoctorService.update(doctor.id, { appointmentDurationMinutes: 45 });
        const target = date.toPlainDateTime('14:45').toZonedDateTime(branch.timezone).toInstant().toString();
        const destination = new Date(target).toISOString();
        // This 45-minute slot overlaps the same appointment's previous 14:30-15:00 interval.
        const moved = await request(customerPath(source.id) + '/reschedule', 'PATCH', { startsAt: target }, tokens[1]);
        assert.equal(moved.status, 200);
        assert.equal(moved.body.data.appointment.startsAt, destination);
        assert.equal(moved.body.data.appointment.durationMinutes, 45);
        assert.equal(moved.body.data.appointment.status, 'pending');
        const initialCount = await AppointmentHistoryModel.count({ where: { appointmentId: source.id } });
        const anotherSlot = date.toPlainDateTime('16:15').toZonedDateTime(branch.timezone).toInstant().toString();
        await doctor.update({ isAvailable: false });
        assert.equal((await request(customerPath(source.id) + '/reschedule', 'PATCH', { startsAt: anotherSlot }, tokens[1])).status, 409);
        await doctor.update({ isAvailable: true });
        await DoctorScheduleService.setException(doctor.id, date.toString(), { isDayOff: true });
        assert.equal((await request(customerPath(source.id) + '/reschedule', 'PATCH', { startsAt: anotherSlot }, tokens[1])).status, 409);
        await DoctorScheduleService.deleteException(doctor.id, date.toString());
        const tooLate = Temporal.Now.zonedDateTimeISO(branch.timezone).add({ days: 91 }).toInstant().toString();
        assert.equal((await request(customerPath(source.id) + '/reschedule', 'PATCH', { startsAt: tooLate }, tokens[1])).status, 422);
        const after = await AppointmentModel.findByPk(source.id);
        assert.equal(after.startsAt.toISOString(), destination);
        assert.equal(after.status, 'pending');
        assert.equal(await AppointmentHistoryModel.count({ where: { appointmentId: source.id } }), initialCount);
        await DoctorService.update(doctor.id, { appointmentDurationMinutes: 30 });
    });

    await t.test('rescheduling snapshots current branch/timezone/duration while retaining original money', async () => {
        await DoctorScheduleService.replaceWeekly(doctor.id, []);
        const newBranch = await BranchModel.create({ name: text, address: text, timezone: 'UTC' });
        await DoctorService.update(doctor.id, { branchId: newBranch.id, appointmentDurationMinutes: 45, appointmentPrice: '900.00', currency: 'USD' });
        const nextDate = date.add({ days: 1 });
        await DoctorScheduleService.replaceWeekly(doctor.id, [{ weekday: nextDate.dayOfWeek % 7, startTime: '08:00', endTime: '12:00' }]);
        const available = await AppointmentService.availability(doctor.id, nextDate.toString(), nextDate.toString());
        const moved = await request(adminPath(appointment.id) + '/reschedule', 'PATCH', { startsAt: available.days[0].slots[0].startsAt }, tokens[2]);
        assert.equal(moved.status, 200);
        assert.equal(moved.body.data.appointment.branchId, newBranch.id);
        assert.equal(moved.body.data.appointment.timezone, 'UTC');
        assert.equal(moved.body.data.appointment.durationMinutes, 45);
        assert.equal(moved.body.data.appointment.bookedPrice, '125.50');
        assert.equal(moved.body.data.appointment.currency, 'EGP');
        assert.equal(moved.body.data.appointment.status, 'confirmed');
        const events = await AppointmentHistoryModel.findAll({ where: { appointmentId: appointment.id, action: 'reschedule' } });
        assert.ok(events.some(event => event.before.branchId === branch.id && event.after.branchId === newBranch.id));
    });

    await t.test('actor deletion retains safe history and migration rollback preserves appointments', async () => {
        const actorId = users[2].id;
        const eventCount = await AppointmentHistoryModel.count({ where: { actorId } });
        assert.ok(eventCount > 0);
        await users[2].destroy();
        assert.equal(await AppointmentHistoryModel.count({ where: { actorId: null, actorRole: Roles.ADMIN } }), eventCount);
        const count = await AppointmentModel.count();
        await historyMigration.down(sequelize.getQueryInterface(), sequelize);
        assert.equal(await AppointmentModel.count(), count);
        await historyMigration.up(sequelize.getQueryInterface(), sequelize);
        assert.equal(await AppointmentHistoryModel.count(), 0);
        assert.equal(await AppointmentModel.count(), count);
    });
}
