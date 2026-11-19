---
name: Airtable sync schema
description: Airtable field behavior verified for the hut availability mirror.
---

- Keep `Status` as single-line text, or precreate every select option before syncing. A data-records PAT could not add the missing `closed` option during upsert.
- Format Airtable date-time values as UTC ISO 8601 with milliseconds and a trailing `Z`; the previous offset form was rejected, while the normalized form was accepted.

**Why:** A real Airtable upsert exposed both schema constraints; the corrected table and timestamp format allowed the record to sync.

**How to apply:** When changing the Airtable field mapping, do not assume record-write permission allows schema edits. Keep the status field as text unless all select choices are configured in Airtable, and preserve the UTC timestamp format.
