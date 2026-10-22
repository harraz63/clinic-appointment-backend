# Clinic foundation and implementation roadmap

## Analysis and implementation boundary

The original template provided Express 4, TypeScript 5 with native ESM, Sequelize 6/PostgreSQL, Passport/JWT sessions, Joi, Zod configuration, Arabic/English i18n, Winston, and public media through StorageFactory. These remain the foundation. There is no frontend or multi-tenant organization model. TypeScript remains `strict: false`.

Authentication, administrator user management, profile management, public media, constants, metadata, and database health have real HTTP handlers. The clinic modules below provide persistence definitions and development contracts only. No clinic routes are mounted, no appointment can be booked through this API yet, and no mock dashboard or payment workflow is presented as implemented.

Removed inherited functionality: Firebase helper, SMTP transport/configuration, FCM device-token endpoint/storage, and their direct Firebase/Nodemailer dependencies. The already-used google-auth-library 9.15.1 is now declared directly: Firebase previously supplied it transitively, and retaining the existing Google mobile verifier requires it after Firebase removal. Google authentication is optional and defaults off. Existing Docker migration/seed behavior is unchanged.

## Prepared structure

```text
src/
    constants/              Clinic roles and appointment/payment statuses
    shared/                 LocalizedText, Joi field patterns, future API types
    database/
        associations.ts     Explicit, idempotent association initialization
        migrations/         001 unchanged; 002 roles/sessions; 003 clinic tables
    modules/
        auth/v1/            Existing authentication and profile HTTP handlers
        user/v1/            Existing admin user HTTP handlers
        user-session/v1/    Session model; no FCM endpoint
        branches/v1/        Model, input type, bilingual validator
        specialties/v1/     Model, input type, bilingual validator
        doctors/v1/         Model, input type, profile validator
        doctor-schedules/v1/ Working intervals, dated exceptions, validation
        appointments/v1/    Snapshot model, internal input, ownership permissions
        payments/v1/        Payment methods/records, internal record input
        notifications/v1/   Recipient inbox model and internal input
        dashboard/v1/       Admin/doctor metric and filter types
        media/, constant/, home/, health/  Existing infrastructure
```

Empty controllers, service shells, artificial repositories, placeholder endpoints, and new dependencies have deliberately not been added. Future HTTP features follow route → auth/roles → Joi → controller → service → Sequelize/storage. Business services own authorization, normalization, transactions, and orchestration.

## Data model and invariants

| Entity/table | Prepared relationship and durable state |
| --- | --- |
| User / users | Shared identity; admin, doctor, or customer. Customers need no separate patient table. |
| Branch / branches | Bilingual name, description, address; phone/email; timezone default Africa/Cairo; active flag. |
| Specialty / specialties | Bilingual name and description; active flag; shared by many doctors. |
| Doctor / doctors | Unique user account; exactly one required branch and specialty; bilingual display name/biography; decimal price, currency, positive duration, availability and active flags. |
| Doctor schedule / doctor_schedules | Doctor, weekday 0–6 (Sunday–Saturday), local start/end times. Multiple intervals per day are supported. Overnight intervals must be split across days. |
| Schedule exception / schedule_exceptions | Doctor and calendar date, whole-day unavailability or a replacement interval, optional bilingual reason. Multiple replacement intervals are representable; conflict resolution remains a scheduling service responsibility. |
| Appointment / appointments | Customer account, doctor profile, booked branch, UTC start/end, timezone, duration, booked price and currency snapshots, lifecycle status. |
| Payment method / payment_methods | Unique stable code, bilingual name/instructions, active flag. Migration creates cash with code `cash`. |
| Payment record / payment_records | Appointment and method, amount/currency, independent payment status, optional received timestamp and receiving admin account. |
| Notification / notifications | Recipient account, extensible event type, bilingual title/body, nullable read timestamp, optional paired resource type/UUID. |

All new tables use UUID primary keys and timestamps. Foreign keys restrict deletion to protect history; branches, doctors, specialties, and methods can be deactivated. Customer/doctor account deletion can consequently be rejected once domain records reference them. Future services must translate such expected persistence failures into localized HTTP errors.

Database checks enforce nonnegative monetary values, positive durations, valid weekday/interval bounds, exception shape, known initial statuses, currency format, paired notification resource references, and nonblank Arabic/English JSON values. Indexes cover doctor/branch/specialty lookup, schedule dates, appointment ownership/dates/status, payment lookup/status, and notification recipient/read state.

Money uses PostgreSQL DECIMAL(12,2), TypeScript strings, and decimal-string response values. `CLINIC_CURRENCY` defaults to EGP for doctor model creation. Appointments and payment records require explicit snapshot currencies. Revenue aggregation must group by currency; do not sum different currencies into one amount.

Appointment statuses are pending, confirmed, completed, cancelled, and no_show. Payment statuses are unpaid, paid, and refunded. They are independent strings constrained by database checks; extending a status requires a new migration and matching type/constants. No transition rules are implemented.

The database does not enforce that a profile's user has the doctor role or an appointment's user has the customer role. Future services must check these facts and the doctor's current branch when creating records. Later doctor reassignment and price/duration changes must never overwrite historical appointment snapshots. Price and ownership IDs in internal persistence inputs must be derived by services, not trusted from a booking request.

## RBAC foundation

| Actor | Prepared appointment permissions |
| --- | --- |
| Admin | All initial actions across appointments; future branch, specialty, doctor, cash collection and dashboard management. |
| Doctor | View, confirm, complete and mark no-show only when the doctor profile's userId matches authenticated identity. Cancellation/rescheduling is denied initially. |
| Customer | View, cancel and reschedule only their own appointments; future clinic policies further restrict cancellation/rescheduling. |
| Public | Future active branch/specialty/doctor browsing and availability; booking always requires customer authentication. |

`assertAppointmentPermission` takes database-derived ownership facts, including doctorUserId (an account ID, not the doctor profile ID). Role middleware alone cannot authorize individual resources. Dashboard and inbox services must apply the same ownership boundaries in database queries.

Public registration rejects role/isVerified/isBlocked, and the service whitelists inputs and forces customer. `Roles.USER` intentionally retains its legacy key while its value is customer, because unchanged migration 001 imports that key. Public constants expose exactly admin, doctor and customer.

## Localization and API conventions

Business text uses `LocalizedText`: `{ "ar": "الاسم", "en": "Name" }`, persisted in JSONB and returned with both languages. Required translated fields need two nonblank strings; optional translated fields may be omitted as a whole. Joi rejects unknown language keys. No selected-language projection is applied. Account names remain a single identity string, distinct from bilingual doctor profile names.

`Accept-Language` controls localized HTTP messages, with Arabic as the default. Both locale files expose the same keys. Existing response shapes are preserved. Future clinic successes use `{ status: "success", data: ... }`; new collection contracts use `items`, `page`, `limit`, `total`, and `totalPages` within data. Existing user filtering retains its `users` shape and empty-result 404 behavior.

Future list endpoints should validate pagination (page 1, limit 10, maximum 100), allowlisted sort fields and direction, and domain-specific filters. Services must apply defaults explicitly: validateRequest merges body, path and query and does not write Joi's normalized output back to requests. Existing user text filters now use PostgreSQL ILIKE.

### Future route map — not mounted

| Area | Proposed routes | Authorization |
| --- | --- | --- |
| Browsing | GET /api/v1/branches, /specialties, /doctors, /doctors/:id, /doctors/:id/availability | Public active content |
| Booking/history | POST/GET /api/v1/appointments; GET /appointments/:id; PATCH /appointments/:id/cancel or /reschedule | Customer ownership; services derive customer and snapshots |
| Doctor work | GET /api/v1/doctor/appointments, /doctor/schedule; PATCH /doctor/appointments/:id/status | Doctor ownership and allowed actions |
| Admin catalog | CRUD /api/v1/admin/branches, /admin/specialties, /admin/doctors | Admin; doctor provisioning combines account/profile atomically |
| Admin schedules | /api/v1/admin/doctors/:id/schedules and /schedule-exceptions | Admin |
| Admin appointments | GET /api/v1/admin/appointments; PATCH /admin/appointments/:id/status | Admin |
| Cash collection | PATCH /api/v1/admin/appointments/:id/payment | Admin; explicit audit identity/time |
| Inbox | GET /api/v1/notifications; PATCH /notifications/:id/read | Authenticated recipient ownership |
| Dashboards | GET /api/v1/admin/dashboard and /doctor/dashboard | Role; doctor query scope derived from identity |

Existing auth, user, media, constants, metadata and health routes remain documented in README. This route map is guidance for later features, not an API implementation or generated OpenAPI specification.

## Scheduling, payments, and inbox boundaries

Schedules store branch-local weekdays/times; exceptions store local dates. Appointments store UTC instants and the booked IANA timezone. Future slot generation must handle daylight-saving gaps/ambiguities, schedule exceptions, appointment duration, active state, cancellations and rescheduling. Database-backed concurrency control and atomic transactions must prevent overlapping bookings before the booking endpoint is introduced. Current indexes and checks do not prevent double booking.

The initial method is cash at clinic. Future admin services will mark cash received and maintain payment totals independently of appointment status. Multiple records per appointment allow later payment history; overpayment, refunds, idempotency and allocation rules are not implemented. Manual methods can later add verification/reference/proof metadata through additive migrations. Public media must not be used for sensitive proof or clinical records.

Notifications have inbox persistence only. Intended event types include appointment.booked, appointment.confirmed, appointment.cancelled, appointment.rescheduled and appointment.reminder. No event publisher, inbox route, worker, background scheduler or external delivery provider exists. Dashboard types express planned counts and decimal totals, without query implementations.

## Migrations and verification

Migration 001 is unchanged. Because it imports current Roles, fresh databases begin with clinic values; migration 002 also handles older installations whose enum still contains generic roles. Migration 002 locks account writes while checking/replacing roles, maps user → customer, retains admins and doctors, rejects unrelated legacy account roles atomically, widens refreshToken to TEXT, and removes fcmToken. TEXT is needed because issued JWTs exceed the inherited VARCHAR(255) limit.

Migration 003 transactionally creates clinic tables and the bilingual cash method. No runtime synchronization or seed is needed for those definitions. Both new migrations are registered in order. The existing migration runner records applied names separately from each migration transaction; deployment orchestration must avoid concurrent migration runners.

Rollback of 003 deletes all clinic domain tables/data. Rollback of 002 refuses doctor accounts and refresh tokens too large for VARCHAR(255); it restores customers to user, narrows token storage, and recreates an empty nullable FCM column. Removed FCM values cannot be recovered by rollback. Resolve account roles/revoke incompatible sessions explicitly in an intended environment. Do not roll back shared data as a setup check.

Verification commands: npm run lint, npm run build, npm test, npm run test:integration, docker compose config --quiet, and docker compose -f docker-compose.prod.yml config --quiet. The integration command owns a disposable, loopback-only PostgreSQL 16 container and removes it afterward; it never uses the local configured database or runs seed. Tests exercise fresh migration registry/idempotency, legacy conversion/rejection, rollback guards, JSONB/decimal persistence, historical snapshots, metadata/health, registration/login/profile, blocked users, refresh rotation and revoked sessions. Unit tests cover validation, roles, ownership and serialization.

Provider-backed Google OAuth, a complete production image deployment, and unimplemented clinic workflows are not verified by these checks. Local verification results are recorded in the implementation handoff; dependency advisories remain for a separate compatibility review.

## Incremental implementation roadmap

1. Add admin branch/specialty CRUD and public active browsing, using bilingual validators and explicit pagination/filter defaults.
2. Add transactional doctor account/profile provisioning, branch assignment, specialty and price management; verify role/profile consistency.
3. Add schedule and exception management with timezone rules and conflict validation.
4. Implement availability and atomic booking, including database-backed double-booking protection and booked snapshots.
5. Implement appointment actions and policy-based cancellation/rescheduling with ownership checks and audit history.
6. Add cash collection, independent payment state and currency-aware totals.
7. Add inbox event creation and recipient-scoped list/read endpoints; reminders remain a later scheduling feature.
8. Implement admin/doctor dashboard queries with date and branch filters, currency grouping and doctor ownership scope.

## Verified handoff (2026-10-22)

- Clean npm ci completed; the retained Google verifier dependency is explicit in the lockfile. npm reported 71 dependency advisories (2 low, 10 moderate, 58 high, 1 critical); no broad dependency upgrades were applied.
- npm run lint and npm run build passed. npm test passed eight unit tests.
- npm run test:integration passed six PostgreSQL/HTTP scenarios (seven runner tests including the parent), including guarded rollback for oversized refresh tokens. Its container was removed afterward; no configured application database or seed was used.
- Both Compose configuration checks passed with the existing obsolete-version warning. Root documentation links were checked against local files.
- Host checks used Node 24.19.0 and PostgreSQL 16 Alpine; the Docker Node 20 production image was not built or deployed. Provider-backed Google authentication remains unverified.

## Migration history recovery

A database recorded with an earlier schema lineage (for example 002-add-clinic-roles and 003-clinic-domain) can contain incompatible columns such as dayOfWeek and separate appointment date/time fields. Migration 003 cannot safely reuse those tables. The runner now rejects unregistered names before up/down changes. Use npm run migrate:status for read-only diagnosis; it also works without creating SequelizeMeta on a fresh database. Use a new empty database or prepare an explicit compatibility migration. Never remove bookkeeping, rename one column blindly, or roll back existing data to force installation. Historical migration files remain unchanged. Source CLI commands use node --import tsx to avoid ts-node loader warnings.

Follow-up verification: lint, build, ten unit tests, seven isolated PostgreSQL/HTTP scenarios (eight runner tests including their parent), and both Compose checks passed. Compiled API startup, metadata and database health also passed against the newly initialized local database. Existing database contents and historical migration files were preserved.
