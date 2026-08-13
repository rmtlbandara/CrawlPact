# Phase 17 Pilot Query and Index Audit

Status: current-authoritative. Real `EXPLAIN QUERY PLAN` output against a local D1 instance with
migration `0036_customer_pilot.sql` applied — not inferred.

## `pilot_participants` by cohort (`listPilotParticipants`)

```sql
EXPLAIN QUERY PLAN
SELECT * FROM pilot_participants WHERE pilot_cohort_id = 'x';
```

```
SEARCH pilot_participants USING INDEX idx_pilot_participants_cohort_id (pilot_cohort_id=?)
```

Indexed, bounded to one cohort — never a full table scan.

## `pilot_feedback` joined to `pilot_participants` by cohort (`listPilotFeedback`)

```sql
EXPLAIN QUERY PLAN
SELECT f.* FROM pilot_feedback f
JOIN pilot_participants p ON f.pilot_participant_id = p.id
WHERE p.pilot_cohort_id = 'x';
```

```
SEARCH f USING INDEX idx_pilot_feedback_participant_id (pilot_participant_id=?)
```

Indexed on the join column.

## Activation metric (`getPilotCohortMetrics`, domains)

```sql
EXPLAIN QUERY PLAN
SELECT count(distinct owner_user_id) FROM domains
WHERE owner_user_id IN ('x','y') AND last_scan_id IS NOT NULL AND deleted_at IS NULL;
```

```
SEARCH domains USING INDEX idx_domains_owner_monitoring (owner_user_id=?)
```

Reuses an existing index built for the Phase 13 product-analytics dashboard — no new index
required for this metric.

## Paid-conversion metric (`getPilotCohortMetrics`, subscriptions × billing_customers)

```sql
EXPLAIN QUERY PLAN
SELECT count(distinct bc.user_id) FROM subscriptions s
JOIN billing_customers bc ON s.billing_customer_id = bc.id
WHERE bc.user_id IN ('x','y') AND s.status IN ('active','trialing','past_due');
```

```
SEARCH bc USING INDEX sqlite_autoindex_billing_customers_2 (user_id=?)
SEARCH s USING INDEX idx_subscriptions_billing_customer_id (billing_customer_id=?)
```

Both sides of the join are indexed (an existing unique index on `billing_customers.user_id`, and
the existing `subscriptions.billing_customer_id` index) — no new index required.

## Conclusion

Every new pilot-analytics query is bounded to the requesting cohort's own participant `user_id`
set (via `inArray`) and hits a real index at every step — no query scans `domains`,
`subscriptions`, or `product_events` globally. No new index was required beyond the two created
directly on the new tables (`idx_pilot_participants_cohort_id`, `idx_pilot_participants_user_id`,
`idx_pilot_feedback_participant_id`, migration `0036`).
