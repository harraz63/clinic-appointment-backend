import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertCompatibleHistory } from '../src/database/migrations/migration-history.js';
import { Migration } from '../src/database/migrations/types.js';

const registered: Migration[] = [{ name: '001-initial-schema', up: async () => {}, down: async () => {} }];

test('fresh and registered migration histories are accepted', () => {
    assert.doesNotThrow(() => assertCompatibleHistory(new Set(), registered));
    assert.doesNotThrow(() => assertCompatibleHistory(new Set(['001-initial-schema']), registered));
});

test('unrecognized migration histories require explicit reconciliation', () => {
    const executed = new Set(['001-initial-schema', '003-clinic-domain']);
    assert.throws(() => assertCompatibleHistory(executed, registered), /Unrecognized migration history: 003-clinic-domain/);
    assert.equal(executed.size, 2);
});
