# Repository Confidentiality Policy

**Level 1 document (Current authoritative).** Phase 13.

- The CrawlPact source repository (`rmtlbandara/CrawlPact`) is **private**. It is always to be
  treated as private, regardless of any single API read to the contrary — a prior session found a
  transient/erroneous "public" reading that did not reflect the repository's actual, intended
  configuration; see `docs/risks/ACTIVE_RISKS.md` RISK-027 for that history.
- Source code is proprietary. See root `package.json`'s `"license": "UNLICENSED"`.
- Internal documentation under `docs/` (the SRS, ADRs, risk register, phase reports, this policy)
  is not public product documentation. The public website's own pages — `/privacy`, `/methodology`,
  `/limitations`, `/security`, `/status`, `/changelog` — are the correct public-facing surfaces for
  anything a customer needs to know; internal docs are never linked to from customer-facing copy
  (enforced by `pnpm repo-privacy:validate`).
- Repository access does not grant redistribution rights to any of its contents.
- Secrets must never be stored in the repository, in any form, at any time — see
  `docs/security/CI_CD_SUPPLY_CHAIN_HARDENING.md` and `docs/security/DEPENDENCY_VULNERABILITY_POLICY.md`
  for the controls this depends on (SHA-pinned Actions, no secret echoed in workflow logs, secret
  scanning in CI).
- Public website content — the marketing site, SEO pages, crawler directory, free tools, trust
  pages — is intentionally, deliberately separate from repository privacy. See
  `docs/governance/PUBLIC_PRIVATE_INFORMATION_CLASSIFICATION.md` Class A: making these private
  "because the repository is private" would be a real regression, not a privacy improvement.

This is a factual statement of current policy, not a legal contract, and does not itself assert
any specific jurisdiction's confidentiality-law protections.
