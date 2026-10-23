import { QueryInterface, Sequelize } from 'sequelize';

export const migrationName = '004-user-phone';

export async function up(queryInterface: QueryInterface, sequelize: Sequelize): Promise<void> {
    await sequelize.transaction(async transaction => {
        await queryInterface.renameColumn('users', 'provider', 'phone', { transaction });
    });
}

export async function down(queryInterface: QueryInterface, sequelize: Sequelize): Promise<void> {
    await sequelize.transaction(async transaction => {
        await queryInterface.renameColumn('users', 'phone', 'provider', { transaction });
    });
}
