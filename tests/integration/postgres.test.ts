import '../setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { once } from 'node:events';
import express from 'express';

// Always creates its own loopback-only disposable database; never uses the local .env DB_URI.
test('isolated PostgreSQL migrations and HTTP smoke checks', { timeout: 120000 }, async t => {
    const container = 'clinic-foundation-test-' + randomUUID();
    const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    docker('run', '-d', '--rm', '--name', container, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust',
        '-e', 'POSTGRES_DB=clinic_tests', '-p', '127.0.0.1::5432', 'postgres:16-alpine');
    t.after(() => { docker('rm', '-f', '-v', container); });
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
        try { docker('exec', container, 'pg_isready', '-U', 'postgres', '-d', 'clinic_tests'); ready = true; break; }
        catch { await setTimeout(250); }
    }
    assert.ok(ready, 'disposable PostgreSQL must become ready');
    const binding = docker('port', container, '5432/tcp');
    process.env.DB_URI = 'postgres://postgres@' + binding + '/clinic_tests';
    const { sequelize } = await import('../../src/database/db-config.js');
    t.after(async () => { await sequelize.close(); });
    const qi = sequelize.getQueryInterface();
    const roles = await import('../../src/database/migrations/002-clinic-roles.js');
    const clinic = await import('../../src/database/migrations/003-clinic-foundation.js');
    const { UserModel } = await import('../../src/modules/user/v1/model/user.model.js');
    const { UserSessionModel } = await import('../../src/modules/user-session/v1/model/user-session.entity.js');
    const { UserService } = await import('../../src/modules/user/v1/user.service.js');
    const { Roles } = await import('../../src/constants/roles.js');

    await t.test('registered migrations install a fresh schema and skip previously applied entries', async () => {
        const status = execFileSync(process.execPath,
            ['--import', 'tsx', 'src/database/migrations/run-migrations.ts', 'status'], { env: process.env, encoding: 'utf8' });
        assert.match(status, /Pending: 003-clinic-foundation/);
        assert.deepEqual(await qi.showAllTables(), []);
        for (let i = 0; i < 2; i++) execFileSync(process.execPath,
            ['--import', 'tsx', 'src/database/migrations/run-migrations.ts', 'up'], { env: process.env, stdio: 'pipe' });
        const [rows] = await sequelize.query('SELECT name FROM "SequelizeMeta" ORDER BY name');
        assert.equal(rows.length, 3);
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
            assert.equal(rows.length, 4);
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
    t.after(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const base = 'http://127.0.0.1:' + address.port;
    const request = async (url: string, method = 'GET', body?: unknown, token?: string) => {
        const response = await fetch(base + url, { method, headers: {
            'Content-Type': 'application/json', 'Accept-Language': 'en', ...(token ? { Authorization: 'Bearer ' + token } : {}),
        }, body: body === undefined ? undefined : JSON.stringify(body) });
        return { status: response.status, body: await response.json() };
    };
    let accessToken: string;
    let refreshToken: string;
    let customerId: string;
    let adminId: string;
    await t.test('metadata, health, registration, login and protected profile work without Google configuration', async () => {
        assert.equal((await request('/')).status, 200);
        assert.equal((await request('/health')).body.dependencies.database, 'up');
        const registration = { provider: 'patient@example.com', name: 'Test Patient', password: 'TestOnly#123' };
        const invalid = await request('/api/v1/auth/register', 'POST', { ...registration, role: 'doctor' });
        assert.equal(invalid.status, 422);
        const registered = await request('/api/v1/auth/register', 'POST', registration);
        assert.equal(registered.status, 201);
        assert.equal(registered.body.data.user.role, 'customer');
        assert.equal('password' in registered.body.data.user, false);
        customerId = registered.body.data.user.id;
        const login = await request('/api/v1/auth/login', 'POST', { provider: registration.provider, password: registration.password });
        assert.equal(login.status, 200);
        assert.equal('password' in login.body.data.user, false);
        accessToken = login.body.data.accessToken.token;
        refreshToken = login.body.data.refreshToken;
        assert.equal((await request('/api/v1/auth/me', 'GET', undefined, accessToken)).status, 200);
        assert.equal((await request('/api/v1/users/filter', 'GET', undefined, accessToken)).status, 403);
        assert.equal((await request('/api/v1/auth/me', 'PATCH', { isBlocked: true }, accessToken)).status, 422);
        const admin = await UserService.createUser({ provider: 'admin@example.com', name: 'Test Admin', password: 'TestOnly#123', role: Roles.ADMIN });
        adminId = admin.id;
        const adminLogin = await request('/api/v1/auth/login', 'POST', { provider: admin.provider, password: 'TestOnly#123' });
        assert.equal(adminLogin.status, 200);
        const filtered = await request('/api/v1/users/filter?name=patient&role=customer', 'GET', undefined, adminLogin.body.data.accessToken.token);
        assert.equal(filtered.status, 200);
        assert.equal(filtered.body.data.page, 1);
        assert.equal(filtered.body.data.limit, 10);
        assert.equal(filtered.body.data.users[0].id, customerId);
        assert.equal((await request('/api/v1/auth/google')).status, 401);
        assert.equal((await request('/api/v1/user-session/fcm-token', 'PATCH', { fcmToken: 'unused' })).status, 404);
    });
    await t.test('blocked users, deleted sessions and invalid refresh tokens fail cleanly', async () => {
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
        const rotated = await request('/api/v1/auth/refresh-token', 'POST', { refreshToken });
        assert.equal(rotated.status, 200);
        assert.equal((await request('/api/v1/auth/refresh-token', 'POST', { refreshToken })).status, 401);
        await UserSessionModel.destroy({ where: { userId: customerId } });
        assert.equal((await request('/api/v1/auth/me', 'GET', undefined, accessToken)).status, 401);
    });
    await t.test('models preserve bilingual data, decimal prices and historical branch/price snapshots', async () => {
        const { BranchModel } = await import('../../src/modules/branches/v1/model/branch.model.js');
        const { SpecialtyModel } = await import('../../src/modules/specialties/v1/model/specialty.model.js');
        const { DoctorModel } = await import('../../src/modules/doctors/v1/model/doctor.model.js');
        const { AppointmentModel } = await import('../../src/modules/appointments/v1/model/appointment.model.js');
        const name = { ar: 'اسم', en: 'Test Name' };
        const branch = await BranchModel.create({ name, address: name });
        const secondBranch = await BranchModel.create({ name, address: name });
        const specialty = await SpecialtyModel.create({ name });
        const doctorUser = await UserService.createUser({ provider: 'doctor@example.com', name: 'Test Doctor', role: Roles.DOCTOR });
        const doctor = await DoctorModel.create({ userId: doctorUser.id, branchId: branch.id, specialtyId: specialty.id,
            name, appointmentPrice: '125.50', currency: 'EGP', appointmentDurationMinutes: 30 });
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
        await assert.rejects(() => DoctorModel.create({ userId: doctorUser.id, branchId: branch.id, specialtyId: specialty.id,
            name, appointmentPrice: '-1.00', currency: 'EGP', appointmentDurationMinutes: 0 }));
    });
    await t.test('clinic rollback removes domain tables; doctor accounts block role rollback atomically', async () => {
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
        await sequelize.query('INSERT INTO users (id, provider, name, role) VALUES (gen_random_uuid(), \'legacy@example.com\', \'Legacy Manager\', \'manager\')');
        await assert.rejects(() => roles.up(qi, sequelize), /Legacy account roles/);
        const [rows] = await sequelize.query('SELECT role FROM users WHERE provider = \'patient@example.com\'');
        assert.equal((rows[0] as { role: string }).role, 'user');
        assert.equal('fcmToken' in await qi.describeTable('user_sessions'), true);
        await sequelize.query('DELETE FROM users WHERE provider = \'legacy@example.com\'');
        await roles.up(qi, sequelize);
        const [converted] = await sequelize.query('SELECT role FROM users WHERE provider = \'patient@example.com\'');
        assert.equal((converted[0] as { role: string }).role, 'customer');
        await clinic.up(qi, sequelize);
    });
});
