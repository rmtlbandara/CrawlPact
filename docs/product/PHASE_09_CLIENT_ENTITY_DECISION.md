# Phase 09 — Client Entity Decision Gate

## Question

Is a first-class `clients` entity, distinct from `domain_groups`, necessary?

## Findings (quoted from the SRS)

- SRS §7.4 (Pro Subscriber): "Create **domain groups**."
- SRS §7.5 (Agency Subscriber): "Create **client groups**." / "Generate client-safe reports."
- SRS §29 "Agency Features": "Create client groups / Add client names / Batch-import domains /
  ... / Generate client-safe links / Export CSV / Add limited agency branding."
- SRS §8's plan-entitlement table has a single row, "Domain groups," covering both tiers — the
  SRS never defines "client group" as a schema-distinct entity from "domain group"; it is the
  Agency-tier vocabulary for the identical underlying capability. `docs/status/REQUIREMENTS_TRACEABILITY.md`
  §29's implementation note confirms this reading: both are implemented against the one
  `domain_groups` table.
- "Add client names" (§29) reads as a field-level capability (naming a group after a client), not
  a description of a separate client record with its own metadata, contacts, or lifecycle.
- No SRS text describes client contact records, client-specific billing, multiple groups per
  client, or a client portal.

## Checklist against the prompt's own preconditions for adding a client entity

| Precondition                                     | Status                                                                                                   |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| A stable client name independent of group labels | Not required — a group's own `name` already serves this (e.g. "Acme Corp")                               |
| Multiple groups per client                       | Not requested anywhere in the SRS                                                                        |
| Client-specific branding                         | Not requested — branding is account-level (Agency plan), not per-client (see `AGENCY_BRANDING_MODEL.md`) |
| Client-specific report organisation              | Already achievable via group filtering on the portfolio table/export                                     |
| Client metadata required for workflows           | None identified                                                                                          |
| Future client-portal linkage                     | Explicitly **not** authorised (§17, "No client portal")                                                  |

Zero of the six preconditions are met.

## Decision

**Do not create a `clients` table. Reuse `domain_groups` as the client-organisation primitive.**
The existing "Client group" label already shown in `DomainsManager.tsx` is the correct,
already-decided UI terminology — this phase keeps it and extends it consistently (portfolio table,
attention queue, change feed, export) rather than introducing a second, parallel vocabulary.

This directly satisfies the prompt's own preference: "Do not create both `clients` and
`domain_groups` when they represent the same concept" and its privacy-minimisation guidance (no
client entity means no client email/phone/address/billing fields are ever collected, by
construction — not by restraint that could later erode).

## Group-level "internal description or note" (§16)

The prompt permits an optional internal description/note on a group when justified. This phase
adds one narrow field — `domain_groups.description` (nullable, length-bounded, escaped on render,
never included in exports by default) — since §16 explicitly calls for it and it requires no new
entity, only one additive column. This is not a client-entity decision; it is a one-column
extension of the existing group table, documented in `DOMAIN_GROUP_MODEL.md`.

## Re-evaluation trigger

Revisit only if a future SRS revision explicitly requires client metadata a group's `name` +
optional `description` cannot represent (e.g. mandated client-level branding distinct from the
account-level Agency branding, or a genuine multi-group-per-client requirement).
