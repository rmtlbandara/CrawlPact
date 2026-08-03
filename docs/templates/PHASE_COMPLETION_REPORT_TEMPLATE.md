# Phase N Completion Report Template

**Metadata**: Phase number/name · Date · Branch · Starting commit · Ending commit · Author

**Scope**: What this phase covered, in one paragraph. Link the phase's entry in
`docs/roadmap/CRAWLPACT_IMPROVEMENT_IMPLEMENTATION_PLAN.md`.

**Evidence**: What was inspected before making changes (prior phase baselines, code, production
checks). Link every source.

**Verification**: What was actually run to confirm the work — commands, results, exit codes.
Never state a check passed without having run it this session.

**Risks**: New risks found (link to `docs/risks/ACTIVE_RISKS.md` entries), risks resolved (link to
`docs/risks/RISK_ARCHIVE.md` entries), risks routed to a future phase.

**Tests**: Every command executed, its result, duration, and any generated artifact. Distinguish
pre-existing failures (not this phase's fault) from newly introduced ones (must be fixed before
declaring the phase complete).

**Production impact**: State explicitly whether this phase changed product behaviour, database
schema, crawler-registry data, billing behaviour, pricing, infrastructure configuration, or
customer-facing workflow. Most governance/documentation phases should state "none."

**Rollback**: How this phase's changes can be reverted (usually: revert the pull request) and
whether any separate rollback (migration, deployment) is needed.

**Limitations**: What could not be verified and why (e.g. "not verified — required access was
unavailable").

**Ownership**: Which role(s) (per `docs/governance/DOCUMENTATION_GOVERNANCE.md`) are responsible
for follow-up on anything left open.
