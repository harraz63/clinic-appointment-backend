import { DataTypes, QueryInterface, Sequelize } from 'sequelize';

export const migrationName = '003-clinic-foundation';

export async function up(queryInterface: QueryInterface, sequelize: Sequelize): Promise<void> {
    await sequelize.transaction(async transaction => {
        await queryInterface.createTable('branches', {
            id: { type: DataTypes.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true, allowNull: false },
            name: { type: DataTypes.JSONB, allowNull: false },
            description: { type: DataTypes.JSONB, allowNull: true },
            address: { type: DataTypes.JSONB, allowNull: false },
            phone: { type: DataTypes.STRING(255), allowNull: true },
            email: { type: DataTypes.STRING(255), allowNull: true },
            timezone: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Africa/Cairo' },
            isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
            createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
            updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        }, { transaction });
        await sequelize.query('ALTER TABLE "branches" ADD CONSTRAINT "branches_valid" CHECK (timezone <> \'\');', { transaction });
        await sequelize.query('ALTER TABLE "branches" ADD CONSTRAINT "branches_name_bilingual" CHECK ("name" IS NULL OR (jsonb_typeof("name") = \'object\' AND "name" ?& ARRAY[\'ar\', \'en\'] AND jsonb_typeof("name"->\'ar\') = \'string\' AND jsonb_typeof("name"->\'en\') = \'string\' AND "name"->>\'ar\' ~ \'[^[:space:]]\' AND "name"->>\'en\' ~ \'[^[:space:]]\'));', { transaction });
        await sequelize.query('ALTER TABLE "branches" ADD CONSTRAINT "branches_description_bilingual" CHECK ("description" IS NULL OR (jsonb_typeof("description") = \'object\' AND "description" ?& ARRAY[\'ar\', \'en\'] AND jsonb_typeof("description"->\'ar\') = \'string\' AND jsonb_typeof("description"->\'en\') = \'string\' AND "description"->>\'ar\' ~ \'[^[:space:]]\' AND "description"->>\'en\' ~ \'[^[:space:]]\'));', { transaction });
        await sequelize.query('ALTER TABLE "branches" ADD CONSTRAINT "branches_address_bilingual" CHECK ("address" IS NULL OR (jsonb_typeof("address") = \'object\' AND "address" ?& ARRAY[\'ar\', \'en\'] AND jsonb_typeof("address"->\'ar\') = \'string\' AND jsonb_typeof("address"->\'en\') = \'string\' AND "address"->>\'ar\' ~ \'[^[:space:]]\' AND "address"->>\'en\' ~ \'[^[:space:]]\'));', { transaction });
        await queryInterface.createTable('specialties', {
            id: { type: DataTypes.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true, allowNull: false },
            name: { type: DataTypes.JSONB, allowNull: false },
            description: { type: DataTypes.JSONB, allowNull: true },
            isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
            createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
            updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        }, { transaction });
        await sequelize.query('ALTER TABLE "specialties" ADD CONSTRAINT "specialties_name_bilingual" CHECK ("name" IS NULL OR (jsonb_typeof("name") = \'object\' AND "name" ?& ARRAY[\'ar\', \'en\'] AND jsonb_typeof("name"->\'ar\') = \'string\' AND jsonb_typeof("name"->\'en\') = \'string\' AND "name"->>\'ar\' ~ \'[^[:space:]]\' AND "name"->>\'en\' ~ \'[^[:space:]]\'));', { transaction });
        await sequelize.query('ALTER TABLE "specialties" ADD CONSTRAINT "specialties_description_bilingual" CHECK ("description" IS NULL OR (jsonb_typeof("description") = \'object\' AND "description" ?& ARRAY[\'ar\', \'en\'] AND jsonb_typeof("description"->\'ar\') = \'string\' AND jsonb_typeof("description"->\'en\') = \'string\' AND "description"->>\'ar\' ~ \'[^[:space:]]\' AND "description"->>\'en\' ~ \'[^[:space:]]\'));', { transaction });
        await queryInterface.createTable('doctors', {
            id: { type: DataTypes.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true, allowNull: false },
            userId: { type: DataTypes.UUID, allowNull: false, unique: true, references: { model: 'users', key: 'id' }, onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
            branchId: { type: DataTypes.UUID, allowNull: false, references: { model: 'branches', key: 'id' }, onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
            specialtyId: { type: DataTypes.UUID, allowNull: false, references: { model: 'specialties', key: 'id' }, onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
            name: { type: DataTypes.JSONB, allowNull: false },
            biography: { type: DataTypes.JSONB, allowNull: true },
            appointmentPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
            currency: { type: DataTypes.STRING(3), allowNull: false },
            appointmentDurationMinutes: { type: DataTypes.INTEGER, allowNull: false },
            isAvailable: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
            isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
            createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
            updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        }, { transaction });
        await queryInterface.addIndex('doctors', ['branchId'], { transaction });
        await queryInterface.addIndex('doctors', ['specialtyId'], { transaction });
        await sequelize.query('ALTER TABLE "doctors" ADD CONSTRAINT "doctors_valid" CHECK ("appointmentPrice" >= 0 AND "appointmentDurationMinutes" > 0 AND currency ~ \'^[A-Z]{3}$\');', { transaction });
        await sequelize.query('ALTER TABLE "doctors" ADD CONSTRAINT "doctors_name_bilingual" CHECK ("name" IS NULL OR (jsonb_typeof("name") = \'object\' AND "name" ?& ARRAY[\'ar\', \'en\'] AND jsonb_typeof("name"->\'ar\') = \'string\' AND jsonb_typeof("name"->\'en\') = \'string\' AND "name"->>\'ar\' ~ \'[^[:space:]]\' AND "name"->>\'en\' ~ \'[^[:space:]]\'));', { transaction });
        await sequelize.query('ALTER TABLE "doctors" ADD CONSTRAINT "doctors_biography_bilingual" CHECK ("biography" IS NULL OR (jsonb_typeof("biography") = \'object\' AND "biography" ?& ARRAY[\'ar\', \'en\'] AND jsonb_typeof("biography"->\'ar\') = \'string\' AND jsonb_typeof("biography"->\'en\') = \'string\' AND "biography"->>\'ar\' ~ \'[^[:space:]]\' AND "biography"->>\'en\' ~ \'[^[:space:]]\'));', { transaction });
        await queryInterface.createTable('doctor_schedules', {
            id: { type: DataTypes.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true, allowNull: false },
            doctorId: { type: DataTypes.UUID, allowNull: false, references: { model: 'doctors', key: 'id' }, onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
            weekday: { type: DataTypes.INTEGER, allowNull: false },
            startTime: { type: DataTypes.TIME, allowNull: false },
            endTime: { type: DataTypes.TIME, allowNull: false },
            createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
            updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        }, { transaction });
        await queryInterface.addIndex('doctor_schedules', ['doctorId','weekday'], { transaction });
        await sequelize.query('ALTER TABLE "doctor_schedules" ADD CONSTRAINT "doctor_schedules_valid" CHECK (weekday BETWEEN 0 AND 6 AND "startTime" < "endTime");', { transaction });
        await queryInterface.createTable('schedule_exceptions', {
            id: { type: DataTypes.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true, allowNull: false },
            doctorId: { type: DataTypes.UUID, allowNull: false, references: { model: 'doctors', key: 'id' }, onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
            date: { type: DataTypes.DATEONLY, allowNull: false },
            isDayOff: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
            startTime: { type: DataTypes.TIME, allowNull: true },
            endTime: { type: DataTypes.TIME, allowNull: true },
            reason: { type: DataTypes.JSONB, allowNull: true },
            createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
            updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        }, { transaction });
        await queryInterface.addIndex('schedule_exceptions', ['doctorId','date'], { transaction });
        await sequelize.query('ALTER TABLE "schedule_exceptions" ADD CONSTRAINT "schedule_exceptions_valid" CHECK (("isDayOff" AND "startTime" IS NULL AND "endTime" IS NULL) OR (NOT "isDayOff" AND "startTime" IS NOT NULL AND "endTime" IS NOT NULL AND "startTime" < "endTime"));', { transaction });
        await sequelize.query('ALTER TABLE "schedule_exceptions" ADD CONSTRAINT "schedule_exceptions_reason_bilingual" CHECK ("reason" IS NULL OR (jsonb_typeof("reason") = \'object\' AND "reason" ?& ARRAY[\'ar\', \'en\'] AND jsonb_typeof("reason"->\'ar\') = \'string\' AND jsonb_typeof("reason"->\'en\') = \'string\' AND "reason"->>\'ar\' ~ \'[^[:space:]]\' AND "reason"->>\'en\' ~ \'[^[:space:]]\'));', { transaction });
        await queryInterface.createTable('appointments', {
            id: { type: DataTypes.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true, allowNull: false },
            customerId: { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
            doctorId: { type: DataTypes.UUID, allowNull: false, references: { model: 'doctors', key: 'id' }, onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
            branchId: { type: DataTypes.UUID, allowNull: false, references: { model: 'branches', key: 'id' }, onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
            startsAt: { type: DataTypes.DATE, allowNull: false },
            endsAt: { type: DataTypes.DATE, allowNull: false },
            timezone: { type: DataTypes.STRING(255), allowNull: false },
            durationMinutes: { type: DataTypes.INTEGER, allowNull: false },
            bookedPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
            currency: { type: DataTypes.STRING(3), allowNull: false },
            status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'pending' },
            createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
            updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        }, { transaction });
        await queryInterface.addIndex('appointments', ['doctorId','startsAt'], { transaction });
        await queryInterface.addIndex('appointments', ['customerId','startsAt'], { transaction });
        await queryInterface.addIndex('appointments', ['branchId','startsAt'], { transaction });
        await queryInterface.addIndex('appointments', ['status'], { transaction });
        await sequelize.query('ALTER TABLE "appointments" ADD CONSTRAINT "appointments_valid" CHECK ("endsAt" > "startsAt" AND "durationMinutes" > 0 AND "bookedPrice" >= 0 AND currency ~ \'^[A-Z]{3}$\' AND status IN (\'pending\', \'confirmed\', \'completed\', \'cancelled\', \'no_show\'));', { transaction });
        await queryInterface.createTable('payment_methods', {
            id: { type: DataTypes.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true, allowNull: false },
            code: { type: DataTypes.STRING, allowNull: false, unique: true },
            name: { type: DataTypes.JSONB, allowNull: false },
            instructions: { type: DataTypes.JSONB, allowNull: true },
            isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
            createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
            updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        }, { transaction });
        await sequelize.query('ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_name_bilingual" CHECK ("name" IS NULL OR (jsonb_typeof("name") = \'object\' AND "name" ?& ARRAY[\'ar\', \'en\'] AND jsonb_typeof("name"->\'ar\') = \'string\' AND jsonb_typeof("name"->\'en\') = \'string\' AND "name"->>\'ar\' ~ \'[^[:space:]]\' AND "name"->>\'en\' ~ \'[^[:space:]]\'));', { transaction });
        await sequelize.query('ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_instructions_bilingual" CHECK ("instructions" IS NULL OR (jsonb_typeof("instructions") = \'object\' AND "instructions" ?& ARRAY[\'ar\', \'en\'] AND jsonb_typeof("instructions"->\'ar\') = \'string\' AND jsonb_typeof("instructions"->\'en\') = \'string\' AND "instructions"->>\'ar\' ~ \'[^[:space:]]\' AND "instructions"->>\'en\' ~ \'[^[:space:]]\'));', { transaction });
        await queryInterface.createTable('payment_records', {
            id: { type: DataTypes.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true, allowNull: false },
            appointmentId: { type: DataTypes.UUID, allowNull: false, references: { model: 'appointments', key: 'id' }, onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
            paymentMethodId: { type: DataTypes.UUID, allowNull: false, references: { model: 'payment_methods', key: 'id' }, onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
            amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
            currency: { type: DataTypes.STRING(3), allowNull: false },
            status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'unpaid' },
            receivedAt: { type: DataTypes.DATE, allowNull: true },
            receivedBy: { type: DataTypes.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
            createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
            updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        }, { transaction });
        await queryInterface.addIndex('payment_records', ['appointmentId'], { transaction });
        await queryInterface.addIndex('payment_records', ['status'], { transaction });
        await sequelize.query('ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_valid" CHECK (amount >= 0 AND currency ~ \'^[A-Z]{3}$\' AND status IN (\'unpaid\', \'paid\', \'refunded\'));', { transaction });
        await queryInterface.createTable('notifications', {
            id: { type: DataTypes.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true, allowNull: false },
            recipientId: { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
            type: { type: DataTypes.STRING(255), allowNull: false },
            title: { type: DataTypes.JSONB, allowNull: false },
            body: { type: DataTypes.JSONB, allowNull: false },
            readAt: { type: DataTypes.DATE, allowNull: true },
            relatedResourceType: { type: DataTypes.STRING(255), allowNull: true },
            relatedResourceId: { type: DataTypes.UUID, allowNull: true },
            createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
            updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
        }, { transaction });
        await queryInterface.addIndex('notifications', ['recipientId','readAt','createdAt'], { transaction });
        await sequelize.query('ALTER TABLE "notifications" ADD CONSTRAINT "notifications_valid" CHECK (("relatedResourceType" IS NULL) = ("relatedResourceId" IS NULL));', { transaction });
        await sequelize.query('ALTER TABLE "notifications" ADD CONSTRAINT "notifications_title_bilingual" CHECK ("title" IS NULL OR (jsonb_typeof("title") = \'object\' AND "title" ?& ARRAY[\'ar\', \'en\'] AND jsonb_typeof("title"->\'ar\') = \'string\' AND jsonb_typeof("title"->\'en\') = \'string\' AND "title"->>\'ar\' ~ \'[^[:space:]]\' AND "title"->>\'en\' ~ \'[^[:space:]]\'));', { transaction });
        await sequelize.query('ALTER TABLE "notifications" ADD CONSTRAINT "notifications_body_bilingual" CHECK ("body" IS NULL OR (jsonb_typeof("body") = \'object\' AND "body" ?& ARRAY[\'ar\', \'en\'] AND jsonb_typeof("body"->\'ar\') = \'string\' AND jsonb_typeof("body"->\'en\') = \'string\' AND "body"->>\'ar\' ~ \'[^[:space:]]\' AND "body"->>\'en\' ~ \'[^[:space:]]\'));', { transaction });
        await queryInterface.bulkInsert('payment_methods', [{
            id: '00000000-0000-4000-8000-000000000001', code: 'cash',
            name: JSON.stringify({ ar: 'نقداً في العيادة', en: 'Cash at Clinic' }),
            isActive: true, createdAt: new Date(), updatedAt: new Date(),
        }], { transaction });
    });
}

export async function down(queryInterface: QueryInterface, sequelize: Sequelize): Promise<void> {
    await sequelize.transaction(async transaction => {
        await queryInterface.dropTable('notifications', { transaction });
        await queryInterface.dropTable('payment_records', { transaction });
        await queryInterface.dropTable('payment_methods', { transaction });
        await queryInterface.dropTable('appointments', { transaction });
        await queryInterface.dropTable('schedule_exceptions', { transaction });
        await queryInterface.dropTable('doctor_schedules', { transaction });
        await queryInterface.dropTable('doctors', { transaction });
        await queryInterface.dropTable('specialties', { transaction });
        await queryInterface.dropTable('branches', { transaction });
    });
}
