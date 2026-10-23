import 'express-async-errors';
import express from 'express';
import qs from 'qs';
import passport from 'passport';
import i18n from './i18n/i18n-config.js';
import { corsConfig } from './config/cors.js';
import { rateLimiter } from './config/rate-limiter.js';
import helmet from 'helmet';

import { homeRouter } from './modules/home/v1/home.routes.js';
import { healthRouter } from './modules/health/v1/health.routes.js';
import { constantRouter } from './modules/constant/constant.routes.js';
import { userRouterV1 } from './modules/user/v1/user.routes.js';
import { authRouterV1 } from './modules/auth/v1/auth.routes.js';
import { mediaRouterV1 } from './modules/media/v1/media.routes.js';
import { adminBranchRouterV1, publicBranchRouterV1 } from './modules/branches/v1/branch.routes.js';
import { adminSpecialtyRouterV1, publicSpecialtyRouterV1 } from './modules/specialties/v1/specialty.routes.js';
import { docsRouter } from './modules/docs/docs.routes.js';

import { errorMiddleware } from './middleware/error.middleware.js';
import { notFoundMiddleware } from './middleware/not-found.middleware.js';

export function initializeApp(app: express.Application) {
    app.use(i18n.init);
    app.set('trust proxy', 1);
    app.set('query parser', (str: string) => qs.parse(str));
    app.use(rateLimiter);
    app.use(corsConfig);
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(passport.initialize());
    app.use(helmet());

    // app.use(sanitize()); // TODO: FIX IT____IT THROW ERROR WHEN IT SANITIZE REQUEST

    app.use(express.static('public'));

    app.use('/', homeRouter);
    app.use('/health', healthRouter);
    app.use('/api/docs', docsRouter);
    app.use('/api/constant', constantRouter);
    app.use('/api/v1/users', userRouterV1);
    app.use('/api/v1/auth', authRouterV1);
    app.use('/api/v1/media', mediaRouterV1);
    app.use('/api/v1/branches', publicBranchRouterV1);
    app.use('/api/v1/specialties', publicSpecialtyRouterV1);
    app.use('/api/v1/admin/branches', adminBranchRouterV1);
    app.use('/api/v1/admin/specialties', adminSpecialtyRouterV1);

    app.use(notFoundMiddleware);
    app.use(errorMiddleware);
}
