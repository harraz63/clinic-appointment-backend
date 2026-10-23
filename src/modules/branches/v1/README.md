# Branches API

Branches store bilingual name, description, and address, plus contact details, timezone, and an active flag. Admins can create, list, read, update, and delete branches under `/api/v1/admin/branches`. Public clients can browse active branches at `/api/v1/branches`.

Lists accept case-insensitive `search` across Arabic and English names, `page` (default 1), and `limit` (default 10, maximum 100). Admin lists also accept `isActive`. Responses include `items`, `page`, `limit`, `total`, and `totalPages`. Deleting a branch referenced by a doctor or appointment deactivates it to preserve history; otherwise it is removed.

See [the clinic foundation](../../../../CLINIC_FOUNDATION.md) for relationships, access rules, and the remaining roadmap.
