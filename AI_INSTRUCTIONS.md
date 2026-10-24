# AI-Assisted Engineering Instructions

This document guides changes to Clinic Appointment Backend code, configuration, migrations, tests, and documentation.

## Sources of truth

Read in this order:

1. [AGENTS.md](./AGENTS.md) for mandatory repository rules.
2. [ARCHITECTURE_BASELINE.md](./ARCHITECTURE_BASELINE.md) for implemented architecture and limitations.
3. This document for delivery standards.
4. [README.md](./README.md) and the relevant source for operational details.

When documentation disagrees with code, inspect executable behavior and update stale documentation within the task's scope. An existing defect is not an intended product requirement. Separate descriptions of current behavior from standards for future changes.

## Git branch workflow

- Never edit task files directly on `dev`. Check the current branch and working tree before making changes.
- Create a descriptive task branch from the latest available `dev` branch before editing, for example `feature/appointment-search`, `fix/otp-expiry`, or `docs/branch-workflow`.
- Continue on the existing task branch when it already belongs to the current task. If currently on `dev`, switch to a new task branch first.
- Preserve unrelated local changes and avoid branch operations that discard or mix them into the task.
- Keep task changes on the task branch. Do not merge into or commit directly to `dev` unless the user explicitly requests it.

## Current implementation boundary

The repository is an Express API foundation for a clinic appointment project. It has users, authentication, sessions, media, metadata, constants, a database health endpoint, branch/specialty catalog APIs, admin doctor account/profile management, and admin doctor schedules. Other clinic models, migrations, validators, typed inputs, and appointment ownership helpers are prepared under versioned modules. Public doctor browsing, timezone-aware slots, automatically confirmed customer booking and personal history are implemented. Appointment cancellation/rescheduling, doctor/admin views and lifecycle actions, and ownership-scoped audit history are implemented. Medical-record workflows remain unimplemented. The roadmap and contracts are documented in [CLINIC_FOUNDATION.md](./CLINIC_FOUNDATION.md).

Use the existing Express, Joi, Sequelize, Passport/JWT, Zod, i18n, Redis, and storage patterns. Native ESM is enabled through `package.json` and TypeScript's NodeNext configuration. Swagger UI is mounted at `/api/docs`, with its OpenAPI JSON at `/api/docs/openapi.json`; keep `src/docs/openapi.ts` aligned with implemented routes. There is no NestJS, TypeORM, queue, or Socket.IO server.

## Feature structure and request flow

Use the existing layout for versioned HTTP features:

```text
src/modules/<domain>/v1/
    <domain>.routes.ts
    <domain>.validation.ts
    <domain>.controller.ts
    <domain>.service.ts
    model/
```

Create only the files a feature needs; small metadata and health handlers do not require artificial service layers. Keep existing naming exceptions unless the task includes a rename.

- Routes compose authentication, role middleware, validation, and controllers.
- Joi schemas define allowed request fields, identifiers, and filter inputs. The UUID helper retains the legacy name `JoiCustomValidateObjectId`; its actual validation is UUID-based.
- `validateRequest` checks `{ ...req.body, ...req.params, ...req.query }`, with later sources overriding earlier keys. It does not assign `validationResult.value` back to the request. Services must not assume conversion, stripping, or defaults happened on `req`.
- Controllers translate input/output and delegate domain behavior to services. Avoid new direct model queries in controllers even where older handlers use them.
- Services enforce authorization, business rules, and multi-record consistency. Use transactions when a change requires atomic persistence.
- Models declare durable state and associations; migrations apply schema changes. Keep imports and association initialization explicit.

JSON success responses use the shared `{ status: 'success', data }` envelope through `sendSuccess` and the `Success<T>` type. Use `data: null` when an action has no result. Errors use `{ status: 'fail' | 'error', statusCode, message }`; the health endpoint's 503 error also carries its diagnostics in `data`. Keep binary media downloads and the OpenAPI document in their native formats. Update OpenAPI and the response-contract documentation when changing these conventions.

## Authentication and authorization

- Use Roles: admin, doctor, customer. The compatibility key Roles.USER evaluates to customer; migration 001 remains executable without editing it.
- Public registration forbids role, isVerified, and isBlocked. The registration service whitelists identity/password fields and forces customer. Self-profile validation forbids administrative fields.
- Account identity is the normalized Egyptian `phone` field. Public customer registration stages a password hash in Redis until OTP verification; use `POST /api/v1/auth/register/resend-otp` to resend a pending signup OTP. `POST /api/v1/auth/forgot-password` is the only password-reset OTP request. Admin-created accounts are marked verified. OTP issuance endpoints currently return codes in `data.otp`; do not log OTPs.
- Use auth for protected endpoints and obtain identity/session from the authenticated request. Session authentication and refresh enforce account blocking, session ownership, and session expiration. Missing sessions yield an expected 401.
- Appointment access foundations live in appointment.permissions.ts: admins manage all, doctors view/confirm/complete/no-show their own, and customers view/cancel/reschedule their own. Lifecycle services enforce before-start customer changes, at/after-start completion/no-show and admin late cancellation. Rescheduling keeps the doctor, price and currency while refreshing branch, timezone and duration; every successful write records audit history atomically.
- Preserve bcrypt hashing through the user save hook. User serialization strips passwords even for password-inclusive scopes. Do not log credentials, users, tokens, connection URLs, or SQL values.
- Access token responses retain token and expiresAt. Access tokens preserve the existing 15-hour lifetime; refresh tokens last seven days. Password changes save the new hash and revoke all sessions transactionally. Refresh rotation locks the session row so concurrent use of one refresh token yields at most one successful rotation.
- Authentication uses phone/password with OTP-based registration, customer password recovery, and verified customer phone changes; Google authentication and its runtime configuration have been removed. Legacy Google IDs may remain in stored user rows and must not be deleted by an unrelated change.

## Configuration and integrations

- Read new configuration through `env` in `src/config/env.ts`. Add schema validation, example settings, and README guidance together. For optional providers, validate required settings when that provider is selected.
- `.env.example` uses Compose service names. Host development needs `localhost` for PostgreSQL; only the hostname `db` has a fallback in database configuration, not `postgres`.
- SMTP, Google authentication, and SMS provider configuration have been removed. Keep OTP settings synchronized across `env.ts`, `.env.example`, and README. `CLINIC_CURRENCY` defaults to `EGP`.
- Redis is initialized once through `src/config/redis.ts` and configured by `REDIS_URL`; it stores pending registrations and OTP state.
- Firebase, Nodemailer, and session FCM handling have been removed. Notifications are prepared as database-backed inbox records only; no delivery or reminder worker exists.
- Use Winston for new logs and sanitize error context. Existing authentication and database logs expose sensitive values and must not be copied into new code or documentation examples.

## Storage and localization

- Use `StorageFactory` to select local, S3, or R2 storage. The mounted media routes use this abstraction; the separate `cloud-storage.service.ts` helper does not define their behavior.
- Current media endpoints are unauthenticated. Local objects are publicly served from `public/uploads`, S3 uploads request `public-read`, and R2 URLs rely on provider public-domain configuration. No signed private download or per-user ownership contract exists.
- Multer uses memory storage, a one-file limit, and a 50 MiB maximum. Current keys include the supplied original filename. Do not assume sanitization, malware inspection, or clinical-data protections.
- Image/video processing contains placeholders, and video thumbnails attempt to process a video buffer with Sharp. Do not claim working transcoding or thumbnail extraction without testing and implementing it.
- Preserve English and Arabic keys under `src/i18n/local`. Arabic is the default locale; the configured language header is `Accept-Language`. Keep user-visible translation keys synchronized across both files.
- Production Compose does not persist local uploads. Storage or deployment changes must account for the actual file location and retention needs rather than assuming a volume exists.

## Database and migrations

Use ordered migrations registered in `src/database/migrations/migrations.ts`; do not use `sequelize.sync()`. Do not edit migrations that have reached shared databases. The current runner stores names in `SequelizeMeta`, applies pending registered migrations in order, and rolls back the last applied registered migration.

The runner does not wrap migrations in a transaction automatically. Design new migrations for partial-failure recovery and use transactions where supported and appropriate. Verify changes against disposable data, including rollback when supported. The initial migration creates `pgcrypto`, users, sessions, and media; its rollback deletes the three application tables.

Both Docker startup scripts run migrations and seeding on each start. Seeding resets the password for an existing matching phone without repairing its role, verification, or blocked status. Never describe this as create-only initialization or test it against a shared database without authorization.

## Quality and handoff

- Inspect relevant source before changing it; keep unrelated refactors and security fixes out of a narrow task.
- Use explicit boundary types, native ESM `.js` imports, four spaces, single quotes, semicolons, and the configured CRLF style for TypeScript. Existing `strict: false` does not justify adding untyped interfaces.
- For behavior changes, add focused verification for the actual behavior and establish a runnable test command if the task adds a suite. Installed Jest and ESLint test globals alone do not establish test coverage.
- Run the applicable lint, build, and test commands from [AGENTS.md](./AGENTS.md). For documentation-only edits, check relative links, commands, environment names, routes, and consistency; no runtime database mutation is needed.
- State actual results. The original baseline had source/generated-output lint failures, a missing Firebase credential import, and a failing test placeholder. These have been addressed; report actual check results for each change. Focused tests use Node test runner with tsx; Docker integration tests assert their selected connection matches their disposable database before any database operation. Load database-backed helpers dynamically after configuring the containers; never import them at the test entrypoint before that configuration.
- Keep all four root documents aligned when public behavior, setup, scripts, environment settings, or architectural boundaries change. Describe implementation, verification, and material limitations in the handoff.

## Clinic persistence and contracts

See [CLINIC_FOUNDATION.md](./CLINIC_FOUNDATION.md). Initialize associations explicitly through `initializeAssociations()`; it is idempotent and never synchronizes tables. Preserve domain history with restrictive foreign keys and active flags. UTC appointment timestamps and booked snapshots are distinct from branch-local schedule intervals. Money stays decimal strings. Joi normalized output still is not written back to requests; controllers/services must explicitly normalize validated input. Mount clinic routes only when their real services exist; doctor administration, schedules, public browsing, availability and customer booking/history are implemented. Booking derives identity and snapshots, locks customer/doctor/eligibility records, and rechecks the exact slot. Migration 005 prevents doctor and customer overlaps for all non-cancelled appointments; retain it for every future appointment write path. Migration 006 stores append-only lifecycle history. Lock customer and doctor/eligibility records before the appointment, recheck policies under locks, and never expose actor account IDs in history responses.

## Incompatible database histories

The migration runner validates recorded names against the current registry before up/down changes. Status is read-only, including on an empty database. Use `npm run migrate:status` to diagnose conflicts. Unregistered names such as `003-clinic-domain` indicate a separate schema lineage, not a missing-column fix. Do not change already-applied migration files or remove SequelizeMeta entries. Preserve the database and use a new database unless a data-preserving compatibility migration has been explicitly chosen. Source CLI scripts use `node --import tsx` to avoid deprecated ts-node loader warnings.
