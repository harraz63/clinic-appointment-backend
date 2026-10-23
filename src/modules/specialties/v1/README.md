# Specialties API

Specialties store bilingual names and descriptions with an active flag. Admins can create, list, read, update, and delete specialties under `/api/v1/admin/specialties`. Public clients can browse active specialties at `/api/v1/specialties`.

Lists accept case-insensitive `search` across Arabic and English names, `page` (default 1), and `limit` (default 10, maximum 100). Admin lists also accept `isActive`. Responses include `items`, `page`, `limit`, `total`, and `totalPages`. Deleting a specialty referenced by a doctor deactivates it to preserve history; otherwise it is removed.

See [the clinic foundation](../../../../CLINIC_FOUNDATION.md) for relationships, access rules, and the remaining roadmap.
