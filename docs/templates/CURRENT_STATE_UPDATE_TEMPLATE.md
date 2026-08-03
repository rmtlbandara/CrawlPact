# Current-State Update Checklist

Use this checklist whenever `docs/status/CURRENT_STATE.md` needs updating (a feature is
enabled/disabled, a deployment changes capability status, a migration is applied, registry/
pricing/analytics/legal identity changes, a P0/P1 risk opens or closes).

**Metadata to update**: Last verified date, repository commit, production deployment identifier,
database migration version, crawler registry version, Phase baseline reference (if a new one
exists), next review date.

**Scope**: Which capability row(s) in the capability table are affected, and why.

**Evidence**: What was checked to confirm the new status — a production request, a database
query, a deployment log, a test run. Cite it.

**Verification**: The specific approved status value (`verified-live` etc.) this change results
in, and why that value (not a looser or stricter one) is correct.

**Risks**: Does this change open, close, or modify an entry in `docs/risks/ACTIVE_RISKS.md`?

**Tests**: Any test run to confirm the change (if applicable).

**Production impact**: Restate plainly what actually changed for real users.

**Rollback**: N/A for a documentation-only update, unless it accompanies a code/config change.

**Limitations**: Anything not verified as part of this specific update.

**Ownership**: The role responsible for this capability area.
