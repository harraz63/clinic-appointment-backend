# Clinic Appointment Backend Architecture Baseline

## Purpose and implementation boundary

This document records the implemented backend foundation for one clinic organization with multiple branches. Versioned clinic modules provide models, migrations, input types, validation patterns, bilingual content, and ownership helpers. Admin branch/specialty catalog CRUD, public active browsing, admin doctor account/profile management, admin schedule management, public doctor browsing, availability and confirmed customer booking/history are implemented; lifecycle actions, payment processing, inbox delivery, and dashboard queries remain unimplemented. See [CLINIC_FOUNDATION.md](./CLINIC_FOUNDATION.md) for the model and roadmap.

The package is clinic-appointment-backend version 1.0.0. The runtime remains Express 4, TypeScript with native ESM/NodeNext and strict:false, Sequelize 6, and PostgreSQL. Docker targets Node.js 20, PostgreSQL 16, and Redis 7.

## Runtime topology and startup

```text
HTTP client
    |
Express API
    |-- PostgreSQL: users, user_sessions, media, SequelizeMeta
    |-- Redis: pending registrations and OTP state
    |-- StorageFactory: local public/uploads, Amazon S3, or Cloudflare R2

Redis backs signup and OTP state. Registration and password-reset OTPs are issued by their respective request endpoints; pending registrations can request a resend at `/api/v1/auth/register/resend-otp`. OTP issuance endpoints currently return codes in `data.otp`; no SMS provider is configured.
Firebase, SMTP, FCM, and Google authentication have been removed.
```

`src/index.ts` creates Express and an HTTP server, authenticates the database connection, calls Passport configuration, installs middleware/routes, and starts listening on `env.PORT`. Startup database initialization authenticates only; it does not synchronize models, run migrations, or seed. Swagger UI is served at `/api/docs`, its OpenAPI document is served at `/api/docs/openapi.json`, and the startup log reports the docs URL. No Socket.IO server exists. There are no shutdown signal handlers for closing the server and database pool.

Both Docker entry scripts run migration and seed commands before starting the API. Development uses source commands; production uses compiled JavaScript. Compose waits for PostgreSQL and Redis health checks before starting the app, while the app's own `/health` checks only PostgreSQL.

Compose publishes container port 3000 as `${PORT:-3000}` and health-checks internal port 3000. Since the API also reads `PORT`, changing that setting away from 3000 without adjusting Compose can break routing and health checks. The default configuration keeps them aligned.

## Application layers and HTTP routing

The intended feature flow is:

```text
route -> authentication/authorization -> Joi validation -> controller -> service
                                                                     |
                                                        Sequelize model/storage
```

Some current handlers directly access models, and media routes have no authentication or Joi schemas. These are current deviations, not standards for new features.

`src/app.ts` installs i18n, trusts one proxy hop, uses `qs` for queries, and applies rate limiting, CORS, body parsing, Passport initialization, Helmet, and static serving from `public`. It then mounts routes, followed by not-found and centralized error middleware. The limiter permits 1000 requests per IP per 15 minutes using the default in-memory store. CORS lists localhost ports 3000 and 3001 and GET/POST/PUT/PATCH/DELETE.

| Mount | Responsibility | Access |
| --- | --- | --- |
| `/` | Application name and version | Public |
| `/health` | Database connectivity and process metadata | Public |
| `/api/docs` | Swagger UI for the implemented HTTP API | Public |
| `/api/docs/openapi.json` | OpenAPI 3 document | Public |
| `/api/constant` | Role constants | Public |
| `/api/v1/auth` | Registration, login, refresh, logout, self-profile/password | Mixed public and authenticated routes |
| `/api/v1/users` | User create/filter/read/update/delete | Authenticated `admin` |
| `/api/v1/branches`, `/api/v1/specialties` | Public active catalog lists with bilingual name search and pagination | Public |
| `/api/v1/admin/branches`, `/api/v1/admin/specialties` | Catalog CRUD and filtered pagination | Authenticated `admin` |
| `/api/v1/admin/doctors` | Doctor account/profile provisioning and admin profile CRUD with filtered pagination | Authenticated `admin` |
| `/api/v1/admin/doctors/:id/schedules`, `/api/v1/admin/doctors/:id/schedule-exceptions` | Per-doctor weekly hours and dated overrides in branch-local time | Authenticated `admin` |
| `/api/v1/doctors`, `/api/v1/doctors/:id`, `/api/v1/doctors/:id/availability` | Safe public doctor profiles and date-grouped UTC slots | Public |
| `/api/v1/appointments`, `/api/v1/appointments/:id` | Confirmed booking and own history/detail | Authenticated `customer` |
| `/api/v1/media` | Upload, bytes, and metadata retrieval | Public |

Versioned modules live in `src/modules/<domain>/v1`; constants are an unversioned exception. See [README.md](./README.md) for individual endpoints.

Joi validation merges body, params, and query in that order, so later values win. Validation errors become localized 422 responses. The middleware does not propagate Joi's returned normalized value to the request. JSON success responses use `{ status: 'success', data }`; no-result actions return `data: null`. Errors use `{ status: 'fail' | 'error', statusCode, message }`, with health-check diagnostics included as `data` on its 503 response. Binary media downloads and the OpenAPI document retain their native formats. HTTP errors use `HttpResponseError`; unexpected errors are logged and return a localized 500 response.

## Persistence model

| Table | Implemented state |
| --- | --- |
| `users` | UUID ID, unique normalized Egyptian `phone`, nullable password, name, role enum, optional unique Google ID, verification/block flags, timestamps |
| `user_sessions` | UUID ID, user foreign key, unique nullable TEXT refresh token, expiration, timestamps; user deletion cascades |
| `media` | UUID ID, storage key and URL, original filename, content/media types, size, thumbnail/metadata JSON, timestamps; no owner foreign key |
| `SequelizeMeta` | Applied migration names maintained by the migration runner |

The registered `001-initial-schema` migration creates `pgcrypto` and the three application tables. Models use UUIDs; a legacy helper named `JoiCustomValidateObjectId` actually validates UUIDs. The migration runner applies pending entries from its explicit registry and rolls back the last applied entry. Migration operations are not automatically transactional. The initial rollback drops media, sessions, and users, then the role/media enum types.

Migration 004 renames `users.provider` to `users.phone`; historical migrations remain unchanged. Migration 005 transactionally installs `btree_gist` and doctor/customer non-overlap constraints for non-cancelled half-open UTC intervals. Existing conflicts fail preflight without altering appointments; rollback removes constraints and retains data and the extension. Apply it before deploying booking routes.

The seed looks up `SUPER_ADMIN_PHONE`. If absent, it creates a verified, unblocked `admin`. If present, it overwrites that account's password using `SUPER_ADMIN_PASSWORD` and the password hash hook, but does not correct its role or flags. Every Docker app start executes this seed, including production.

## Authentication and sessions

Public doctor projections exclude account identity/contact and administrative fields. Eligibility requires active doctor/branch/specialty and an unblocked doctor-role account. Availability uses `@js-temporal/polyfill`, branch-local exceptions/weekly hours and the current duration. It returns up to 31 inclusive dates within today through +90 days, omitting uncertain boundaries, clock-transition crossings, past starts and non-cancelled bookings. Booking locks customer, doctor and related eligibility records, revalidates exact slots and customer conflicts, and explicitly writes confirmed status and booked snapshots. Customer appointment list/detail queries constrain ownership in the database; other customers' records return 404. Schedule changes retain existing appointments. Lifecycle actions remain future work.

The clinic roles are admin, doctor, and customer. Roles.USER is a compatibility constant whose public value is customer. User administration is admin-only. Clinic ownership helpers permit only assigned-doctor or owning-customer access and define initial action permissions; no clinic routes invoke them yet.

Public registration accepts Egyptian phone, name, and password, rejects role/isVerified/isBlocked, and forces customer in the service. It stores a password hash in Redis and creates a database account only after OTP verification. `POST /api/v1/auth/register` starts registration, and `POST /api/v1/auth/register/resend-otp` resends the code for a pending registration. `POST /api/v1/auth/forgot-password` is the sole password-reset OTP request and can be called again after the resend cooldown. Admin-created accounts are marked verified. Customer password recovery and phone changes use OTP; a changed phone is activated only after verification. OTPs are HMAC-hashed in Redis with expiry, attempt limits, and cooldowns; issuance endpoints currently return the generated code in `data.otp`. Self-profile validation forbids administrative fields. Passwords use bcrypt cost 12. Default queries exclude passwords, and model serialization removes them even with password-inclusive scopes.

Login rejects blocked accounts and creates a persisted session. Access tokens retain the existing 15-hour lifetime; refresh tokens last seven days. Access authentication and refresh require a matching, unexpired session belonging to an existing unblocked user. Invalid refresh JWTs and missing sessions return expected authentication errors. Refresh rotates the stored token while holding a database row lock, so a concurrent request with the previous token fails. Logout destroys its session.

Password changes verify the current hash, save the new password, and revoke every user session in one transaction. Existing accounts may retain a legacy Google ID in the database, but Google sign-in is not implemented; accounts without passwords need a password set before they can sign in. No push token endpoint remains.

## Storage and supporting integrations

`MediaService` selects local, S3, or R2 storage through `StorageFactory`. Upload keys use a timestamp plus the original filename. Multer buffers one file in memory, with a maximum of 50 MiB, and accepts JPEG/PNG/WebP images, MP4/QuickTime videos, and PDFs by declared MIME type. Image and video processing methods are placeholders; video thumbnail generation attempts Sharp on a video buffer and is not an established working extraction pipeline.

Media upload, metadata, and download routes are unauthenticated and have no ownership checks. Local files are stored under `public/uploads` and statically served at `/uploads/...`. S3 uploads request `public-read`; R2 builds public-domain URLs. A separate `cloud-storage.service.ts` helper uses signed URLs, but the mounted media flow does not use it. There is no private clinical-document storage contract.

Development Compose bind-mounts the repository, including local uploads. Production has no upload volume, so local files can be lost on container replacement. PostgreSQL and Redis each have named data volumes in both Compose configurations.

Notifications are prepared as recipient-linked inbox records, without senders, workers, reminders, or external channels. Firebase and SMTP dependencies and scaffolding have been removed.

Arabic and English JSON translations live under `src/i18n/local`, with Arabic as the default and `Accept-Language` as the configured header. The build copies locale files into `dist/i18n/local`.

## Configuration, security, and verification baseline

Zod validates configuration in src/config/env.ts. Redis and OTP settings are synchronized with `.env.example` and README. OTP HMAC uses `OTP_HMAC_SECRET` when configured and otherwise the refresh token signing key. Storage settings remain conditional by provider. SMTP, SMS provider, and Google authentication settings have been removed. CLINIC_CURRENCY defaults to EGP and validates three uppercase letters; doctor model creation uses this default. Examples and the README table track these settings.

Database hostname fallback still only rewrites db to localhost outside Docker. SQL logging is disabled, and connection/authentication logs no longer include database URLs or user objects.

Original checks failed with six source lint errors plus generated-output errors, missing Firebase credentials, and a placeholder npm test. The foundation removes those build blockers, excludes dist from linting, and adds Node/tsx unit and Docker integration suites. See README commands and CLINIC_FOUNDATION verification notes for actual results.

Remaining limitations include public media, no production upload volume, seed password resets on every Docker startup, no graceful shutdown, in-memory rate limiting, and no CI/deployment workflow. Password changes revoke all sessions and refresh rotation is serialized per session.

Follow [AGENTS.md](./AGENTS.md) and [AI_INSTRUCTIONS.md](./AI_INSTRUCTIONS.md); setup and command details are in [README.md](./README.md).

## Prepared domain persistence

Migration 002 transactionally converts user to customer, retains admins, rejects unrelated legacy account roles, replaces the enum, widens refresh tokens to TEXT, and removes fcmToken. Rollback rejects doctor accounts or oversized refresh tokens, restores legacy roles, narrows token storage, and restores an empty nullable FCM column. Migration 003 transactionally creates branches, specialties, doctors, doctor_schedules, schedule_exceptions, appointments, payment_methods, payment_records, and notifications, with a bilingual cash method. Its rollback deletes these domain tables and data.

Doctor profiles have one user, one branch, and one specialty. Admin doctor provisioning transactionally creates a verified doctor-role user and profile, requires active branch/specialty assignments, and preserves account/profile role consistency through the generic user APIs. Doctor list/detail responses include user, branch, and specialty while excluding password fields. Profile deletion deactivates rather than removes the account or historical records. Admins atomically replace each doctor's weekly hours and dated days off or replacement intervals; overlaps are rejected per doctor, and saved schedules block branch reassignment until cleared. Appointments reference customer accounts, doctors, and their booked branch, with independent status and price/currency/duration/timezone snapshots. Schedule intervals are branch-local; appointment instants use PostgreSQL timezone-aware timestamps. Inbox notifications reference recipients. Associations initialize centrally without synchronization. JSONB bilingual content, DECIMAL money, foreign keys, indexes, and basic checks are prepared; availability and transactional confirmed booking/history are implemented. Migration 005 uses btree_gist exclusion constraints on non-cancelled doctor/customer UTC ranges.

## Migration CLI safeguards

The runner now rejects unregistered applied migration names before up/down mutations. `npm run migrate:status` and its compiled equivalent report history/pending names with SELECT queries only; status on an empty database creates no bookkeeping table. Source migration/rollback/seed scripts use the already-installed tsx runtime via node --import, replacing the deprecated ts-node loader. No historical migration definitions were edited. Different schema lineages require separate databases or an explicit compatibility migration.
