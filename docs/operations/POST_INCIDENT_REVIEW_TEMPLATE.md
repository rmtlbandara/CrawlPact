# Post-Incident Review Template

**Level 2 document.** Phase 14 (§54). Copy this template for every `major`/`critical` incident.
Reviews are blameless — focus on system design, missing controls, automation gaps, unclear
runbooks, and incorrect assumptions, never on individuals (§55).

```markdown
## Incident: <title>

- **Summary**: one paragraph, what happened.
- **Customer impact**: which public component(s), how many affected, for how long. No private
  customer detail (account IDs, domains, names) — aggregate/qualitative only.
- **Detection**: how was this first noticed? (operational alert, admin check, customer report,
  automated smoke test)
- **Timeline** (all timestamps UTC):
  - Detection time:
  - Confirmation time:
  - First mitigation:
  - Public status publication (if any):
  - Identified cause:
  - Recovery:
  - Resolution:
  - Follow-up:
- **Root cause**: the actual technical cause, confirmed, not speculated.
- **Contributing factors**: what made this possible or worse (design gap, missing check, unclear
  runbook, incorrect assumption).
- **What worked**: what part of detection/response/recovery worked as intended.
- **What failed**: what part didn't — a missing alert, a runbook that didn't match reality, a
  signal that existed but wasn't checked.
- **Corrective actions**: concrete fixes already made.
- **Preventive actions**: concrete fixes planned, each with an owner and a due date.
- **Risk updates**: does this open a new numbered risk in `docs/risks/ACTIVE_RISKS.md`, or close/
  update an existing one?
- **Public communication**: what was published, when, and whether a public postmortem was
  warranted per `PUBLIC_INCIDENT_COMMUNICATION_STANDARD.md`'s decision rule.
- **Owner**: who is accountable for the preventive actions above.
- **Due date**: when the preventive actions are expected to land.
```

**Never include secrets** (API keys, session tokens, credential material) in a PIR, even
internally — reference where the secret was rotated instead of pasting its value.
