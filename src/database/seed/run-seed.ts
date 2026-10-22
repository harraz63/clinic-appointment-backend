import { initializeDatabase } from '../db-config.js';
import { initializeSuperAdmin } from './user/super-admin.js';


await initializeDatabase();

await initializeSuperAdmin();
console.log('Super Admin initialized successfully');

console.log('Database seed it successfully');

process.exit(0);