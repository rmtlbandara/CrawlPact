# Public Incident Communication Standard

**Level 2 document.** Phase 14 (§121-124). What a public incident update must say, and must never
say, across the three incident phases (open, update, resolution).

## Every public update must answer

1. **What is affected?** — the specific public component(s), by their canonical label (never an
   internal name/job/table).
2. **What is the user impact?** — plain language, e.g. "Sign-in is currently unavailable or
   degraded," not a technical description.
3. **What is CrawlPact doing?** — current mitigation state, without exposing method/mechanism if
   that would help an attacker (security incidents — see below).
4. **Is user action required?** — usually no; state clearly when it is.
5. **When will the next update occur, if known?** — do not promise a fixed interval (e.g. "every 15
   minutes") unless operational capacity genuinely supports it. Default:
   _"We will update this incident when material information is available."_

**Never speculate about root cause before it is confirmed.**

## Per-subsystem language (§116-120)

| Situation                                                          | Say                                                                                                 | Never say                                                                              |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Security incident                                                  | Customer-visible availability impact + any known customer action                                    | Exploit details, internal logs, attacker information, containment mechanism            |
| Data-integrity concern (possibly incorrect crawler-policy results) | "Audit results may be delayed or temporarily unavailable while CrawlPact verifies result accuracy." | Continue publishing results CrawlPact knows may be wrong                               |
| Billing incident                                                   | "Billing and checkout are experiencing an issue."                                                   | Paddle error codes                                                                     |
| Authentication incident                                            | "Sign-in is currently unavailable or degraded."                                                     | WebAuthn internals (RP ID, origin, credential detail)                                  |
| Monitoring incident                                                | Distinguish: audits still work manually / scheduled monitoring delayed / monitoring paused          | Implying the whole audit product is down because scheduled monitoring alone is delayed |

## Resolution copy

Must explain: service restored, the affected component, the resolution timestamp, and any
remaining user action. Must not disclose confidential technical detail (root cause internals belong
in the internal PIR, not the public update — see `POST_INCIDENT_REVIEW_TEMPLATE.md`).

## Post-incident public summary decision rule (§124)

A detailed public postmortem is **not** required for every incident. Publish one only when at least
one of the following is true:

- **Severity**: `major` or `critical`
- **Duration**: affected users for more than 1 hour
- **Data impact**: any suspected data-integrity or data-loss concern
- **Customer impact**: affected a customer-facing workflow customers actively depend on (not a
  purely cosmetic or internal-only issue)

Internal PIR (`POST_INCIDENT_REVIEW_TEMPLATE.md`) remains mandatory for every `major`/`critical`
incident regardless of whether a public summary is published.

## Sanitisation (§97, already enforced)

Admin-entered public incident text is untrusted content — no raw HTML, no unsanitised Markdown, a
length bound, escaped rendering, no `<script>`, no external tracking pixel. See
`docs/security/PHASE_14_OPERATIONS_AND_STATUS_THREAT_REVIEW.md` "incident stored XSS" for the
verification evidence.

## Support channels

Only the two already-approved contacts are ever referenced: `support@crawlpact.com`,
`info@crawlpact.com`. No new contact method is added by this phase, and no update ever mentions an
unavailable support channel.
