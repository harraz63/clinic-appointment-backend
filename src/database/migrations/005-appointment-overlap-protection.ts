import { QueryInterface, Sequelize, QueryTypes } from 'sequelize';

export const migrationName = '005-appointment-overlap-protection';

export async function up(_queryInterface: QueryInterface, sequelize: Sequelize): Promise<void> {
    await sequelize.transaction(async transaction => {
        await sequelize.query('LOCK TABLE appointments IN ACCESS EXCLUSIVE MODE', { transaction });
        const conflicts = await sequelize.query<{ conflict: number }>(`
            SELECT 1 AS conflict FROM appointments a JOIN appointments b
            ON a.id < b.id AND (a."doctorId" = b."doctorId" OR a."customerId" = b."customerId")
            AND a."startsAt" < b."endsAt" AND b."startsAt" < a."endsAt"
            WHERE a.status <> 'cancelled' AND b.status <> 'cancelled' LIMIT 1
        `, { transaction, type: QueryTypes.SELECT });
        if (conflicts.length) {
            throw new Error('Appointment overlaps exist. Resolve doctor/customer conflicts explicitly before applying 005-appointment-overlap-protection; no appointments were changed.');
        }
        await sequelize.query('CREATE EXTENSION IF NOT EXISTS btree_gist', { transaction });
        for (const [name, field] of [['appointments_doctor_no_overlap', 'doctorId'], ['appointments_customer_no_overlap', 'customerId']]) {
            await sequelize.query(`ALTER TABLE appointments ADD CONSTRAINT ${name}
                EXCLUDE USING gist ("${field}" WITH =, tstzrange("startsAt", "endsAt", '[)') WITH &&)
                WHERE (status <> 'cancelled')`, { transaction });
        }
    });
}

export async function down(_queryInterface: QueryInterface, sequelize: Sequelize): Promise<void> {
    await sequelize.transaction(async transaction => {
        await sequelize.query('ALTER TABLE appointments DROP CONSTRAINT appointments_doctor_no_overlap, DROP CONSTRAINT appointments_customer_no_overlap', { transaction });
    });
}
