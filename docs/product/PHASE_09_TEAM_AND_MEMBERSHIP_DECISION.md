# Phase 09 — Team Roles and Invitation Decision Gate

## Question

Does CrawlPact's authoritative SRS or requirements traceability authorise team member accounts,
roles (owner/admin/analyst/viewer), invitations, or account switching?

## Findings (quoted from the SRS)

- `docs/product/CRAWLPACT_FINAL_SRS.md` §7 "User Roles" defines only **plan-tier** roles —
  Anonymous Visitor, Free Registered User, Solo Subscriber, Pro Subscriber, Agency Subscriber,
  Super Admin. These describe one account's plan level, not a permission hierarchy within an
  account.
- SRS §28.18 "Administrative Roles" concerns only **internal Super Admin** sub-roles (Super Admin,
  Billing Viewer, Support Viewer, Security Administrator) — explicitly scoped to internal staff,
  not customer accounts, and even there: "The initial release may use only the Super Admin role."
- **SRS §38 "Future Scope," under "Only after paid-market validation, consider":**

  > "- Team member accounts"
  > "- Advanced administrator roles"

  This is the only mention of team accounts anywhere in the SRS, and it explicitly places the
  concept in deferred future scope, not current authorised requirements.

- `docs/status/REQUIREMENTS_TRACEABILITY.md` §38 row: "Future scope ... not-applicable ...
  Explicitly out of scope per SRS."
- No ADR in `docs/architecture/adr/README.md` addresses tenancy, workspaces, or multi-user teams.

## Checklist against the prompt's own preconditions

| Precondition                                       | Status                                            |
| -------------------------------------------------- | ------------------------------------------------- |
| Roles authorised by the SRS or requirements        | **No** — explicitly deferred (§38)                |
| Member limits defined                              | Not defined                                       |
| Billing treatment defined                          | Not defined                                       |
| Account ownership transfer defined                 | Not defined                                       |
| Invitation delivery available                      | No email-invitation infrastructure exists         |
| Invitation expiry defined                          | Not defined                                       |
| Role-change authority defined                      | Not defined                                       |
| Member removal defined                             | Not defined                                       |
| Audit logging for membership changes defined       | Not defined                                       |
| Data access after removal defined                  | Not defined                                       |
| No third-party email service required unexpectedly | Unverified — moot, since nothing above is defined |

Zero of the ten preconditions are met.

## Decision

**Do not implement team roles, invitations, workspace membership, or account switching in Phase 9.** This is a hard "requirements incomplete" case per the prompt's own gate, not a close call.

Concretely, this phase adds none of:

- An "Invite team member" button or form
- A members/roles list
- Owner/admin/analyst/viewer role selection anywhere
- An account switcher
- Ownership-transfer UI

The single-owner agency workspace (see `PHASE_09_WORKSPACE_MODEL_DECISION.md`) is the complete
scope for this phase's "workspace" concept.

## Re-evaluation trigger

Revisit only when a future SRS revision moves "Team member accounts" out of §38 Future Scope into
an authorised, numbered requirement with member limits, billing treatment, and the other nine
preconditions above defined. At that point, implement roles "only through a separate, explicit
substage" per the prompt's own instruction — not retrofitted into this phase's workspace views.
