# Repository Instructions for Coding Agents

These instructions apply throughout Clinic Appointment Backend. Read [ARCHITECTURE_BASELINE.md](./ARCHITECTURE_BASELINE.md) and [AI_INSTRUCTIONS.md](./AI_INSTRUCTIONS.md) before changing application behavior. Use [README.md](./README.md) for setup and operating instructions.

## Git branch workflow

- Never make task changes directly on `dev`. Before editing, check the current branch and working tree.
- Start each task branch from the latest available `dev` branch and give it a descriptive name, such as `feature/appointment-search`, `fix/otp-expiry`, or `docs/branch-workflow`.
- If already on a task branch, continue using it when it belongs to the current task. If the current branch is `dev`, create and switch to a new task branch before editing.
- Preserve unrelated working-tree changes. Do not switch branches or create a branch in a way that discards or carries unrelated changes; resolve the situation safely before proceeding.
- Keep all task edits on the task branch. Do not merge into, commit to, or otherwise write task changes directly to `dev` unless the user explicitly asks for that operation.

## Project facts

- This repository is the foundation for a clinic appointment backend. Clinic domain models, migrations, bilingual validation, and ownership contracts are prepared. Catalog, admin doctor/schedule, public doctor browsing, availability, and confirmed customer booking/history endpoints are implemented; lifecycle actions remain future work. See CLINIC_FOUNDATION.md.
- The current application uses TypeScript, native ES modules, Express 4, Sequelize 6, and PostgreSQL. Docker targets Node.js 20 and provisions PostgreSQL 16 and Redis 7.
- Implemented HTTP areas are authentication, administrator user management, self-profile management, catalog, admin doctor and schedule management, public doctor browsing/availability, customer booking/history, public media upload/retrieval, constants, metadata, and database health.
- Roles are `admin`, `doctor`, and `customer`. `Roles.USER` is a compatibility key with value `customer` because migration 001 imports it. Public registration forbids role, verification, and blocking fields and always creates customers.
- Redis backs pending signup and OTP state. OTP issuance endpoints currently return codes in `data.otp`; no SMS provider is configured. Account identity is an Egyptian phone number; clinic contact email fields are separate. Firebase, SMTP, FCM, and Google authentication have been removed. Swagger UI is available at `/api/docs`, with OpenAPI JSON at `/api/docs/openapi.json`; there is no notification worker.

## Implementation rules

The following are standards for new or modified code. They do not imply that all existing code already meets them; known deviations are documented in the architecture baseline.

- Follow the versioned feature layout under `src/modules/<domain>/v1`. The existing constants module is an unversioned exception.
- Keep controllers focused on HTTP translation. Put business rules, authorization decisions, and persistence orchestration in services.
- Validate external input with Joi through `validateRequest` before controller execution. The current middleware merges body, path, and query input and does not replace requests with Joi's normalized output; account for this when using defaults or conversions.
- Use `.js` extensions in relative TypeScript imports and preserve native ESM conventions.
- Add explicit types at module boundaries. Narrow `unknown` safely rather than introducing `any`. TypeScript currently has `strict: false`; do not describe the project as using strict mode.
- Use `env` from `src/config/env.ts` for new runtime configuration. Keep the Zod schema, `.env.example`, and README environment table synchronized when settings change. Existing direct process-environment access is not a pattern to extend.
- Use `auth`, `authorizeRoles(...)`, and `Roles` for protected HTTP features. Derive identity from authentication and enforce resource ownership in services. Use only the three clinic role values. Ownership helpers require database-derived ownership facts.
- Use `HttpResponseError` for expected HTTP failures and retain centralized error handling and the existing response conventions.
- Preserve Arabic and English localization. Add matching translation keys to both locale files and use `req.__` for localized HTTP messages.
- Use the existing Winston loggers. Never add logs containing passwords, password hashes, tokens, credentials, database connection strings, or personal data. SQL logging is disabled to avoid logging bound personal data.
- Use `StorageFactory` and the storage interface for file operations. Current media is public and has no ownership controls; do not use it for sensitive clinical records or claim it provides private storage.
- Evolve PostgreSQL through ordered migrations registered in `src/database/migrations/migrations.ts`. Never introduce runtime `sequelize.sync()` for shared databases. Add a migration instead of changing one already applied to a shared environment.
- Match the existing four-space indentation, single quotes, semicolons, and ESLint CRLF rule when editing TypeScript. Keep changes focused on the requested task.

## Operational constraints

- `npm run start:dev` and `npm start` do not migrate or seed. Both Docker startup scripts migrate and seed before starting the API, including production.
- Seeding looks up `SUPER_ADMIN_PHONE` and resets that existing user's password to `SUPER_ADMIN_PASSWORD`. It does not repair an existing user's role or status. Do not describe the seed as create-only or run it against an unintended database.
- The initial migration creates `users`, `user_sessions`, and `media`; migration bookkeeping uses `SequelizeMeta`. Rolling back that migration drops the application tables.
- Local uploads live under `public/uploads`. Development Compose preserves them through its repository bind mount; production Compose has no upload volume. Container replacement can lose production local files.
- Keep `.env`, service-account JSON, uploads, and real user data out of commits. Never generate or commit provider credentials.

## Verification and handoff

For source or configuration changes, run relevant checks and report actual outcomes:

```bash
npm run lint
npm run build
npm test
```

`npx tsc --noEmit` is useful for a type check without emitted build files. `npm test` runs focused Node test-runner tests through tsx. `npm run test:integration` requires Docker and creates/removes its own loopback-only PostgreSQL 16 container; it does not use the configured database or run seed. Do not invent a documentation validation command.

Validate both Compose configurations when Docker, startup, or environment behavior changes:

```bash
docker compose config --quiet
docker compose -f docker-compose.prod.yml config --quiet
```

Use an isolated database for migration, seed, and startup verification. For documentation-only changes, verify links, scripts, configuration names, routes, and claims against source; do not run migrations or seed as a documentation check. Record existing lint/build failures separately from regressions caused by the change.

Keep these four documents synchronized with executable behavior. Handoffs should state what changed, what was checked, and any remaining limitations.

## Clinic foundation constraints

- Migrations 002 and 003 prepare clinic roles, remove FCM storage, and create domain tables; migration 004 renames `users.provider` to `users.phone`; migration 005 adds doctor/customer overlap protection using `btree_gist`. Migration 001 remains unchanged. Do not use schema synchronization.
- Legacy `user` accounts convert to `customer`; other inherited roles block migration for manual resolution. Role rollback refuses doctor accounts or refresh tokens over 255 characters, restores customers to `user`, and narrows token storage. Removed FCM values cannot be restored.
- Persist bilingual business text as JSONB `{ ar, en }`; return both languages. Money uses DECIMAL(12,2) and decimal strings. Booking services must snapshot price, currency, duration, timezone, and branch.
- Schedules use branch-local times; appointments use UTC instants. Availability and confirmed customer booking are implemented. Migration 005 prevents doctor/customer overlaps for non-cancelled appointments. Lifecycle actions and notification delivery remain unimplemented.

## Migration history safety

Source migration and seed scripts use the existing tsx runtime through `node --import tsx`; compiled commands remain JavaScript. `npm run migrate:status` (or `migrate:status:prod`) inspects applied/pending migrations without creating tables. Up, down, and status reject unregistered migration names before schema changes. A database from a different clinic schema requires a separate new database or an explicit compatibility migration; never delete bookkeeping or drop existing data to bypass this check.
