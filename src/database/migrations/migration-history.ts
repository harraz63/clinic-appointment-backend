import { Migration } from './types.js';

export function assertCompatibleHistory(executed: ReadonlySet<string>, registered: readonly Migration[]): void {
    const known = new Set(registered.map(migration => migration.name));
    const unknown = [...executed].filter(name => !known.has(name)).sort();
    if (unknown.length) {
        throw new Error(
            'Unrecognized migration history: ' + unknown.join(', ') + '. ' +
            'This database belongs to a different schema version. Use a new empty database or prepare an explicit compatibility migration. ' +
            'Do not delete migration history or rerun seeds to repair the schema.'
        );
    }
}
