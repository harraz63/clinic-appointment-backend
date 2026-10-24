import { Migration } from './types.js';
import * as initial from './001-initial-schema.js';
import * as roles from './002-clinic-roles.js';
import * as clinic from './003-clinic-foundation.js';
import * as userPhone from './004-user-phone.js';
import * as appointmentOverlap from './005-appointment-overlap-protection.js';
import * as appointmentHistory from './006-appointment-history.js';

export const migrations: Migration[] = [initial, roles, clinic, userPhone, appointmentOverlap, appointmentHistory].map(migration => ({
    name: migration.migrationName,
    up: migration.up,
    down: migration.down,
}));
