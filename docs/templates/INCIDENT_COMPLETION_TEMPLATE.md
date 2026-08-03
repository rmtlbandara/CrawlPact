# Incident Completion Report Template

**Metadata**: Incident ID · Severity · Detected at (UTC) · Resolved at (UTC) · Author

**Scope**: What broke, for whom, and for how long — plain language, no minimization.

**Evidence**: How the incident was detected (alert, report, smoke test) and confirmed (logs,
production query, direct reproduction). Cite exact sources.

**Verification**: How the fix was confirmed to actually work — not just "deployed," but a real
check against production afterward.

**Risks**: Does this incident reveal a new risk that should be added to
`docs/risks/ACTIVE_RISKS.md`? Was an existing risk's severity or probability wrong in light of
this incident?

**Tests**: What test (if any) was added so this exact failure mode is caught automatically next
time. If none was added, say so and why.

**Production impact**: Concrete, quantified where possible (how many requests/users affected,
what data if any was at risk).

**Rollback**: What rollback path was available and whether it was used, or why a forward fix was
chosen instead.

**Limitations**: What remains uncertain about root cause, blast radius, or whether recurrence is
fully prevented.

**Ownership**: Operations owner, unless the root cause sits clearly in another domain (Security,
Billing, Engineering).
