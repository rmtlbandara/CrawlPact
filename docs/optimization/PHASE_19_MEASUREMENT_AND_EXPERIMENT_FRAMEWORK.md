# Phase 19 Measurement and Experiment Framework

Status: current-authoritative, 2026-08-14.

## The operating loop (§5, unchanged)

Observe → Measure → Form hypothesis → Prioritise → Make smallest useful change → Test → Deploy →
Measure again → Keep/revise/revert → Document learning.

## Hypothesis template (required before any optimisation, §41)

```
Problem:
Evidence:
Hypothesis:
Primary metric:
Guardrail metric:
Expected direction:
Evaluation window:
Rollback condition:
```

Every entry in `PHASE_19_EXPERIMENT_AND_CHANGE_LOG.md` (created on first use — none exists yet,
since no optimisation has shipped this pass) must use this exact template.

## No experiment platform yet (§43-44)

No Optimizely/VWO/LaunchDarkly/third-party CRO tool is added. At current traffic (0 external
users), there is no meaningful sample size for statistical A/B testing regardless of tooling.
Low-traffic approach: qualitative evidence + sequential (not concurrent) change + before/after
directional measurement. Statistical significance is never claimed from a tiny sample (§44).

## Guardrails (apply to every optimisation, non-negotiable)

- **Security**: cross-account leak, auth weakness, billing inconsistency, SSRF regression, or
  private-data analytics leak → revert/fix immediately regardless of conversion impact (§141).
- **Reliability**: if monitoring or audit reliability regresses, pause the optimisation programme
  until corrected (§142).
- **Pricing**: no pricing/entitlement experiment without explicit owner authorization (§143).
- **Audit truth**: a conversion experiment never changes crawler results to look more alarming,
  inflates severity, misrepresents policy conflicts, or implies compliance guarantees (§138).
- **Registry truth**: SEO goals never influence crawler classification (§139).
- **Research integrity**: Observatory conclusions are never shaped to promote paid plans (§140).
- **Accessibility**: never traded for conversion (§82).
- **No dark patterns**: no fake urgency, misleading scarcity, hidden cancellation, confusing
  annual/monthly presentation, preselected paid choices, or forced signup before a useful audit
  result (§116).

## Avoiding confounded changes (§45)

Isolated changes preferred over simultaneous headline/result/pricing/CTA/onboarding changes —
concurrent changes make it impossible to attribute a measured effect to a specific cause.

## Release discipline (unchanged, §135-137)

branch → tests → PR → CI → preview → approval → exact-commit production deployment → smoke →
measurement. Production deployment remains explicit/manual (§136) — no automatic deploy-on-merge.
Every meaningful optimisation needs an obvious rollback path, especially for checkout,
authentication, audit results, monitoring, and pricing presentation (§137).
