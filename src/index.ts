import express from 'express';
import http from 'http';
import { initializeDatabase } from './database/db-config.js';
import { initializeApp } from './app.js';
import { passportConfig } from './config/passport.config.js';
import { env } from './config/env.js';

const app = express();
const server = http.createServer(app);
const PORT = env.PORT;


await initializeDatabase();
passportConfig();
initializeApp(app);

server.listen(PORT, () => {
    console.log(`Server running with Socket.io on port ${PORT}`);
});