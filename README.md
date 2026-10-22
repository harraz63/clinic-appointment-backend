# Clinic Appointment Backend

Express and TypeScript backend foundation for a clinic appointment project. The repository provides authentication, users, sessions, and public media APIs, plus clinic domain models, migrations, validation patterns, ownership helpers, and typed module contracts. Clinic business endpoints, scheduling, payments, inbox delivery, dashboards, and medical records are not implemented.

The npm package is `clinic-appointment-backend` version `1.0.0`. See [CLINIC_FOUNDATION.md](./CLINIC_FOUNDATION.md) for relationships, future APIs, RBAC, bilingual data, and the implementation roadmap.

## Implemented capabilities

| Area | Current implementation |
| --- | --- |
| Authentication | Phone/email provider and password registration/login, JWT access tokens, persisted refresh-token sessions, refresh/logout |
| Users | Administrator CRUD/filter routes and authenticated self-profile read/update/delete routes |
| Sessions | Persisted refresh tokens, session ownership/expiration and blocked-account checks |
| Clinic foundation | Branches, specialties, doctors, schedules/exceptions, appointments, payments, inbox models, and dashboard contracts; no business endpoints |
| Media | Public multipart upload, file retrieval, and metadata using local, S3, or R2 storage |
| Platform | Application metadata, public roles, PostgreSQL health, Joi request validation, Arabic/English messages, Winston logging, Helmet, CORS, and rate limiting |
| Database | Ordered Sequelize migrations and an administrator seed |

Redis is provisioned in Docker Compose but is unused by the API. Firebase, SMTP, FCM, and Google authentication have been removed. Swagger UI and an OpenAPI document describe the implemented HTTP API. Node/tsx tests cover the foundation; Docker integration tests use an isolated PostgreSQL container. See [known limitations](#known-limitations).

## Technology and repository structure

The application uses Express 4, TypeScript 5, native ES modules, Sequelize 6, PostgreSQL, Passport/JWT, Joi, Zod, bcrypt, i18n, Multer, and storage SDKs. Docker uses Node.js 20 Alpine, PostgreSQL 16 Alpine, and Redis 7 Alpine. Node 20 matches the repository's Docker target; `package.json` has no `engines` declaration.

```text
src/
    app.ts                  Middleware and route mounting
    index.ts                Database authentication and HTTP startup
    config/                 Environment, Passport, CORS, logging
    constants/              Clinic roles, appointment/payment statuses, media types
    database/               Sequelize connection, associations, migrations, seed
    i18n/local/             Arabic and English translations
    middleware/             Auth, validation, upload, error handling
    modules/                Existing HTTP modules and versioned clinic foundation modules
    shared/                 Bilingual validation and future API types
    storage/                Storage interface, factory, local and S3 implementations
    utils/                  Password/token utilities and HTTP errors
docker/                     Development and production startup scripts
```

Most HTTP modules use `src/modules/<domain>/v1`; constants are unversioned. Relative TypeScript imports use `.js` extensions. TypeScript uses NodeNext resolution and `strict: false`.

## Local setup

Use Node.js/npm and a reachable PostgreSQL database. Docker is optional for host execution. Run commands from the repository root. The examples below use PowerShell.

1. Install locked dependencies:

   ```powershell
   npm ci
   ```

2. Create `.env` only if it does not already exist:

   ```powershell
   if (-not (Test-Path .env)) { Copy-Item .env.example .env }
   ```

   Set `APP_NAME=Clinic Appointment Backend`, choose non-placeholder JWT and administrator secrets, and configure the required values in the environment table below. The example's database URL uses the Compose hostname `postgres`; a host process needs a reachable host such as `localhost`.

3. If using Docker for local infrastructure, start only the database and Redis:

   ```powershell
   docker compose up -d postgres redis
   ```

   With the example local database credentials, set the host-side `.env` database URL to `postgres://postgres:postgres@localhost:5432/app_db`. These are disposable local example credentials, not deployment credentials. Redis publishes port 6379 but is unused by the API.

4. Apply migrations and seed the intended local database:

   ```powershell
   npm run migrate
   npm run seed
   npm run start:dev
   ```

   Seeding overwrites the password of an existing account matching `SUPER_ADMIN_PROVIDER`. Check the database target before running it. `start:dev` alone neither migrates nor seeds.

The default listener is `http://localhost:3000`; startup logs include the Swagger UI URL. Open the API docs at `http://localhost:3000/api/docs` or fetch the OpenAPI JSON from `http://localhost:3000/api/docs/openapi.json`. Check metadata at `/` and database health at `/health`. A healthy response confirms PostgreSQL connectivity, not the correctness of authentication or media integrations.

Source development uses `tsx`. Build with `npm run build`, then use `npm start` for the compiled API. Neither startup command applies migrations or seeds.

## Docker setup

For the full development stack, use a Compose-compatible `.env`: `DB_URI` must address `postgres:5432`, not host `localhost`. Preserve `PORT=3000` for the existing container port mapping and health check.

```powershell
docker compose config --quiet
docker compose up --build -d
docker compose logs -f app
```

Development bind-mounts the repository into `/app` and uses an anonymous `/app/node_modules` volume. Its startup script runs `migrate`, `seed`, and `start:dev`. PostgreSQL and Redis use named data volumes.

The production configuration builds the `prod` target, installs production dependencies, and starts the compiled application:

```powershell
docker compose -f docker-compose.prod.yml config --quiet
docker compose -f docker-compose.prod.yml up --build -d
```

Compose syntax is verified; a full production image deployment has not been performed. Production startup runs `migrate:prod`, `seed:prod`, then `npm start`, so every app restart can reset the configured administrator password. There is no separate migration service or deployment pipeline.

Both Compose files wait for PostgreSQL and Redis health, but `/health` checks PostgreSQL only. PostgreSQL and Redis have named data volumes. **Production local uploads have no persistent volume** and can disappear when the app container is replaced. S3/R2 persistence is external to Compose. Preserve database volumes when stopping or replacing a stack containing data you need.

The app reads `PORT`, while Compose maps to internal port 3000 and probes that port. A different `PORT` requires corresponding container configuration changes; changing `.env` alone does not keep those settings aligned.

## Environment configuration

The API loads `.env` through dotenv and validates settings in [src/config/env.ts](./src/config/env.ts). Missing or invalid required fields stop startup. Never commit real `.env` values or credentials. Example values in [.env.example](./.env.example) are placeholders.

| Variable | Requirement/default | Purpose |
| --- | --- | --- |
| `NODE_ENV` | Required: `development`, `production`, or `test` | Runtime mode |
| `PORT` | Positive integer; default `3000` | HTTP listener; keep `3000` with current Compose |
| `DB_URI` | Required URL | PostgreSQL connection; host uses `localhost`, Compose uses `postgres` |
| `APP_NAME` | Required nonempty string | Metadata and health service name |
| `APP_VERSION` | Required nonempty string | Metadata and health version |
| `SUPER_ADMIN_PROVIDER` | Required nonempty string | Seed account lookup; use a valid email/phone provider |
| `SUPER_ADMIN_PASSWORD` | Required nonempty string | Password set by each seed run; choose a strong secret |
| `JWT_PRIVATE_KEY` | Required nonempty string | Access JWT signing secret |
| `REFRESH_TOKEN_PRIVATE_KEY` | Required nonempty string | Refresh JWT signing secret |
| `CLINIC_CURRENCY` | Three uppercase letters; default `EGP` | Default currency for doctor model creation; snapshots retain explicit currency |
| `STORAGE_TYPE` | `local`, `s3`, or `r2`; default `local` | Storage provider |
| `APP_URL` | Required for `local` | Origin used to build `/uploads/...` URLs |
| `AWS_REGION` | Required for `s3` | S3 region |
| `S3_BUCKET` | Required for `s3` | S3 bucket |
| `S3_PUBLIC_URL` | Required for `s3` | Base URL for object links |
| `CLOUDFLARE_BUCKET_NAME` | Required for `r2` | R2 bucket |
| `CLOUDFLARE_PUBLIC_DOMAIN` | Required for `r2` | Public R2 object URL base |
| `CLOUDFLARE_SECRET_ACCESS_KEY` | Required for `r2` | R2 secret access key |
| `CLOUDFLARE_ACCOUNT_ID` | Required for `r2` | R2 endpoint account identifier |
| `CLOUDFLARE_ACCESS_KEY_ID` | Required for `r2` | R2 access key identifier |

Local storage requires no SMTP credentials. S3 uses the AWS SDK's credential resolution; the application schema does not define AWS access key variables.

Additional infrastructure settings are outside the Zod schema:

| Variable | Consumer and behavior |
| --- | --- |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Compose database initialization; defaults are `postgres`, `postgres`, and `app_db`. Keep `DB_URI` consistent. |
| `REDIS_URL` | Example infrastructure setting only; not read by the API or used to configure the Compose Redis server. |
| `DOCKER`, `IN_DOCKER` | Database hostname detection reads these directly. Either equal to `true` prevents the special `db` to `localhost` rewrite. Compose does not set them. |

Only hostname `db` has the automatic host fallback. The example's `postgres` hostname must be changed explicitly when running the API on the host.

## Roles and authentication usage

Roles are `admin`, `doctor`, and `customer`. `Roles.USER` retains its key for migration compatibility but evaluates to `customer`. User administration requires `admin`. Public registration forbids `role`, `isVerified`, and `isBlocked`, and the service always creates a customer. Accounts are created immediately without OTP verification. Doctor profiles and their branch assignments will be provisioned by future admin services.

Register using `POST /api/v1/auth/register` with this shape, replacing the example password with your own:

```json
{
  "provider": "person@example.com",
  "name": "Example User",
  "password": "ExampleOnly#123"
}
```

`provider` is a phone number or email. Registration's name schema accepts 5–30 characters. The service enforces a password of at least eight characters with uppercase, lowercase, a digit, and one of `@$!%*?&#`.

Login accepts `provider` and `password`. Its successful response contains `data.user`, `data.accessToken` as `{ "token": "...", "expiresAt": "..." }`, and `data.refreshToken` as a string. Send the nested access token string on protected requests:

```http
Authorization: Bearer <data.accessToken.token>
Accept-Language: en
```

Access tokens preserve the existing **15-hour** lifetime, with consistent response expiry timestamps. Refresh tokens last seven days. Send `{ "refreshToken": "..." }` to refresh or logout; refresh rotates the stored token and logout destroys its session. Concurrent refresh requests using one token are serialized; only the first can rotate it. Password changes revoke all sessions, including the current one, so sign in again with the new password. Protected and refresh requests require an unexpired matching session owned by an unblocked user.

## API endpoints

Paths are relative to the API origin. `Authenticated` means a Bearer access token backed by an existing session. Swagger UI is available at `/api/docs`; the OpenAPI JSON is at `/api/docs/openapi.json`.

| Method | Path | Access | Purpose/input |
| --- | --- | --- | --- |
| GET | `/` | Public | Application name/version |
| GET | `/health` | Public | PostgreSQL health: 200 `ok` or 503 `degraded` |
| GET | `/api/constant/roles` | Public | Translated role constants |
| POST | `/api/v1/auth/register` | Public | Register with provider, name, password |
| POST | `/api/v1/auth/login` | Public | Provider/password login |
| POST | `/api/v1/auth/refresh-token` | Public | Rotate supplied refresh token |
| POST | `/api/v1/auth/logout` | Public | Delete session matching supplied refresh token |
| PATCH | `/api/v1/auth/password` | Authenticated | `currentPassword`, `newPassword` |
| GET | `/api/v1/auth/me` | Authenticated | Read current profile |
| PATCH | `/api/v1/auth/me` | Authenticated | Update name; administrative fields forbidden |
| DELETE | `/api/v1/auth/me` | Authenticated | Delete current user |
| POST | `/api/v1/users` | Admin | Create user; controller forces `isVerified: true` |
| GET | `/api/v1/users/filter` | Admin | Filter/paginate users |
| GET | `/api/v1/users/:id` | Admin | Read UUID user |
| PATCH | `/api/v1/users/:id` | Admin | Update UUID user; name/provider/password optional |
| DELETE | `/api/v1/users/:id` | Admin | Delete UUID user |
| POST | `/api/v1/media/upload` | Public | Multipart file in field `media` |
| GET | `/api/v1/media/:id/info` | Public | Media metadata |
| GET | `/api/v1/media/:id` | Public | Media bytes with stored content type |
| GET | `/uploads/<key>` | Public | Static local files, when present |

User filtering accepts `page`, `limit`, `provider`, `name`, `role`, `isVerified`, and `isBlocked`; no matching rows return 404. Name/provider filters use PostgreSQL case-insensitive substring matching (`ILIKE`). Controllers explicitly supply omitted pagination defaults. Joi still validates merged request fields without writing normalized values back to the request.

All JSON success responses use `{ status: "success", data: ... }`. This includes metadata, health, constants, auth, users, and media upload/metadata. Actions without a result return `data: null`. Health diagnostics are nested in `data` for both healthy and degraded responses. Binary media downloads and the OpenAPI document keep their native formats.

Expected errors use:

```json
{
  "status": "fail",
  "statusCode": 422,
  "message": "Localized error message"
}
```

Validation errors return 422. Expected 4xx errors use `status: "fail"`; server errors use `status: "error"`. Unexpected failures return 500 with the localized `internal_server_error` message. Messages support Arabic and English; Arabic is the default locale.

The health endpoint returns the same error fields with `status: "error"` and `statusCode: 503` when PostgreSQL is unavailable; its degraded status, service metadata, and dependency details are included in `data`.

## Migrations and seeding

Migrations are explicitly registered in [src/database/migrations/migrations.ts](./src/database/migrations/migrations.ts) and tracked in `SequelizeMeta`. The unchanged initial migration creates `pgcrypto`, `users`, `user_sessions`, and `media`. Migration 002 converts clinic roles, widens refresh-token storage to TEXT, and removes FCM tokens. Migration 003 creates the clinic domain tables and bilingual cash method. New migrations use explicit transactions. Schema changes do not use runtime model synchronization. The runner does not automatically wrap migrations in transactions.

```powershell
npm run migrate
npm run seed
```

Compiled equivalents are `npm run migrate:prod` and `npm run seed:prod`; they require a successful build. Rollback commands undo the last applied registered migration. Rollback first removes migration 003 domain tables and their data. Role rollback refuses doctor accounts and oversized refresh tokens, restores customer to user, narrows token storage, and restores an empty FCM column. Resolve or revoke incompatible sessions explicitly before rollback. Rolling back migration 001 deletes the original application tables and records; it is not a harmless setup check.

Seeding creates a verified, unblocked admin if the configured provider is absent. If the provider exists, it resets its password and leaves role/flags unchanged. This applies even when that provider belongs to a non-admin user. Docker executes seeding on every app start.

## Migration history conflicts

Migration, rollback, and status commands reject recorded migration names absent from the current registry before changing the schema. Source migration/seed commands use the existing tsx runtime through node --import tsx, avoiding deprecated ts-node loader warnings; compiled production commands are unchanged.

If a database records a different lineage such as 003-clinic-domain, its clinic tables may have different columns. A missing weekday error is one symptom of this mismatch. Check with npm run migrate:status. Preserve that database and use a new empty database, or prepare an explicit compatibility migration for its data. Do not delete SequelizeMeta entries, roll back unrelated migrations, or rename a single column to bypass the mismatch. Configure DB_URI for the intended new database, then run npm run migrate followed by npm run seed; seed resets the matching administrator password.

## Media storage

The active media pipeline uses [src/storage/storage-factory.ts](./src/storage/storage-factory.ts). It accepts one in-memory file up to 50 MiB, based on the declared MIME type: JPEG, PNG, WebP, MP4, QuickTime, or PDF. Keys combine a timestamp and the original filename. There is no owner column or per-user media authorization.

| Provider | Current behavior |
| --- | --- |
| Local | Writes `public/uploads` and returns `${APP_URL}/uploads/<key>`; Express serves `public` statically |
| S3 | Uses AWS SDK credentials, requests `public-read` on upload, and returns a URL under `S3_PUBLIC_URL`; bucket configuration must permit the requested ACL |
| R2 | Uses configured account credentials and bucket, with public URLs under `CLOUDFLARE_PUBLIC_DOMAIN`; public availability depends on provider configuration |

These APIs provide public media, not protected clinical-document storage. The separate cloud helper's signed URLs are not used by the mounted media flow. Image/video processing methods are placeholders, and video thumbnail generation is not a verified working video extraction path. Production local files lack a volume and can be lost during container replacement.

## Commands and verification

| Command | Actual behavior |
| --- | --- |
| `npm run start:dev` | Nodemon runs TypeScript through `tsx`; no migration/seed |
| `npm run build` | TypeScript compilation, then locale copying |
| `npm run copy-locales` | Copies locale JSON into `dist/i18n/local` |
| `npm start` | Runs `dist/index.js`; requires build output |
| `npm run migrate` / `npm run migrate:prod` | Applies pending source/compiled migrations |
| `npm run migrate:undo` / `npm run migrate:undo:prod` | Rolls back the last applied registered migration |
| `npm run migrate:status` / `npm run migrate:status:prod` | Read-only applied/pending migration report; rejects incompatible history |
| `npm run seed` / `npm run seed:prod` | Runs source/compiled seed, resetting the matching account password |
| `npm run start:with-migrate` | Source migration command followed by compiled API; does not build or seed |
| `npm run start:dev:with-migrate` | Source migrations, seed, and development API |
| `npm run lint` | Runs ESLint |
| `npm run lint:fix` | Runs ESLint with source rewriting |
| `npm test` | Runs focused Node test-runner tests through tsx, without database access |
| `npm run test:integration` | Creates/removes a disposable Docker PostgreSQL 16 container; tests migrations and HTTP flows without running seed |

For source/configuration changes, run lint, build, and relevant tests and report actual results. `npx tsc --noEmit` checks TypeScript without emitting output. Validate both Compose files when runtime configuration changes. Do not use migrations or seeding to verify documentation edits.

## Known limitations

- Clinic models and contracts are prepared; CRUD, booking, scheduling, overlap protection, payment workflows, inbox endpoints, reminders, and dashboard queries remain unimplemented.
- Google authentication is not implemented. Existing Google-only accounts are preserved but cannot sign in until a password is set. Password changes revoke all sessions; refresh rotation is serialized per session.
- Joi validates merged body/path/query input but does not apply normalized output. Future services must explicitly handle conversions/defaults. JSON success responses use the shared envelope; binary media downloads and the OpenAPI document retain their native formats.
- CORS allows localhost ports 3000/3001 including PATCH. Proxy trust remains one hop; rate limits use an in-memory store.
- Media remains public with incomplete processing. Production uploads lack a persistent volume. Docker startup still migrates and seeds, resetting the configured administrator password. No graceful shutdown or CI deployment workflow exists.
- Redis remains unused by application code. Email, SMS, push, medical records, and private clinical files are outside this foundation.
- npm reports dependency advisories; dependency security upgrades require a separate compatibility review.

## Repository guidance

Read [AGENTS.md](./AGENTS.md) for repository rules, [AI_INSTRUCTIONS.md](./AI_INSTRUCTIONS.md) for engineering workflow, and [ARCHITECTURE_BASELINE.md](./ARCHITECTURE_BASELINE.md) for the implemented architecture. Update these documents together when executable behavior or setup changes.
