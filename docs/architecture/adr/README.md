# Architecture Decision Records

This directory records material architectural decisions for CrawlPact, in line with
`docs/product/CRAWLPACT_FINAL_SRS.md` (the authoritative source of truth).

## Index

| ADR                                                  | Title                                  | Status   |
| ---------------------------------------------------- | -------------------------------------- | -------- |
| [ADR-0001](./ADR-0001-APPLICATION-ARCHITECTURE.md)   | Application architecture               | Accepted |
| [ADR-0002](./ADR-0002-DATABASE-ACCESS.md)            | Database access strategy               | Accepted |
| [ADR-0003](./ADR-0003-UI-COMPONENT-STRATEGY.md)      | UI component strategy                  | Accepted |
| [ADR-0004](./ADR-0004-AUTHENTICATION-STRATEGY.md)    | Authentication strategy                | Accepted |
| [ADR-0005](./ADR-0005-SCANNER-ISOLATION.md)          | Scanner isolation and SSRF containment | Accepted |
| [ADR-0006](./ADR-0006-CLOUDFLARE-STATIC-DELIVERY.md) | Cloudflare static delivery strategy    | Accepted |

## Process

1. A new ADR is proposed as `ADR-NNNN-TITLE.md` using the next sequential number.
2. It records context, the decision, alternatives considered, and consequences.
3. Once accepted, an ADR is not deleted. Superseding decisions are recorded as a new ADR
   that references the one it replaces, and the old ADR's status is updated to `Superseded`.
4. Any implementation that conflicts with an accepted ADR must either conform to the ADR
   or a new ADR must be written and accepted first. The SRS still outranks all ADRs; an ADR
   may not silently reduce an SRS requirement.
