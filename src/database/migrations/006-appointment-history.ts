import { DataTypes, QueryInterface, Sequelize } from 'sequelize';

export const migrationName = '006-appointment-history';

export async function up(queryInterface: QueryInterface, sequelize: Sequelize): Promise<void> {
    await sequelize.transaction(async transaction => {
        await queryInterface.createTable('appointment_history', {
            id: { type: DataTypes.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true, allowNull: false },
            appointmentId: { type: DataTypes.UUID, allowNull: false, references: { model: 'appointments', key: 'id' }, onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
            actorId: { type: DataTypes.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
            actorRole: { type: DataTypes.STRING, allowNull: false },
            action: { type: DataTypes.STRING, allowNull: false },
            occurredAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
            before: { type: DataTypes.JSONB, allowNull: true },
            after: { type: DataTypes.JSONB, allowNull: false },
        }, { transaction });
        await queryInterface.addIndex('appointment_history', ['appointmentId', 'occurredAt', 'id'], { transaction });
        await queryInterface.addIndex('appointment_history', ['actorId'], { transaction });
        await sequelize.query(`ALTER TABLE appointment_history ADD CONSTRAINT appointment_history_valid CHECK (
            "actorRole" IN ('admin', 'doctor', 'customer') AND
            action IN ('booked', 'confirm', 'complete', 'no_show', 'cancel', 'reschedule') AND
            ((action = 'booked' AND "before" IS NULL) OR (action <> 'booked' AND jsonb_typeof("before") = 'object' AND "before" IS NOT NULL)) AND
            jsonb_typeof("after") = 'object'
        )`, { transaction });
    });
}

export async function down(queryInterface: QueryInterface, sequelize: Sequelize): Promise<void> {
    await sequelize.transaction(async transaction => {
        await queryInterface.dropTable('appointment_history', { transaction });
    });
}
