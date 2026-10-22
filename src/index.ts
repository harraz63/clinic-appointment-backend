import express from 'express';
import http from 'http';
import { initializeDatabase } from './database/db-config.js';
import { initializeApp } from './app.js';
import { passportConfig } from './config/passport.config.js';
import { env } from './config/env.js';
import { initializeAssociations } from './database/associations.js';
import { infoLogger } from './config/logger.config.js';

const app = express();
const server = http.createServer(app);
const PORT = env.PORT;


initializeAssociations();
await initializeDatabase();
await passportConfig();
initializeApp(app);

server.listen(PORT, () => {
    infoLogger.info(`Server running on port ${PORT}. Swagger docs: http://localhost:${PORT}/api/docs`);
});
