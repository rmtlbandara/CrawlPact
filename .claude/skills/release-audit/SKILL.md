---
name: release-audit
description: Check docs/release/PRODUCTION_READINESS_CHECKLIST.md against actual repository state and report an honest, evidence-based status for each of the 46 SRS §36 criteria.
---

# Release Audit

Not a deploy step — a truth-telling exercise. Cross-checks the production readiness checklist
against what is actually in the repository right now.

## Steps

1. Open `docs/release/PRODUCTION_READINESS_CHECKLIST.md`.
2. For each of the 46 items, verify the current status claim against the actual code/tests —
   don't trust the document's last-written status if the code has since changed.
3. For any item claimed "done" or "yes," find the specific test or artifact that proves it.
   If none exists, downgrade the status and say so.
4. Cross-check `docs/status/IMPLEMENTATION_STATUS.md` and
   `docs/status/REQUIREMENTS_TRACEABILITY.md` for consistency — all three documents should
   agree about what's actually built.
5. Update the checklist file with corrected statuses in the same pass.

## Output

A short summary: how many of the 46 are Done / Partial / Not started, and the single most
important gap standing between the current state and production launch. Do not inflate the
count — an honest "3 of 46 fully done" is more useful than an optimistic overcount.
