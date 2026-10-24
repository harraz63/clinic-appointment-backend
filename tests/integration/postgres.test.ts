import '../setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { once } from 'node:events';
import express from 'express';
import { Temporal } from '@js-temporal/polyfill';
import { assertDisposableTestTargets } from './target-guard.js';

// Always creates its own loopback-only disposable database; never uses the local .env DB_URI.
test('isolated PostgreSQL migrations and HTTP smoke checks', { timeout: 120000 }, async t => {
    const container = 'clinic-foundation-test-' + randomUUID();
    const redisContainer = 'clinic-redis-test-' + randomUUID();
    const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    let cleanupResources = async (): Promise<void> => {};
    t.after(async () => {
        await cleanupResources();
        docker('rm', '-f', redisContainer);
        docker('rm', '-f', '-v', container);
    });
    docker('run', '-d', '--rm', '--name', container, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust',
        '-e', 'POSTGRES_DB=clinic_tests', '-p', '127.0.0.1::5432', 'postgres:16-alpine');
    docker('run', '-d', '--rm', '--name', redisContainer, '-p', '127.0.0.1::6379', 'redis:7-alpine');
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
        try { docker('exec', container, 'pg_isready', '-U', 'postgres', '-d', 'clinic_tests'); ready = true; break; }
        catch { await setTimeout(250); }
    }
    assert.ok(ready, 'disposable PostgreSQL must become ready');
    const binding = docker('port', container, '5432/tcp');
    process.env.DB_URI = 'postgres://postgres@' + binding + '/clinic_tests';
    const redisBinding = docker('port', redisContainer, '6379/tcp');
    process.env.REDIS_URL = 'redis://' + redisBinding;
    process.env.OTP_HMAC_SECRET = 'isolated-integration-secret-at-least-32-characters';
    process.env.OTP_RESEND_COOLDOWN_SECONDS = '1';
    let redisReady = false;
    for (let attempt = 0; attempt < 100; attempt++) {
        try { docker('exec', redisContainer, 'redis-cli', 'ping'); redisReady = true; break; }
        catch { await setTimeout(250); }
    }
    assert.ok(redisReady, 'disposable Redis must become ready');
    const { sequelize } = await import('../../src/database/db-config.js');
    const { env } = await import('../../src/config/env.js');
    assertDisposableTestTargets(sequelize.config, env.REDIS_URL,
        new URL('postgres://postgres@' + binding + '/clinic_tests'), 'redis://' + redisBinding);
    const qi = sequelize.getQueryInterface();
    const roles = await import('../../src/database/migrations/002-clinic-roles.js');
    const clinic = await import('../../src/database/migrations/003-clinic-foundation.js');
    const userPhoneMigration = await import('../../src/database/migrations/004-user-phone.js');
    const { UserModel } = await import('../../src/modules/user/v1/model/user.model.js');
    const { UserSessionModel } = await import('../../src/modules/user-session/v1/model/user-session.entity.js');
    const { UserService } = await import('../../src/modules/user/v1/user.service.js');
    const { Roles } = await import('../../src/constants/roles.js');
    const { initializeRedis, closeRedis } = await import('../../src/config/redis.js');
    await initializeRedis();

    await t.test('registered migrations install a fresh schema and skip previously applied entries', async () => {
        const status = execFileSync(process.execPath,
            ['--import', 'tsx', 'src/database/migrations/run-migrations.ts', 'status'], { env: process.env, encoding: 'utf8' });
        assert.match(status, /Pending: 003-clinic-foundation/);
        assert.deepEqual(await qi.showAllTables(), []);
        for (let i = 0; i < 2; i++) execFileSync(process.execPath,
            ['--import', 'tsx', 'src/database/migrations/run-migrations.ts', 'up'], { env: process.env, stdio: 'pipe' });
        const [rows] = await sequelize.query('SELECT name FROM "SequelizeMeta" ORDER BY name');
        assert.equal(rows.length, 6);
        const userColumns = await qi.describeTable('users');
        assert.equal('phone' in userColumns, true);
        assert.equal('provider' in userColumns, false);
        await userPhoneMigration.down(qi, sequelize);
        assert.equal('provider' in await qi.describeTable('users'), true);
        await userPhoneMigration.up(qi, sequelize);
        assert.equal('phone' in await qi.describeTable('users'), true);
        const columns = await qi.describeTable('user_sessions');
        assert.equal('fcmToken' in columns, false);
        const [cash] = await sequelize.query('SELECT name FROM payment_methods WHERE code = \'cash\'');
        assert.equal(cash.length, 1);
        assert.equal((cash[0] as { name: { en: string } }).name.en, 'Cash at Clinic');
    });

    await t.test('incompatible migration histories stop up/down/status without changing tables or bookkeeping', async () => {
        const marker = '003-clinic-domain';
        await sequelize.query('INSERT INTO "SequelizeMeta" (name) VALUES (:name)', { replacements: { name: marker } });
        const before = await qi.showAllTables();
        try {
            for (const command of ['up', 'down', 'status']) {
                assert.throws(() => execFileSync(process.execPath,
                    ['--import', 'tsx', 'src/database/migrations/run-migrations.ts', command], { env: process.env, stdio: 'pipe' }),
                (error: unknown) => {
                    const failure = error as { status: number; stderr: Buffer };
                    return failure.status === 1 && failure.stderr.toString().includes('Unrecognized migration history: 003-clinic-domain');
                });
            }
            assert.deepEqual(await qi.showAllTables(), before);
            const [rows] = await sequelize.query('SELECT name FROM "SequelizeMeta"');
            assert.equal(rows.length, 7);
        } finally {
            await sequelize.query('DELETE FROM "SequelizeMeta" WHERE name = :name', { replacements: { name: marker } });
        }
    });

    const { initializeAssociations } = await import('../../src/database/associations.js');
    initializeAssociations();
    const { initializeApp } = await import('../../src/app.js');
    const { passportConfig } = await import('../../src/config/passport.config.js');
    await passportConfig();
    const app = express();
    initializeApp(app);
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    cleanupResources = async () => {
        server.closeAllConnections();
        await new Promise<void>(resolve => server.close(() => resolve()));
        await closeRedis();
        await sequelize.close();
    };
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const base = 'http://127.0.0.1:' + address.port;
    const request = async (url: string, method = 'GET', body?: unknown, token?: string, language = 'en') => {
        const response = await fetch(base + url, { method, headers: {
            'Content-Type': 'application/json', 'Accept-Language': language, ...(token ? { Authorization: 'Bearer ' + token } : {}),
        }, body: body === undefined ? undefined : JSON.stringify(body) });
        return { status: response.status, body: await response.json() };
    };
    let accessToken: string;
    let refreshToken: string;
    let customerId: string;
    let adminId: string;
    await t.test('metadata, health and phone OTP registration work with authenticated profiles', async () => {
        const metadata = await request('/');
        assert.equal(metadata.status, 200);
        assert.equal(metadata.body.status, 'success');
        assert.equal(typeof metadata.body.data.appName, 'string');
        const roles = await request('/api/constant/roles');
        assert.equal(roles.body.status, 'success');
        assert.ok(Array.isArray(roles.body.data));
        const health = await request('/health');
        assert.equal(health.body.status, 'success');
        assert.equal(health.body.data.dependencies.database, 'up');
        const authenticate = sequelize.authenticate;
        try {
            sequelize.authenticate = async () => { throw new Error('simulated database outage'); };
            const degraded = await request('/health');
            assert.equal(degraded.status, 503);
            assert.equal(degraded.body.status, 'error');
            assert.equal(degraded.body.statusCode, 503);
            assert.equal(typeof degraded.body.message, 'string');
            assert.equal(degraded.body.data.status, 'degraded');
            assert.equal(degraded.body.data.dependencies.database, 'down');
        } finally {
            sequelize.authenticate = authenticate;
        }
        const openapi = await request('/api/docs/openapi.json');
        assert.equal(openapi.body.openapi, '3.0.3');
        assert.ok(openapi.body.components.schemas.Success);
        assert.ok(openapi.body.paths['/api/v1/branches'].get);
        assert.ok(openapi.body.paths['/api/v1/doctors/{id}/availability'].get);
        assert.ok(openapi.body.paths['/api/v1/appointments'].post);
        assert.ok(openapi.body.components.schemas.Appointment);
        assert.ok(openapi.body.paths['/api/v1/admin/specialties/{id}'].delete);
        const registration = { phone: '01012345678', name: 'Test Patient', password: 'TestOnly#123' };
        const invalid = await request('/api/v1/auth/register', 'POST', { ...registration, role: 'doctor' });
        assert.equal(invalid.status, 422);
        assert.equal(invalid.body.status, 'fail');
        assert.equal(invalid.body.statusCode, 422);
        assert.equal(typeof invalid.body.message, 'string');
        const registered = await request('/api/v1/auth/register', 'POST', registration);
        assert.equal(registered.status, 202);
        assert.equal(registered.body.status, 'success');
        assert.match(registered.body.data.otp, /^\d{6}$/);
        const unknownReset = await request('/api/v1/auth/forgot-password', 'POST', { phone: '01098765432' });
        assert.equal(unknownReset.status, 202);
        assert.equal(unknownReset.body.data, null);
        const immediateResend = await request('/api/v1/auth/register/resend-otp', 'POST', { phone: registration.phone });
        assert.equal(immediateResend.status, 429);
        const actualOtp = registered.body.data.otp as string;
        const wrongOtp = actualOtp === '000000' ? '000001' : '000000';
        for (let attempt = 0; attempt < 5; attempt++) {
            const invalidOtp = await request('/api/v1/auth/register/verify', 'POST', { phone: registration.phone, otp: wrongOtp });
            assert.equal(invalidOtp.status, 422);
        }
        await setTimeout(1100);
        const resent = await request('/api/v1/auth/register/resend-otp', 'POST', { phone: registration.phone });
        assert.equal(resent.status, 202);
        assert.match(resent.body.data.otp, /^\d{6}$/);
        const verified = await request('/api/v1/auth/register/verify', 'POST', { phone: registration.phone, otp: resent.body.data.otp });
        assert.equal(verified.status, 200);
        assert.equal(verified.body.data.user.role, 'customer');
        assert.equal(verified.body.data.user.phone, '+201012345678');
        assert.equal('password' in verified.body.data.user, false);
        assert.equal('otp' in verified.body, false);
        customerId = verified.body.data.user.id;
        const login = await request('/api/v1/auth/login', 'POST', { phone: registration.phone, password: registration.password });
        assert.equal(login.status, 200);
        assert.equal(login.body.status, 'success');
        assert.equal('password' in login.body.data.user, false);
        accessToken = login.body.data.accessToken.token;
        refreshToken = login.body.data.refreshToken;
        assert.equal((await request('/api/v1/auth/me', 'GET', undefined, accessToken)).status, 200);
        const forbidden = await request('/api/v1/users/filter', 'GET', undefined, accessToken);
        assert.equal(forbidden.status, 403);
        assert.equal(forbidden.body.status, 'fail');
        const invalidProfile = await request('/api/v1/auth/me', 'PATCH', { isBlocked: true }, accessToken);
        assert.equal(invalidProfile.status, 422);
        assert.equal(invalidProfile.body.status, 'fail');
        const admin = await UserService.createUser({ phone: '01112345678', name: 'Test Admin', password: 'TestOnly#123', role: Roles.ADMIN, isVerified: true });
        adminId = admin.id;
        const adminLogin = await request('/api/v1/auth/login', 'POST', { phone: admin.phone, password: 'TestOnly#123' });
        assert.equal(adminLogin.status, 200);
        const filtered = await request('/api/v1/users/filter?name=patient&role=customer', 'GET', undefined, adminLogin.body.data.accessToken.token);
        assert.equal(filtered.status, 200);
        assert.equal(filtered.body.data.page, 1);
        assert.equal(filtered.body.data.limit, 10);
        assert.equal(filtered.body.data.users[0].id, customerId);
        const loggedOut = await request('/api/v1/auth/logout', 'POST', { refreshToken: adminLogin.body.data.refreshToken });
        assert.equal(loggedOut.status, 200);
        assert.equal(loggedOut.body.status, 'success');
        assert.equal(loggedOut.body.data, null);
        const missing = await request('/this-route-does-not-exist');
        assert.equal(missing.status, 404);
        assert.equal(missing.body.status, 'fail');
        assert.equal(missing.body.statusCode, 404);
        assert.equal(typeof missing.body.message, 'string');
        assert.equal((await request('/api/v1/auth/google', 'GET', undefined, accessToken)).status, 404);
        assert.equal((await request('/api/v1/auth/google/callback', 'GET', undefined, accessToken)).status, 404);
        assert.equal((await request('/api/v1/auth/google/mobile', 'POST', { idToken: 'unused' }, accessToken)).status, 404);
        assert.equal((await request('/api/v1/user-session/fcm-token', 'PATCH', { fcmToken: 'unused' })).status, 404);
    });
    await t.test('branch and specialty APIs enforce access, search, pagination and reference-safe deletion', async () => {
        const adminLogin = await request('/api/v1/auth/login', 'POST', { phone: '01112345678', password: 'TestOnly#123' });
        const adminToken = adminLogin.body.data.accessToken.token as string;
        assert.equal((await request('/api/v1/admin/branches', 'GET')).status, 401);
        assert.equal((await request('/api/v1/admin/specialties', 'GET', undefined, accessToken)).status, 403);

        const branchInput = (en: string, ar: string, isActive = true) => ({
            name: { en, ar }, address: { en: en + ' address', ar: ar + ' عنوان' }, isActive,
        });
        const specialtyInput = (en: string, ar: string, isActive = true) => ({ name: { en, ar }, isActive });

        const firstBranchResponse = await request('/api/v1/admin/branches', 'POST', branchInput('Nile Clinic', 'عيادة النيل'), adminToken);
        assert.equal(firstBranchResponse.status, 201);
        const firstBranch = firstBranchResponse.body.data.branch;
        assert.equal(firstBranch.timezone, 'Africa/Cairo');
        const secondBranchResponse = await request('/api/v1/admin/branches', 'POST', branchInput('Cairo Clinic', 'عيادة القاهرة'), adminToken);
        const secondBranch = secondBranchResponse.body.data.branch;
        const inactiveBranchResponse = await request('/api/v1/admin/branches', 'POST', branchInput('Hidden Clinic', 'عيادة مخفية', false), adminToken);
        const inactiveBranch = inactiveBranchResponse.body.data.branch;
        const firstSpecialtyResponse = await request('/api/v1/admin/specialties', 'POST', specialtyInput('Cardiology', 'أمراض القلب'), adminToken);
        assert.equal(firstSpecialtyResponse.status, 201);
        const firstSpecialty = firstSpecialtyResponse.body.data.specialty;
        const secondSpecialtyResponse = await request('/api/v1/admin/specialties', 'POST', specialtyInput('Neurology', 'طب الأعصاب'), adminToken);
        const secondSpecialty = secondSpecialtyResponse.body.data.specialty;
        const inactiveSpecialtyResponse = await request('/api/v1/admin/specialties', 'POST', specialtyInput('Hidden Specialty', 'تخصص مخفي', false), adminToken);
        const inactiveSpecialty = inactiveSpecialtyResponse.body.data.specialty;

        const publicBranches = await request('/api/v1/branches?search=clinic&page=1&limit=1');
        assert.equal(publicBranches.status, 200);
        assert.equal(publicBranches.body.data.page, 1);
        assert.equal(publicBranches.body.data.limit, 1);
        assert.equal(publicBranches.body.data.total, 2);
        assert.equal(publicBranches.body.data.items.length, 1);
        assert.equal(publicBranches.body.data.items[0].isActive, true);
        const emptyBranches = await request('/api/v1/branches?search=missing');
        assert.deepEqual(emptyBranches.body.data.items, []);
        assert.equal(emptyBranches.body.data.total, 0);
        const arabicBranches = await request('/api/v1/branches?search=%D8%A7%D9%84%D9%86%D9%8A%D9%84');
        assert.equal(arabicBranches.body.data.total, 1);
        assert.equal(arabicBranches.body.data.items[0].id, firstBranch.id);
        const publicSpecialties = await request('/api/v1/specialties?search=cardio');
        assert.equal(publicSpecialties.body.data.total, 1);
        assert.equal(publicSpecialties.body.data.items[0].id, firstSpecialty.id);
        const allPublicSpecialties = await request('/api/v1/specialties');
        assert.equal(allPublicSpecialties.body.data.total, 2);
        assert.equal(allPublicSpecialties.body.data.page, 1);
        assert.equal(allPublicSpecialties.body.data.limit, 10);
        const emptySpecialties = await request('/api/v1/specialties?search=missing');
        assert.deepEqual(emptySpecialties.body.data.items, []);
        assert.equal(emptySpecialties.body.data.total, 0);
        const arabicSpecialties = await request('/api/v1/specialties?search=%D8%A7%D9%84%D8%A3%D8%B9%D8%B5%D8%A7%D8%A8');
        assert.equal(arabicSpecialties.body.data.total, 1);
        assert.equal(arabicSpecialties.body.data.items[0].id, secondSpecialty.id);
        const invalidPagination = await request('/api/v1/branches?limit=101');
        assert.equal(invalidPagination.status, 422);

        const adminInactiveBranches = await request('/api/v1/admin/branches?isActive=false&search=hidden', 'GET', undefined, adminToken);
        assert.equal(adminInactiveBranches.body.data.total, 1);
        assert.equal(adminInactiveBranches.body.data.items[0].id, inactiveBranch.id);
        const adminInactiveSpecialties = await request('/api/v1/admin/specialties?isActive=false&search=hidden', 'GET', undefined, adminToken);
        assert.equal(adminInactiveSpecialties.body.data.total, 1);
        assert.equal(adminInactiveSpecialties.body.data.items[0].id, inactiveSpecialty.id);

        const updatedBranch = await request('/api/v1/admin/branches/' + secondBranch.id, 'PATCH', { phone: '+201001234567' }, adminToken);
        assert.equal(updatedBranch.status, 200);
        assert.equal(updatedBranch.body.data.branch.phone, '+201001234567');
        assert.equal((await request('/api/v1/admin/branches/' + secondBranch.id, 'PATCH', {}, adminToken)).status, 422);
        const updatedSpecialty = await request('/api/v1/admin/specialties/' + secondSpecialty.id, 'PATCH', { description: { en: 'Nerves', ar: 'الأعصاب' } }, adminToken);
        assert.equal(updatedSpecialty.status, 200);
        assert.equal(updatedSpecialty.body.data.specialty.description.en, 'Nerves');
        assert.equal((await request('/api/v1/admin/branches/' + randomUUID(), 'GET', undefined, adminToken)).status, 404);
        assert.equal((await request('/api/v1/admin/specialties/' + randomUUID(), 'GET', undefined, adminToken)).status, 404);

        const doctorInput = {
            phone: '01511112222', accountName: 'Catalog Doctor', password: 'DoctorOnly#123',
            branchId: firstBranch.id, specialtyId: firstSpecialty.id,
            name: { en: 'Catalog Doctor', ar: 'طبيب الفهرس' }, appointmentPrice: '100.00',
            appointmentDurationMinutes: 30,
        };
        const { DoctorService } = await import('../../src/modules/doctors/v1/doctor.service.js');
        await assert.rejects(() => DoctorService.create({ ...doctorInput, phone: '01511112225', appointmentDurationMinutes: 0 }));
        assert.equal(await UserModel.findOne({ where: { phone: '+201511112225' } }), null);
        assert.equal((await request('/api/v1/admin/doctors', 'GET')).status, 401);
        assert.equal((await request('/api/v1/admin/doctors', 'GET', undefined, accessToken)).status, 403);
        assert.equal((await request('/api/v1/admin/doctors', 'POST', { ...doctorInput, branchId: inactiveBranch.id }, adminToken)).status, 422);
        const createdDoctorResponse = await request('/api/v1/admin/doctors', 'POST', doctorInput, adminToken);
        assert.equal(createdDoctorResponse.status, 201);
        const doctor = createdDoctorResponse.body.data.doctor;
        assert.equal(doctor.currency, 'EGP');
        assert.equal(doctor.user.role, Roles.DOCTOR);
        assert.equal(doctor.user.isVerified, true);
        assert.equal('password' in doctor.user, false);
        const doctorDetails = await request('/api/v1/admin/doctors/' + doctor.id, 'GET', undefined, adminToken);
        assert.equal(doctorDetails.status, 200);
        assert.equal(doctorDetails.body.data.doctor.branch.id, firstBranch.id);
        assert.equal(doctorDetails.body.data.doctor.specialty.id, firstSpecialty.id);
        assert.equal((await request('/api/v1/admin/doctors', 'POST', doctorInput, adminToken)).status, 409);
        assert.equal((await request('/api/v1/users', 'POST', {
            phone: '01511112223', name: 'Unsupported Doctor', password: 'DoctorOnly#123', role: Roles.DOCTOR,
        }, adminToken)).status, 422);
        const listedDoctors = await request('/api/v1/admin/doctors?search=Catalog&branchId=' + firstBranch.id + '&specialtyId=' + firstSpecialty.id + '&isActive=true&page=1&limit=10', 'GET', undefined, adminToken);
        assert.equal(listedDoctors.status, 200);
        assert.equal(listedDoctors.body.data.total, 1);
        assert.equal(listedDoctors.body.data.items[0].id, doctor.id);
        const invalidDoctorReference = await request('/api/v1/admin/doctors', 'POST', { ...doctorInput, phone: '01511112224', branchId: randomUUID() }, adminToken);
        assert.equal(invalidDoctorReference.status, 422);
        const updatedDoctorResponse = await request('/api/v1/admin/doctors/' + doctor.id, 'PATCH', { appointmentPrice: '150.00', isAvailable: false }, adminToken);
        assert.equal(updatedDoctorResponse.status, 200);
        assert.equal(updatedDoctorResponse.body.data.doctor.appointmentPrice, '150.00');
        assert.equal(updatedDoctorResponse.body.data.doctor.isAvailable, false);
        assert.equal((await request('/api/v1/users/' + doctor.userId, 'PATCH', { role: Roles.USER }, adminToken)).status, 409);
        assert.equal((await request('/api/v1/users/' + doctor.userId, 'DELETE', undefined, adminToken)).status, 409);
        const schedulePath = '/api/v1/admin/doctors/' + doctor.id + '/schedules';
        const exceptionPath = '/api/v1/admin/doctors/' + doctor.id + '/schedule-exceptions';
        assert.equal((await request(schedulePath)).status, 401);
        assert.equal((await request(schedulePath, 'GET', undefined, accessToken)).status, 403);
        assert.equal((await request(schedulePath, 'PUT', { intervals: [] }, accessToken)).status, 403);
        assert.deepEqual((await request(schedulePath, 'GET', undefined, adminToken)).body.data,
            { timezone: 'Africa/Cairo', intervals: [] });
        const mondayHours = [{ weekday: 1, startTime: '09:00', endTime: '12:00' }, { weekday: 1, startTime: '12:00', endTime: '15:00' }];
        assert.equal((await request(schedulePath, 'PUT', { intervals: mondayHours }, adminToken)).status, 200);
        assert.deepEqual((await request(schedulePath, 'GET', undefined, adminToken)).body.data.intervals, mondayHours);
        assert.equal((await request(schedulePath, 'PUT', { intervals: [mondayHours[0], { weekday: 1, startTime: '11:59', endTime: '13:00' }] }, adminToken)).status, 409);
        assert.equal((await request(schedulePath, 'GET', undefined, adminToken)).body.data.intervals.length, 2);
        assert.equal((await request(schedulePath, 'PUT', { intervals: [{ weekday: 1, startTime: '16:00', endTime: '09:00' }] }, adminToken)).status, 422);
        assert.equal((await request(schedulePath, 'PUT', { intervals: [{ weekday: '1', startTime: '09:00', endTime: '12:00' }] }, adminToken)).status, 422);
        assert.equal((await request(schedulePath + '?intervals=invalid', 'PUT', { intervals: mondayHours }, adminToken)).status, 422);
        assert.equal((await request('/api/v1/admin/doctors/invalid/schedules?id=' + doctor.id, 'GET', undefined, adminToken)).status, 422);
        const secondDoctorResponse = await request('/api/v1/admin/doctors', 'POST', { ...doctorInput, phone: '01511112226' }, adminToken);
        assert.equal(secondDoctorResponse.status, 201);
        const secondDoctorSchedule = '/api/v1/admin/doctors/' + secondDoctorResponse.body.data.doctor.id + '/schedules';
        assert.equal((await request(secondDoctorSchedule, 'PUT', { intervals: mondayHours }, adminToken)).status, 200);
        const offDate = exceptionPath + '/2026-11-02';
        assert.equal((await request(offDate, 'PUT', { isDayOff: true, reason: { ar: 'إجازة', en: 'Day off' } }, adminToken)).status, 200);
        assert.equal((await request(offDate, 'PUT', { isDayOff: true, intervals: [] }, adminToken)).status, 422);
        const replacement = [{ startTime: '10:00', endTime: '11:00' }, { startTime: '11:00', endTime: '13:00' }];
        assert.equal((await request(offDate, 'PUT', { isDayOff: false, intervals: replacement }, adminToken)).status, 200);
        const exceptions = await request(exceptionPath + '?from=2026-11-01&to=2026-11-30', 'GET', undefined, adminToken);
        assert.equal(exceptions.status, 200);
        assert.deepEqual(exceptions.body.data.exceptions[0].intervals, replacement);
        assert.equal((await request(offDate, 'PUT', { isDayOff: false, intervals: [{ startTime: '10:00', endTime: '12:00' }, { startTime: '11:00', endTime: '13:00' }] }, adminToken)).status, 409);
        assert.equal((await request(exceptionPath + '?from=2026-12-01&to=2026-11-01', 'GET', undefined, adminToken)).status, 422);
        assert.equal((await request('/api/v1/admin/doctors/' + doctor.id, 'PATCH', { branchId: secondBranch.id }, adminToken)).status, 409);
        assert.equal((await request(schedulePath, 'PUT', { intervals: [] }, adminToken)).status, 200);
        assert.equal((await request('/api/v1/admin/doctors/' + doctor.id, 'PATCH', { branchId: secondBranch.id }, adminToken)).status, 409);
        assert.equal((await request(offDate, 'DELETE', undefined, adminToken)).status, 200);
        assert.equal((await request(offDate, 'DELETE', undefined, adminToken)).status, 404);
        assert.deepEqual((await request(exceptionPath + '?from=2026-11-01&to=2026-11-30', 'GET', undefined, adminToken)).body.data.exceptions, []);
        assert.equal((await request('/api/v1/admin/doctors/' + doctor.id, 'PATCH', { branchId: secondBranch.id }, adminToken)).status, 200);
        assert.equal((await request('/api/v1/admin/doctors/' + doctor.id, 'PATCH', { branchId: firstBranch.id }, adminToken)).status, 200);
        const { AppointmentModel } = await import('../../src/modules/appointments/v1/model/appointment.model.js');
        await AppointmentModel.create({
            doctorId: doctor.id, customerId, branchId: firstBranch.id,
            startsAt: new Date('2026-10-25T08:00:00.000Z'), endsAt: new Date('2026-10-25T08:30:00.000Z'),
            timezone: 'Africa/Cairo', durationMinutes: 30, bookedPrice: '100.00', currency: 'EGP',
        });
        const deactivatedDoctor = await request('/api/v1/admin/doctors/' + doctor.id, 'DELETE', undefined, adminToken);
        assert.equal(deactivatedDoctor.status, 200);
        assert.equal(deactivatedDoctor.body.data.doctor.isActive, false);
        assert.equal(await AppointmentModel.count({ where: { doctorId: doctor.id } }), 1);
        const reactivatedDoctor = await request('/api/v1/admin/doctors/' + doctor.id, 'PATCH', { isActive: true }, adminToken);
        assert.equal(reactivatedDoctor.body.data.doctor.isActive, true);

        const deactivatedBranch = await request('/api/v1/admin/branches/' + firstBranch.id, 'DELETE', undefined, adminToken);
        assert.equal(deactivatedBranch.status, 200);
        assert.equal(deactivatedBranch.body.data.branch.isActive, false);
        const deactivatedSpecialty = await request('/api/v1/admin/specialties/' + firstSpecialty.id, 'DELETE', undefined, adminToken);
        assert.equal(deactivatedSpecialty.body.data.specialty.isActive, false);
        const deletedBranch = await request('/api/v1/admin/branches/' + secondBranch.id, 'DELETE', undefined, adminToken);
        assert.equal(deletedBranch.status, 200);
        assert.equal((await request('/api/v1/admin/branches/' + secondBranch.id, 'GET', undefined, adminToken)).status, 404);
        const deletedSpecialty = await request('/api/v1/admin/specialties/' + secondSpecialty.id, 'DELETE', undefined, adminToken);
        assert.equal(deletedSpecialty.status, 200);
        assert.equal((await request('/api/v1/admin/specialties/' + secondSpecialty.id, 'GET', undefined, adminToken)).status, 404);
    });

    await t.test('public browsing, availability and atomic customer booking', async t => {
        const { BranchModel } = await import('../../src/modules/branches/v1/model/branch.model.js');
        const { SpecialtyModel } = await import('../../src/modules/specialties/v1/model/specialty.model.js');
        const { AppointmentModel } = await import('../../src/modules/appointments/v1/model/appointment.model.js');
        const { DoctorService } = await import('../../src/modules/doctors/v1/doctor.service.js');
        const { DoctorScheduleService } = await import('../../src/modules/doctor-schedules/v1/doctor-schedule.service.js');
        const overlapMigration = await import('../../src/database/migrations/005-appointment-overlap-protection.js');
        const text = { en: 'Booking Clinic', ar: 'عيادة الحجز' };
        const branch = await BranchModel.create({ name: text, address: text, timezone: 'Africa/Cairo' });
        const specialty = await SpecialtyModel.create({ name: text });
        const doctors = [];
        for (let index = 0; index < 3; index++) {
            doctors.push(await DoctorService.create({
                phone: '0123456700' + index, accountName: 'Booking Doctor ' + index, password: 'TestOnly#123',
                branchId: branch.id, specialtyId: specialty.id, name: { en: 'Booking Doctor ' + index, ar: 'طبيب الحجز ' + index },
                appointmentPrice: '125.50', appointmentDurationMinutes: 30,
            }));
        }
        const customers = [];
        const tokens: string[] = [];
        for (let index = 0; index < 3; index++) {
            const user = await UserModel.create({ phone: '+20103456700' + index, name: 'Booking Customer ' + index,
                password: 'TestOnly#123', role: Roles.USER, isVerified: true, isBlocked: false });
            customers.push(user);
            const login = await request('/api/v1/auth/login', 'POST', { phone: user.phone, password: 'TestOnly#123' });
            tokens.push(login.body.data.accessToken.token);
        }
        const tomorrow = Temporal.Now.zonedDateTimeISO(branch.timezone).toPlainDate().add({ days: 1 });
        const date = tomorrow.toString();
        for (const doctor of doctors) await DoctorScheduleService.replaceWeekly(doctor.id, [{ weekday: tomorrow.dayOfWeek % 7, startTime: '09:00', endTime: '16:00' }]);
        const availabilityPath = (id: string, from = date, to = date) => `/api/v1/doctors/${id}/availability?from=${from}&to=${to}`;
        const initial = await request(availabilityPath(doctors[0].id));
        assert.equal(initial.status, 200);
        const slots = initial.body.data.days[0].slots as { startsAt: string; endsAt: string }[];
        assert.equal(slots.length, 14);
        let bookedId: string;

        await t.test('public projections, search, eligibility and strict request sources', async () => {
            const browse = await request(`/api/v1/doctors?branchId=${branch.id}&specialtyId=${specialty.id}&search=Booking&page=1&limit=2`);
            assert.equal(browse.status, 200);
            assert.equal(browse.body.data.total, 3);
            assert.equal(browse.body.data.items.length, 2);
            const detail = (await request('/api/v1/doctors/' + doctors[0].id)).body.data.doctor;
            assert.equal(detail.name.ar, 'طبيب الحجز 0');
            assert.equal(detail.appointmentPrice, '125.50');
            for (const key of ['user', 'userId', 'phone', 'password', 'isBlocked', 'isVerified']) assert.equal(key in detail, false);
            assert.equal((await request('/api/v1/doctors?search=' + encodeURIComponent('طبيب الحجز'))).body.data.total, 3);
            await doctors[0].update({ isAvailable: false });
            assert.equal((await request('/api/v1/doctors/' + doctors[0].id)).status, 200);
            assert.deepEqual((await request(availabilityPath(doctors[0].id))).body.data.days[0].slots, []);
            assert.equal((await request('/api/v1/appointments', 'POST', { doctorId: doctors[0].id, startsAt: slots[0].startsAt }, tokens[0])).status, 409);
            assert.equal((await request(`/api/v1/doctors?branchId=${branch.id}&isAvailable=FALSE`)).body.data.total, 1);
            await doctors[0].update({ isAvailable: true });
            for (const [model, changes] of [[branch, { isActive: false }], [specialty, { isActive: false }], [doctors[0], { isActive: false }], [doctors[0].user, { isBlocked: true }]] as const) {
                await model.update(changes);
                assert.equal((await request('/api/v1/doctors/' + doctors[0].id)).status, 404);
                assert.equal((await request(availabilityPath(doctors[0].id))).status, 404);
                assert.equal((await request('/api/v1/appointments', 'POST', { doctorId: doctors[0].id, startsAt: slots[0].startsAt }, tokens[0])).status, 409);
                await model.update('isBlocked' in changes ? { isBlocked: false } : { isActive: true });
            }
            await UserModel.update({ role: Roles.USER }, { where: { id: doctors[0].userId } });
            assert.equal((await request('/api/v1/doctors/' + doctors[0].id)).status, 404);
            await UserModel.update({ role: Roles.DOCTOR }, { where: { id: doctors[0].userId } });
            assert.equal((await request('/api/v1/appointments', 'POST', { doctorId: doctors[0].id, startsAt: slots[0].startsAt })).status, 401);
            const adminLogin = await request('/api/v1/auth/login', 'POST', { phone: '01112345678', password: 'TestOnly#123' });
            assert.equal((await request('/api/v1/appointments', 'GET', undefined, adminLogin.body.data.accessToken.token)).status, 403);
            const doctorLogin = await request('/api/v1/auth/login', 'POST', { phone: doctors[0].user.phone, password: 'TestOnly#123' });
            assert.equal((await request('/api/v1/appointments', 'GET', undefined, doctorLogin.body.data.accessToken.token)).status, 403);
            for (const field of ['customerId', 'status', 'branchId', 'bookedPrice', 'currency', 'durationMinutes', 'endsAt']) {
                assert.equal((await request('/api/v1/appointments', 'POST', { doctorId: doctors[0].id, startsAt: slots[0].startsAt, [field]: 'injected' }, tokens[0])).status, 422);
            }
            assert.equal((await request(`/api/v1/appointments?doctorId=${doctors[0].id}`, 'POST', { startsAt: slots[0].startsAt }, tokens[0])).status, 422);
            assert.equal((await request(availabilityPath(doctors[0].id) + '&id=' + doctors[1].id)).status, 422);
            assert.equal((await request(availabilityPath(doctors[0].id, tomorrow.add({ days: 89 }).toString(), tomorrow.add({ days: 89 }).toString()))).status, 200);
            assert.equal((await request(availabilityPath(doctors[0].id, date, tomorrow.add({ days: 31 }).toString()))).status, 422);
            assert.equal((await request(availabilityPath(doctors[0].id, tomorrow.add({ days: 91 }).toString(), tomorrow.add({ days: 91 }).toString()))).status, 422);
            assert.equal((await request(availabilityPath(doctors[0].id, tomorrow.subtract({ days: 2 }).toString()))).status, 422);
            assert.equal((await request(availabilityPath(doctors[0].id, '2026-02-30'))).status, 422);
            assert.equal((await request('/api/v1/doctors/' + doctors[0].id + '/availability?from=' + date)).status, 422);
        });

        await t.test('doctor and customer booking races each permit exactly one winner', async () => {
            const doctorRace = await Promise.all(tokens.slice(0, 2).map(token => request('/api/v1/appointments', 'POST', { doctorId: doctors[0].id, startsAt: slots[0].startsAt }, token)));
            assert.deepEqual(doctorRace.map(row => row.status).sort(), [201, 409]);
            const booked = doctorRace.find(row => row.status === 201).body.data.appointment;
            bookedId = booked.id;
            assert.equal(booked.status, 'confirmed');
            assert.equal(booked.bookedPrice, '125.50');
            assert.equal(booked.currency, 'EGP');
            assert.equal(booked.timezone, branch.timezone);
            assert.equal(booked.branchId, branch.id);
            assert.equal(booked.durationMinutes, 30);
            assert.equal(booked.endsAt, slots[0].endsAt);
            const customerRace = await Promise.all(doctors.slice(1).map(doctor => request('/api/v1/appointments', 'POST', { doctorId: doctor.id, startsAt: slots[2].startsAt }, tokens[2])));
            assert.deepEqual(customerRace.map(row => row.status).sort(), [201, 409]);
            const independent = await Promise.all([
                request('/api/v1/appointments', 'POST', { doctorId: doctors[0].id, startsAt: slots[4].startsAt }, tokens[0]),
                request('/api/v1/appointments', 'POST', { doctorId: doctors[1].id, startsAt: slots[4].startsAt }, tokens[1]),
            ]);
            assert.deepEqual(independent.map(row => row.status), [201, 201]);
            // Adjacent times are valid for both the doctor and the same customer.
            assert.equal((await request('/api/v1/appointments', 'POST', { doctorId: doctors[0].id, startsAt: slots[5].startsAt }, tokens[0])).status, 201);
            const busy = (await request(availabilityPath(doctors[0].id))).body.data.days[0].slots;
            assert.equal(busy.some(slot => slot.startsAt === slots[0].startsAt), false);
        });

        await t.test('ownership, filters, stale slots, explicit offsets and localized failures', async () => {
            const booked = await AppointmentModel.findByPk(bookedId);
            const owner = customers.findIndex(customer => customer.id === booked.customerId);
            const other = owner === 0 ? 1 : 0;
            assert.equal((await request('/api/v1/appointments/' + bookedId, 'GET', undefined, tokens[owner])).status, 200);
            assert.equal((await request('/api/v1/appointments/' + bookedId, 'GET', undefined, tokens[other])).status, 404);
            assert.equal((await request('/api/v1/appointments/' + bookedId + '?id=' + randomUUID(), 'GET', undefined, tokens[owner])).status, 422);
            const history = await request(`/api/v1/appointments?doctorId=${doctors[0].id}&status=confirmed&limit=1`, 'GET', undefined, tokens[owner]);
            assert.equal(history.body.data.items.length, 1);
            assert.ok(history.body.data.items.every(row => row.customerId === booked.customerId));
            assert.equal(history.body.data.limit, 1);
            const duplicateBody = { doctorId: doctors[0].id, startsAt: slots[0].startsAt };
            assert.equal((await request('/api/v1/appointments', 'POST', duplicateBody, tokens[owner])).status, 409);
            const arabic = await fetch(base + '/api/v1/appointments', { method: 'POST', headers: {
                'Content-Type': 'application/json', 'Accept-Language': 'ar', Authorization: 'Bearer ' + tokens[owner],
            }, body: JSON.stringify(duplicateBody) });
            assert.equal(arabic.status, 409);
            assert.match((await arabic.json()).message, /[\u0600-\u06ff]/);
            const invalidArabic = await fetch(base + '/api/v1/appointments', { method: 'POST', headers: {
                'Content-Type': 'application/json', 'Accept-Language': 'ar', Authorization: 'Bearer ' + tokens[owner],
            }, body: JSON.stringify({ doctorId: 'invalid' }) });
            assert.equal(invalidArabic.status, 422);
            assert.match((await invalidArabic.json()).message, /[\u0600-\u06ff]/);
            assert.equal((await request('/api/v1/appointments', 'POST', { doctorId: doctors[0].id, startsAt: slots[7].startsAt.slice(0, -1) }, tokens[0])).status, 422);
            const offset = Temporal.Instant.from(slots[7].startsAt).toZonedDateTimeISO(branch.timezone).toString({ timeZoneName: 'never' });
            const offsetBooking = await request('/api/v1/appointments', 'POST', { doctorId: doctors[0].id, startsAt: offset }, tokens[0]);
            assert.equal(offsetBooking.status, 201);
            assert.equal(offsetBooking.body.data.appointment.startsAt, slots[7].startsAt);
            const offGrid = new Date(new Date(slots[8].startsAt).getTime() + 60000).toISOString();
            assert.equal((await request('/api/v1/appointments', 'POST', { doctorId: doctors[0].id, startsAt: offGrid }, tokens[0])).status, 409);
            await DoctorScheduleService.setException(doctors[0].id, date, { isDayOff: true });
            assert.deepEqual((await request(availabilityPath(doctors[0].id))).body.data.days[0].slots, []);
            assert.equal((await request('/api/v1/appointments', 'POST', { doctorId: doctors[0].id, startsAt: slots[8].startsAt }, tokens[0])).status, 409);
            await DoctorScheduleService.deleteException(doctors[0].id, date);
            await DoctorScheduleService.setException(doctors[0].id, date, { isDayOff: false, intervals: [{ startTime: '17:00', endTime: '18:00' }] });
            const replacement = (await request(availabilityPath(doctors[0].id))).body.data.days[0].slots;
            assert.equal(replacement.length, 2);
            assert.equal(Temporal.Instant.from(replacement[0].startsAt).toZonedDateTimeISO(branch.timezone).hour, 17);
            await DoctorScheduleService.deleteException(doctors[0].id, date);
        });

        await t.test('database constraints cover direct writes, cancelled rows, preflight and safe rollback', async () => {
            const booked = await AppointmentModel.findByPk(bookedId);
            const input = { customerId: customers[2].id, doctorId: booked.doctorId, branchId: branch.id,
                startsAt: booked.startsAt, endsAt: booked.endsAt, timezone: branch.timezone, durationMinutes: 30, bookedPrice: '125.50', currency: 'EGP', status: 'confirmed' };
            await assert.rejects(() => AppointmentModel.create(input), /conflict|exclusion/i);
            const partial = { ...input, startsAt: new Date(input.startsAt.getTime() + 15 * 60000), endsAt: new Date(input.endsAt.getTime() + 15 * 60000) };
            await assert.rejects(() => AppointmentModel.create(partial), /conflict|exclusion/i);
            await assert.rejects(() => AppointmentModel.create({ ...input, doctorId: doctors[2].id, customerId: booked.customerId }), /conflict|exclusion/i);
            await assert.rejects(() => AppointmentModel.create({ ...partial, doctorId: doctors[2].id, customerId: booked.customerId }), /conflict|exclusion/i);
            const cancelled = await AppointmentModel.create({ ...input, status: 'cancelled' });
            await cancelled.destroy();
            const released = await request('/api/v1/appointments', 'POST', { doctorId: doctors[2].id, startsAt: slots[10].startsAt }, tokens[0]);
            assert.equal(released.status, 201);
            await AppointmentModel.update({ status: 'cancelled' }, { where: { id: released.body.data.appointment.id } });
            assert.ok((await request(availabilityPath(doctors[2].id))).body.data.days[0].slots.some(slot => slot.startsAt === slots[10].startsAt));
            assert.equal((await request('/api/v1/appointments', 'POST', { doctorId: doctors[2].id, startsAt: slots[10].startsAt }, tokens[0])).status, 201);
            const count = await AppointmentModel.count();
            await overlapMigration.down(qi, sequelize);
            assert.equal(await AppointmentModel.count(), count);
            const conflicting = await AppointmentModel.create(input);
            await assert.rejects(() => overlapMigration.up(qi, sequelize), /Resolve doctor\/customer conflicts explicitly/);
            assert.equal(await AppointmentModel.count(), count + 1);
            await conflicting.destroy();
            await overlapMigration.up(qi, sequelize);
            await assert.rejects(() => AppointmentModel.create(input), /conflict|exclusion/i);
        });

        await t.test('booked snapshots survive schedule, price, duration, timezone and branch changes', async () => {
            const before = (await AppointmentModel.findByPk(bookedId)).toJSON();
            await DoctorScheduleService.replaceWeekly(doctors[0].id, []);
            const otherBranch = await BranchModel.create({ name: text, address: text, timezone: 'UTC' });
            await DoctorService.update(doctors[0].id, { branchId: otherBranch.id, appointmentPrice: '300.00', currency: 'USD', appointmentDurationMinutes: 45 });
            await branch.update({ timezone: 'America/New_York' });
            const after = (await AppointmentModel.findByPk(bookedId)).toJSON();
            for (const field of ['branchId', 'timezone', 'durationMinutes', 'bookedPrice', 'currency', 'startsAt', 'endsAt']) assert.deepEqual(after[field], before[field]);
        });
    });

    await t.test('customer can reset password and verify a phone change through returned OTPs', async () => {
        const forgot = await request('/api/v1/auth/forgot-password', 'POST', { phone: '01012345678' });
        const resetOtp = forgot.body.data.otp as string;
        assert.match(resetOtp, /^\d{6}$/);
        const reset = await request('/api/v1/auth/reset-password', 'POST', {
            phone: '01012345678', otp: resetOtp, newPassword: 'ResetOnly#456'
        });
        assert.equal(reset.status, 200);
        assert.equal(await UserSessionModel.count({ where: { userId: customerId } }), 0);

        const login = await request('/api/v1/auth/login', 'POST', { phone: '01012345678', password: 'ResetOnly#456' });
        assert.equal(login.status, 200);
        const access = login.body.data.accessToken.token;
        const change = await request('/api/v1/auth/me/phone', 'PATCH', { phone: '01212345678' }, access);
        assert.equal(change.status, 202);
        const changeOtp = change.body.data.otp as string;
        assert.match(changeOtp, /^\d{6}$/);
        const verified = await request('/api/v1/auth/me/phone/verify', 'POST', { otp: changeOtp }, access);
        assert.equal(verified.status, 200);
        assert.equal(verified.body.data.user.phone, '+201212345678');
        assert.equal((await request('/api/v1/auth/me', 'GET', undefined, access)).status, 200);
        const cooldown = await request('/api/v1/auth/me/phone', 'PATCH', { phone: '01512345678' }, access);
        assert.equal(cooldown.status, 429);
    });
    await t.test('blocked users, deleted sessions and invalid refresh tokens fail cleanly', async () => {
        const currentLogin = await request('/api/v1/auth/login', 'POST', { phone: '01212345678', password: 'ResetOnly#456' });
        accessToken = currentLogin.body.data.accessToken.token;
        refreshToken = currentLogin.body.data.refreshToken;
        await UserSessionModel.update({ expiresAt: new Date(0) }, { where: { userId: customerId } });
        assert.equal((await request('/api/v1/auth/me', 'GET', undefined, accessToken)).status, 401);
        assert.equal((await request('/api/v1/auth/refresh-token', 'POST', { refreshToken })).status, 401);
        await UserSessionModel.update({ expiresAt: new Date(Date.now() + 60000), userId: adminId }, { where: { userId: customerId } });
        assert.equal((await request('/api/v1/auth/me', 'GET', undefined, accessToken)).status, 401);
        assert.equal((await request('/api/v1/auth/refresh-token', 'POST', { refreshToken })).status, 401);
        await UserSessionModel.update({ userId: customerId }, { where: { refreshToken } });
        await UserModel.update({ isBlocked: true }, { where: { id: customerId } });
        assert.equal((await request('/api/v1/auth/me', 'GET', undefined, accessToken)).status, 403);
        assert.equal((await request('/api/v1/auth/refresh-token', 'POST', { refreshToken })).status, 403);
        await UserModel.update({ isBlocked: false }, { where: { id: customerId } });
        assert.equal((await request('/api/v1/auth/refresh-token', 'POST', { refreshToken: 'invalid' })).status, 401);
        const concurrentRotations = await Promise.all([
            request('/api/v1/auth/refresh-token', 'POST', { refreshToken }),
            request('/api/v1/auth/refresh-token', 'POST', { refreshToken })
        ]);
        assert.deepEqual(concurrentRotations.map(response => response.status).sort(), [200, 401]);
        const rotated = concurrentRotations.find(response => response.status === 200);
        assert.ok(rotated);
        const currentRefreshToken = rotated.body.data.refreshToken;
        assert.equal((await request('/api/v1/auth/refresh-token', 'POST', { refreshToken })).status, 401);
        assert.equal((await request('/api/v1/auth/refresh-token', 'POST', { refreshToken: currentRefreshToken })).status, 200);
        await UserSessionModel.destroy({ where: { userId: customerId } });
        assert.equal((await request('/api/v1/auth/me', 'GET', undefined, accessToken)).status, 401);
    });
    await t.test('password changes transactionally revoke all sessions, only after password validation', async () => {
        const originalPassword = 'ResetOnly#456';
        const newPassword = 'ChangedOnly#456';
        const firstLogin = await request('/api/v1/auth/login', 'POST', { phone: '01212345678', password: 'ResetOnly#456' });
        const secondLogin = await request('/api/v1/auth/login', 'POST', { phone: '01212345678', password: 'ResetOnly#456' });
        assert.equal(firstLogin.status, 200);
        assert.equal(secondLogin.status, 200);
        const firstAccess = firstLogin.body.data.accessToken.token;
        const secondAccess = secondLogin.body.data.accessToken.token;
        const firstRefresh = firstLogin.body.data.refreshToken;
        const secondRefresh = secondLogin.body.data.refreshToken;
        const sessionCountBeforeInvalidAttempt = await UserSessionModel.count({ where: { userId: customerId } });

        const invalidChange = await request('/api/v1/auth/password', 'PATCH', {
            currentPassword: 'WrongOnly#123', newPassword
        }, firstAccess);
        assert.equal(invalidChange.status, 401);
        assert.equal(await UserSessionModel.count({ where: { userId: customerId } }), sessionCountBeforeInvalidAttempt);
        assert.equal((await request('/api/v1/auth/me', 'GET', undefined, firstAccess)).status, 200);
        const unchangedUser = await UserModel.scope('withPassword').findByPk(customerId);
        assert.ok(unchangedUser && await unchangedUser.validatePassword(originalPassword));

        const changed = await request('/api/v1/auth/password', 'PATCH', {
            currentPassword: originalPassword, newPassword
        }, firstAccess);
        assert.equal(changed.status, 200);
        assert.equal(await UserSessionModel.count({ where: { userId: customerId } }), 0);
        assert.equal((await request('/api/v1/auth/me', 'GET', undefined, firstAccess)).status, 401);
        assert.equal((await request('/api/v1/auth/me', 'GET', undefined, secondAccess)).status, 401);
        assert.equal((await request('/api/v1/auth/refresh-token', 'POST', { refreshToken: firstRefresh })).status, 401);
        assert.equal((await request('/api/v1/auth/refresh-token', 'POST', { refreshToken: secondRefresh })).status, 401);
        assert.equal((await request('/api/v1/auth/login', 'POST', {
            phone: '01212345678', password: 'ResetOnly#456'
        })).status, 401);
        assert.equal((await request('/api/v1/auth/login', 'POST', {
            phone: '01212345678', password: newPassword
        })).status, 200);
    });
    await t.test('models preserve bilingual data, decimal prices and historical branch/price snapshots', async () => {
        const { BranchModel } = await import('../../src/modules/branches/v1/model/branch.model.js');
        const { SpecialtyModel } = await import('../../src/modules/specialties/v1/model/specialty.model.js');
        const { AppointmentModel } = await import('../../src/modules/appointments/v1/model/appointment.model.js');
        const name = { ar: 'اسم', en: 'Test Name' };
        const branch = await BranchModel.create({ name, address: name });
        const secondBranch = await BranchModel.create({ name, address: name });
        const specialty = await SpecialtyModel.create({ name });
        const { DoctorService } = await import('../../src/modules/doctors/v1/doctor.service.js');
        const doctor = await DoctorService.create({
            phone: '01512345678', accountName: 'Test Doctor', password: 'DoctorOnly#123',
            branchId: branch.id, specialtyId: specialty.id,
            name, appointmentPrice: '125.50', currency: 'EGP', appointmentDurationMinutes: 30,
        });
        const doctorUser = doctor.user as UserModel;
        const appointment = await AppointmentModel.create({ doctorId: doctor.id, customerId, branchId: branch.id,
            startsAt: new Date('2026-12-01T10:00:00Z'), endsAt: new Date('2026-12-01T10:30:00Z'),
            timezone: 'Africa/Cairo', durationMinutes: 30, bookedPrice: '125.50', currency: 'EGP' });
        await doctor.update({ branchId: secondBranch.id, appointmentPrice: '200.00' });
        await appointment.reload();
        assert.equal(appointment.bookedPrice, '125.50');
        assert.equal(appointment.branchId, branch.id);
        assert.deepEqual((await branch.reload()).name, name);
        await assert.rejects(() => branch.destroy());
        await assert.rejects(() => BranchModel.create({ name: { en: 'Incomplete' }, address: name }));
        const { DoctorModel } = await import('../../src/modules/doctors/v1/model/doctor.model.js');
        await assert.rejects(() => DoctorModel.create({ userId: doctorUser.id, branchId: branch.id, specialtyId: specialty.id,
            name, appointmentPrice: '-1.00', currency: 'EGP', appointmentDurationMinutes: 0 }));
    });
    await t.test('appointment lifecycle and history', async t => {
        const { exerciseAppointmentLifecycle } = await import('./appointment-lifecycle.js');
        await exerciseAppointmentLifecycle(t, request, sequelize);
    });
    await t.test('clinic rollback removes domain tables; doctor accounts block role rollback atomically', async () => {
        const overlapMigration = await import('../../src/database/migrations/005-appointment-overlap-protection.js');
        const historyMigration = await import('../../src/database/migrations/006-appointment-history.js');
        await historyMigration.down(qi, sequelize);
        await overlapMigration.down(qi, sequelize);
        await clinic.down(qi, sequelize);
        await assert.rejects(() => qi.describeTable('appointments'));
        await assert.rejects(() => roles.down(qi, sequelize), /doctor accounts/);
        assert.equal('fcmToken' in await qi.describeTable('user_sessions'), false);
        await UserModel.destroy({ where: { role: Roles.DOCTOR } });
        await UserSessionModel.destroy({ where: {} });
        const longSession = await UserSessionModel.create({ userId: customerId, refreshToken: 'x'.repeat(300) });
        await assert.rejects(() => roles.down(qi, sequelize));
        assert.equal('fcmToken' in await qi.describeTable('user_sessions'), false);
        await longSession.destroy();
        await roles.down(qi, sequelize);
        assert.equal('fcmToken' in await qi.describeTable('user_sessions'), true);
    });
    await t.test('existing user roles convert; incompatible legacy accounts stop without partial changes', async () => {
        await sequelize.query('INSERT INTO users (id, phone, name, role) VALUES (gen_random_uuid(), \'+201512345679\', \'Legacy Manager\', \'manager\')');
        await assert.rejects(() => roles.up(qi, sequelize), /Legacy account roles/);
        const [rows] = await sequelize.query('SELECT role FROM users WHERE phone = \'+201212345678\'');
        assert.equal((rows[0] as { role: string }).role, 'user');
        assert.equal('fcmToken' in await qi.describeTable('user_sessions'), true);
        await sequelize.query('DELETE FROM users WHERE phone = \'+201512345679\'');
        await roles.up(qi, sequelize);
        const [converted] = await sequelize.query('SELECT role FROM users WHERE phone = \'+201212345678\'');
        assert.equal((converted[0] as { role: string }).role, 'customer');
        await clinic.up(qi, sequelize);
    });
});
