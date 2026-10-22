import { Migration } from './types.js';
import * as initial from './001-initial-schema.js';
import * as roles from './002-clinic-roles.js';
import * as clinic from './003-clinic-foundation.js';

export const migrations: Migration[] = [initial, roles, clinic].map(migration => ({
    name: migration.migrationName,
    up: migration.up,
    down: migration.down,
}));
