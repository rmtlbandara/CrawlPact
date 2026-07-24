-- Stores the deterministic recommendation output alongside the scan that
-- produced it (SRS §21, Part 2 Step 10), so the report page can render the
-- exact diff/proposed-config that was generated at scan time without
-- re-running conflict detection at read time.
ALTER TABLE scans ADD COLUMN recommended_additions TEXT; -- JSON array of added robots.txt lines
