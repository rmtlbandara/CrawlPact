-- SRS §28.14 "security-event resolution" (Part 3 Step 10): lets a Super
-- Admin mark a security event as reviewed, with who/when/why, so the
-- security dashboard can distinguish "needs attention" from "already
-- investigated" without deleting or mutating the original event record.
ALTER TABLE security_events ADD COLUMN resolved_at TEXT;
ALTER TABLE security_events ADD COLUMN resolved_by_user_id TEXT REFERENCES users (id);
ALTER TABLE security_events ADD COLUMN resolution_note TEXT;
