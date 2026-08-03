# CrawlPact Documentation Portal

Start here if you're new to this repository's documentation. Every link below states its
purpose, audience, and whether it's authoritative for the current product or historical.

## Start here

| Document                                                                              | Purpose                                                         | Audience                  | Status                |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------- | --------------------- |
| [`docs/status/CURRENT_STATE.md`](status/CURRENT_STATE.md)                             | The shortest authoritative description of what's currently true | Everyone                  | current-authoritative |
| [`../README.md`](../README.md)                                                        | Repository entry point, quick start                             | Everyone                  | current-authoritative |
| [`docs/governance/DOCUMENTATION_INVENTORY.md`](governance/DOCUMENTATION_INVENTORY.md) | Full classification of every doc file                           | Documentation maintainers | current-authoritative |

## Current product state

- [`docs/status/CURRENT_STATE.md`](status/CURRENT_STATE.md) — capability table, environment
  status, version status, open risks
- [`docs/baseline/2026-08-03/`](baseline/2026-08-03/README.md) — the underlying Phase 0 evidence
  baseline (route inventory, capability matrix, infrastructure/billing/registry/analytics
  baselines, test evidence)
- [`CHANGELOG.md`](../CHANGELOG.md) — what changed, dated, newest first

## Product and requirements

| Document                                                                          | Purpose                                         | Audience    | Status                       |
| --------------------------------------------------------------------------------- | ----------------------------------------------- | ----------- | ---------------------------- |
| [`docs/product/CRAWLPACT_FINAL_SRS.md`](product/CRAWLPACT_FINAL_SRS.md)           | The authoritative specification                 | Everyone    | requirements (authoritative) |
| [`docs/product/PRODUCT_SCOPE.md`](product/PRODUCT_SCOPE.md)                       | Quick-reference scope summary                   | Product     | current-supporting           |
| [`docs/status/REQUIREMENTS_TRACEABILITY.md`](status/REQUIREMENTS_TRACEABILITY.md) | SRS requirement → code/test/production evidence | Engineering | current-authoritative        |

## Brand and messaging

| Document                                                                                                  | Purpose                                                   | Audience      | Status                |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------- | --------------------- |
| [`docs/brand/BRAND_POSITIONING_AND_MESSAGING_SYSTEM.md`](brand/BRAND_POSITIONING_AND_MESSAGING_SYSTEM.md) | Product/category definitions, audience hierarchy, tagline | Everyone      | current-authoritative |
| [`docs/brand/VOICE_AND_STYLE_GUIDE.md`](brand/VOICE_AND_STYLE_GUIDE.md)                                   | Voice traits, writing rules, evidence wording             | Everyone      | current-authoritative |
| [`docs/brand/PRODUCT_TERMINOLOGY_GLOSSARY.md`](brand/PRODUCT_TERMINOLOGY_GLOSSARY.md)                     | Canonical product-term definitions                        | Everyone      | current-authoritative |
| [`docs/brand/CLAIMS_AND_MESSAGING_GUIDE.md`](brand/CLAIMS_AND_MESSAGING_GUIDE.md)                         | Claim classification, prohibited claims, disclaimers      | Everyone      | current-authoritative |
| [`docs/brand/MESSAGING_SURFACE_INVENTORY.md`](brand/MESSAGING_SURFACE_INVENTORY.md)                       | Every public/authenticated/admin/technical copy surface   | Everyone      | current-authoritative |
| [`docs/brand/GITHUB_BRAND_METADATA_MANIFEST.md`](brand/GITHUB_BRAND_METADATA_MANIFEST.md)                 | GitHub repo description/topics to apply                   | Product owner | current-supporting    |

## Architecture

| Document                                                                                                                                                                                                                                                 | Purpose                             | Audience    | Status                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ----------- | --------------------- |
| [`docs/architecture/ARCHITECTURE.md`](architecture/ARCHITECTURE.md)                                                                                                                                                                                      | Canonical architecture summary      | Engineering | current-authoritative |
| [`docs/architecture/adr/README.md`](architecture/adr/README.md)                                                                                                                                                                                          | Architecture Decision Records index | Engineering | current-authoritative |
| [`docs/architecture/DATA_FLOW.md`](architecture/DATA_FLOW.md)                                                                                                                                                                                            | Request/scan data flow              | Engineering | current-supporting    |
| [`docs/architecture/SYSTEM_CONTEXT.md`](architecture/SYSTEM_CONTEXT.md)                                                                                                                                                                                  | External systems/actors             | Engineering | current-supporting    |
| [`docs/architecture/INCIDENT_TRACKING_SYSTEM_DESIGN.md`](architecture/INCIDENT_TRACKING_SYSTEM_DESIGN.md)                                                                                                                                                | Incident/status-page design         | Engineering | current-supporting    |
| [`docs/data/DATA_MODEL.md`](data/DATA_MODEL.md), [`docs/data/DATA_RETENTION.md`](data/DATA_RETENTION.md), [`docs/data/MIGRATION_POLICY.md`](data/MIGRATION_POLICY.md), [`docs/data/D1_R2_DATA_PLACEMENT_POLICY.md`](data/D1_R2_DATA_PLACEMENT_POLICY.md) | Database/storage design             | Engineering | current-authoritative |

## Development

| Document                                                                                                             | Purpose                                         | Audience            | Status                |
| -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------- | --------------------- |
| [`docs/deployment/LOCAL_DEVELOPMENT.md`](deployment/LOCAL_DEVELOPMENT.md)                                            | Local setup                                     | Engineering         | current-supporting    |
| [`docs/design/DESIGN_SYSTEM.md`](design/DESIGN_SYSTEM.md), [`docs/design/UI_COMPONENTS.md`](design/UI_COMPONENTS.md) | Design tokens/components                        | Engineering, Design | current-authoritative |
| [`docs/agents/`](agents/)                                                                                            | AI-agent workflow, Claude Code / Codex guidance | AI agents           | current-supporting    |
| [`docs/api/API_CONTRACTS.md`](api/API_CONTRACTS.md), [`docs/api/ERROR_CATALOGUE.md`](api/ERROR_CATALOGUE.md)         | API conventions and error codes                 | Engineering         | current-authoritative |

## Testing

| Document                                                                            | Purpose                       | Audience            | Status                |
| ----------------------------------------------------------------------------------- | ----------------------------- | ------------------- | --------------------- |
| [`docs/testing/TEST_STRATEGY.md`](testing/TEST_STRATEGY.md)                         | Test layer breakdown, CI gate | Engineering         | current-authoritative |
| [`docs/testing/TEST_DATA_POLICY.md`](testing/TEST_DATA_POLICY.md)                   | No-fabricated-data rule       | Engineering         | current-authoritative |
| [`docs/testing/VISUAL_QA_MATRIX.md`](testing/VISUAL_QA_MATRIX.md)                   | Manual + automated visual QA  | Engineering, Design | current-authoritative |
| [`docs/design/ACCESSIBILITY_REQUIREMENTS.md`](design/ACCESSIBILITY_REQUIREMENTS.md) | WCAG 2.2 AA mapping           | Engineering         | current-authoritative |

## Deployment and operations

| Document                                                                                                                                                                                                                                                                | Purpose                         | Audience             | Status                |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | -------------------- | --------------------- |
| [`docs/deployment/DEPLOYMENT.md`](deployment/DEPLOYMENT.md)                                                                                                                                                                                                             | Deploy mechanism, preconditions | Operations           | current-authoritative |
| [`docs/deployment/ENVIRONMENTS.md`](deployment/ENVIRONMENTS.md)                                                                                                                                                                                                         | Environment variable precedence | Operations           | current-supporting    |
| [`docs/deployment/CLOUDFLARE_CONFIGURATION.md`](deployment/CLOUDFLARE_CONFIGURATION.md)                                                                                                                                                                                 | Bindings, secrets, DNS/SSL      | Operations           | current-authoritative |
| [`docs/operations/RUNBOOK.md`](operations/RUNBOOK.md)                                                                                                                                                                                                                   | Operational procedures          | Operations           | current-authoritative |
| [`docs/release/ROLLBACK_RUNBOOK.md`](release/ROLLBACK_RUNBOOK.md)                                                                                                                                                                                                       | Rollback procedures             | Operations           | current-authoritative |
| [`docs/operations/INCIDENT_RESPONSE.md`](operations/INCIDENT_RESPONSE.md)                                                                                                                                                                                               | Incident severity/response      | Operations, Security | current-authoritative |
| [`docs/operations/SCAN_CAPACITY_BUDGET.md`](operations/SCAN_CAPACITY_BUDGET.md), [`docs/operations/MONITORING_CAPACITY_PLAN.md`](operations/MONITORING_CAPACITY_PLAN.md), [`docs/operations/CLOUDFLARE_UPGRADE_TRIGGERS.md`](operations/CLOUDFLARE_UPGRADE_TRIGGERS.md) | Capacity planning               | Operations           | current-authoritative |

## Security and trust

| Document                                                                                                                                                                                                                                                                                       | Purpose                                      | Audience       | Status                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | -------------- | --------------------- |
| [`docs/security/SECURITY_CHECKLIST.md`](security/SECURITY_CHECKLIST.md)                                                                                                                                                                                                                        | SRS §33 control status                       | Security       | current-authoritative |
| [`docs/security/THREAT_MODEL.md`](security/THREAT_MODEL.md), [`docs/security/SSRF_SECURITY_MODEL.md`](security/SSRF_SECURITY_MODEL.md), [`docs/security/AUTHENTICATION_SECURITY.md`](security/AUTHENTICATION_SECURITY.md), [`docs/security/BILLING_SECURITY.md`](security/BILLING_SECURITY.md) | Domain-specific security detail              | Security       | current-authoritative |
| [`docs/release/LEGAL_INFORMATION_CHECKLIST.md`](release/LEGAL_INFORMATION_CHECKLIST.md)                                                                                                                                                                                                        | Legal-entity/jurisdiction disclosure tracker | Legal/business | current-supporting    |

## Billing

| Document                                                                                                          | Purpose                       | Audience          | Status                |
| ----------------------------------------------------------------------------------------------------------------- | ----------------------------- | ----------------- | --------------------- |
| [`docs/deployment/PADDLE_LIVE_CONFIGURATION.md`](deployment/PADDLE_LIVE_CONFIGURATION.md)                         | Live Paddle catalog reference | Billing           | current-authoritative |
| [`docs/deployment/PADDLE_LIVE_GO_LIVE_CHECKLIST.md`](deployment/PADDLE_LIVE_GO_LIVE_CHECKLIST.md)                 | Go-live checklist             | Billing           | current-authoritative |
| [`docs/status/PADDLE_WEBHOOK_LIVE_DELIVERY_VERIFICATION.md`](status/PADDLE_WEBHOOK_LIVE_DELIVERY_VERIFICATION.md) | Real webhook-delivery proof   | Billing, Security | evidence              |

## Crawler registry

| Document                                                                                  | Purpose                                          | Audience | Status                |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------ | -------- | --------------------- |
| [`docs/registry/CRAWLER_REGISTRY_GOVERNANCE.md`](registry/CRAWLER_REGISTRY_GOVERNANCE.md) | Publication rules, immutability, current content | Registry | current-authoritative |
| [`docs/registry/SOURCE_VERIFICATION_POLICY.md`](registry/SOURCE_VERIFICATION_POLICY.md)   | Standard for citing operator documentation       | Registry | current-authoritative |

## Risks

| Document                                              | Purpose                                      | Audience | Status                |
| ----------------------------------------------------- | -------------------------------------------- | -------- | --------------------- |
| [`docs/risks/ACTIVE_RISKS.md`](risks/ACTIVE_RISKS.md) | Current open risks                           | Everyone | current-authoritative |
| [`docs/risks/RISK_ARCHIVE.md`](risks/RISK_ARCHIVE.md) | Resolved/superseded risks                    | Everyone | historical (index)    |
| [`docs/status/KNOWN_RISKS.md`](status/KNOWN_RISKS.md) | Full historical risk-investigation narrative | Everyone | historical            |

## Roadmap and phases

| Document                                                                                                            | Purpose                                  | Audience      | Status                |
| ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------- | --------------------- |
| [`docs/roadmap/CRAWLPACT_IMPROVEMENT_IMPLEMENTATION_PLAN.md`](roadmap/CRAWLPACT_IMPROVEMENT_IMPLEMENTATION_PLAN.md) | Master 20-phase roadmap, release gates   | Everyone      | current-authoritative |
| [`docs/governance/GITHUB_GOVERNANCE_SETUP_MANIFEST.md`](governance/GITHUB_GOVERNANCE_SETUP_MANIFEST.md)             | GitHub milestones/labels/issues to apply | Product owner | current-supporting    |

## Completion reports

| Document                                                                                                                                          | Purpose                   | Audience | Status   |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | -------- | -------- |
| [`docs/baseline/2026-08-03/PHASE_0_BASELINE_REPORT.md`](baseline/2026-08-03/PHASE_0_BASELINE_REPORT.md)                                           | Phase 0 completion report | Everyone | evidence |
| [`docs/reports/PHASE_01_DOCUMENTATION_SOURCE_OF_TRUTH_COMPLETION_REPORT.md`](reports/PHASE_01_DOCUMENTATION_SOURCE_OF_TRUTH_COMPLETION_REPORT.md) | Phase 1 completion report | Everyone | evidence |

## Historical archive

[`docs/archive/README.md`](archive/README.md) — superseded implementation-status logs, "Final"
audit/compliance/readiness reports, and completed-workstream reports. Not authoritative for the
current product; each file states its own original date, archive date, and replacement.

## Governance

- [`docs/governance/DOCUMENTATION_GOVERNANCE.md`](governance/DOCUMENTATION_GOVERNANCE.md) —
  ownership, review cadence, update triggers
- [`docs/governance/DOCUMENTATION_INVENTORY.md`](governance/DOCUMENTATION_INVENTORY.md) — full
  per-file classification
- [`docs/templates/`](templates/) — templates for future phase/deployment/risk/incident records
