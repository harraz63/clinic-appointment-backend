interface DatabaseTarget { host: string; port: number | string; database: string }

// This module must stay independent of application imports and configuration initialization.
export function assertDisposableTestTargets(database: DatabaseTarget, redisUrl: string, expectedDatabase: URL, expectedRedis: string): void {
    if (expectedDatabase.hostname !== '127.0.0.1' || expectedDatabase.pathname !== '/clinic_tests' ||
        database.host !== expectedDatabase.hostname || Number(database.port) !== Number(expectedDatabase.port) ||
        database.database !== 'clinic_tests') {
        throw new Error('Integration database isolation mismatch; refusing all database operations');
    }
    if (new URL(expectedRedis).hostname !== '127.0.0.1' || redisUrl !== expectedRedis) {
        throw new Error('Integration Redis isolation mismatch; refusing all service operations');
    }
}
