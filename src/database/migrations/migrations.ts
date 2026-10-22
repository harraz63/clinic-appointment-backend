import { Migration } from './types.js';
import { migrationName as migration001Name, up as migration001Up, down as migration001Down } from './001-initial-schema.js';

export const migrations: Migration[] = [
    {
        name: migration001Name,
        up: migration001Up,
        down: migration001Down,
    },
];
