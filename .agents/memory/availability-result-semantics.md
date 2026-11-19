---
name: Availability result semantics
description: The user's results guide defines counts, group fit and closed-date interpretation.
---

Follow the user's uploaded “Availability results guide” when interpreting
scraper output. `available` means the whole group fits, potentially split
across rooms. It does not promise one room or dorm together.

No existing system's `beds_free` should be advertised as an exact total:
Foundation counts are lower bounds, legacy Bukly counts estimates, and
Südtirol/Dibona counts are yes/no sentinels equal to the queried group.
Calendar `closed` can mean closed season, not opened yet, or fully blocked;
do not equate it with sold out. One-night failures can hide minimum-stay rules.
Do not aggregate or compare displayed prices without validating their units.

**Why:** The user supplied this guide specifically to define how backend results
must be understood; precise-looking counts and booking failures can mislead.

**How to apply:** Use these meanings in checkers, status labels and exports.
Only show “X beds left” for a proven exact count; preserve count type and
uncertainty. The guide's proposed schema enhancements are not authorization
to migrate the production database.
