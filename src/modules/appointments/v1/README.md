# Appointments foundation

Appointment persistence captures customer, doctor, booked branch, UTC instants, timezone, duration, price and currency. Internal inputs are trusted service inputs, not public booking payloads. Ownership/action permissions are prepared; booking, transitions, cancellation policies and database-backed overlap prevention are unimplemented.

No HTTP routes are mounted for this module. See [the clinic foundation](../../../../CLINIC_FOUNDATION.md) for relationships, access rules, future routes, verification and roadmap.
