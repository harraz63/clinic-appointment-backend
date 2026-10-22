import { DataTypes, QueryTypes } from 'sequelize';
import { sequelize } from '../db-config.js';
import { migrations } from './migrations.js';
import { assertCompatibleHistory } from './migration-history.js';

const command = process.argv[2] ?? 'up';

async function ensureMigrationsTable() {
    await sequelize.getQueryInterface().createTable('SequelizeMeta', {
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true,
        },
    });
}

async function getExecutedMigrations(): Promise<Set<string>> {
    const tableExistsResult = await sequelize.query<{ exists: string | null }>(
        'SELECT to_regclass(\'public."SequelizeMeta"\') AS exists;',
        { type: QueryTypes.SELECT }
    );
    const tableExists = Boolean(tableExistsResult[0]?.exists);

    if (!tableExists) {
        return new Set<string>();
    }

    const rows = await sequelize.query<{ name: string }>('SELECT name FROM "SequelizeMeta" ORDER BY name ASC;', {
        type: QueryTypes.SELECT,
    });

    return new Set(rows.map((row) => row.name));
}

async function runUpMigrations() {
    const executed = await getExecutedMigrations();
    assertCompatibleHistory(executed, migrations);
    await ensureMigrationsTable();

    for (const migration of migrations) {
        if (executed.has(migration.name)) continue;

        await migration.up(sequelize.getQueryInterface(), sequelize);
        await sequelize.query('INSERT INTO "SequelizeMeta" (name) VALUES (:name);', {
            replacements: { name: migration.name },
        });
        console.log(`Applied migration: ${migration.name}`);
    }
}

async function runDownMigration() {
    const executed = await getExecutedMigrations();
    assertCompatibleHistory(executed, migrations);
    const appliedMigrations = migrations.filter((migration) => executed.has(migration.name));
    const lastMigration = appliedMigrations[appliedMigrations.length - 1];

    if (!lastMigration) {
        console.log('No applied migrations to rollback.');
        return;
    }

    await lastMigration.down(sequelize.getQueryInterface(), sequelize);
    await sequelize.query('DELETE FROM "SequelizeMeta" WHERE name = :name;', {
        replacements: { name: lastMigration.name },
    });
    console.log(`Rolled back migration: ${lastMigration.name}`);
}

async function main() {
    try {
        if (!['up', 'down', 'status'].includes(command)) {
            throw new Error('Unknown migration command. Use up, down, or status.');
        }
        await sequelize.authenticate();

        if (command === 'status') {
            const executed = await getExecutedMigrations();
            for (const name of executed) console.log('Applied: ' + name);
            assertCompatibleHistory(executed, migrations);
            for (const migration of migrations) {
                if (!executed.has(migration.name)) console.log('Pending: ' + migration.name);
            }
        } else if (command === 'down') {
            await runDownMigration();
        } else {
            await runUpMigrations();
        }

    } catch (error) {
        console.error('Migration failed:', error);
        process.exitCode = 1;
    } finally {
        await sequelize.close();
    }
}

await main();
