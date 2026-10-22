import { DataTypes, QueryInterface, QueryTypes, Sequelize, Transaction } from 'sequelize';

export const migrationName = '002-clinic-roles';

async function replaceRoles(sequelize: Sequelize, transaction: Transaction, rollback: boolean): Promise<void> {
    await sequelize.query('LOCK TABLE users IN ACCESS EXCLUSIVE MODE', { transaction });
    const [result] = await sequelize.query<{ count: string }>(
        rollback
            ? 'SELECT COUNT(*) AS count FROM users WHERE role::text NOT IN (\'admin\', \'customer\')'
            : 'SELECT COUNT(*) AS count FROM users WHERE role::text NOT IN (\'admin\', \'user\', \'customer\', \'doctor\')',
        { type: QueryTypes.SELECT, transaction }
    );
    if (Number(result.count)) throw new Error(rollback
        ? 'Role rollback requires manual resolution of doctor accounts'
        : 'Legacy account roles require manual resolution before clinic migration');
    const values = rollback
        ? '\'admin\', \'manager\', \'customer_service\', \'delivery\', \'shop\', \'supplier\', \'user\''
        : '\'admin\', \'doctor\', \'customer\'';
    await sequelize.query('CREATE TYPE enum_users_role_next AS ENUM (' + values + ')', { transaction });
    await sequelize.query('ALTER TABLE users ALTER COLUMN role DROP DEFAULT', { transaction });
    const source = rollback ? 'customer' : 'user';
    const target = rollback ? 'user' : 'customer';
    await sequelize.query(
        'ALTER TABLE users ALTER COLUMN role TYPE enum_users_role_next USING (CASE WHEN role::text = :source THEN :target ELSE role::text END)::enum_users_role_next',
        { replacements: { source, target }, transaction }
    );
    await sequelize.query('DROP TYPE enum_users_role', { transaction });
    await sequelize.query('ALTER TYPE enum_users_role_next RENAME TO enum_users_role', { transaction });
    await sequelize.query('ALTER TABLE users ALTER COLUMN role SET DEFAULT :target::enum_users_role', { replacements: { target }, transaction });
}

export async function up(queryInterface: QueryInterface, sequelize: Sequelize): Promise<void> {
    await sequelize.transaction(async transaction => {
        await replaceRoles(sequelize, transaction, false);
        await sequelize.query('ALTER TABLE user_sessions ALTER COLUMN "refreshToken" TYPE TEXT', { transaction });
        await queryInterface.removeColumn('user_sessions', 'fcmToken', { transaction });
    });
}

export async function down(queryInterface: QueryInterface, sequelize: Sequelize): Promise<void> {
    await sequelize.transaction(async transaction => {
        await replaceRoles(sequelize, transaction, true);
        // PostgreSQL refuses narrowing if existing tokens exceed 255 characters.
        await sequelize.query('ALTER TABLE user_sessions ALTER COLUMN "refreshToken" TYPE VARCHAR(255)', { transaction });
        await queryInterface.addColumn('user_sessions', 'fcmToken', { type: DataTypes.STRING, allowNull: true }, { transaction });
    });
}
