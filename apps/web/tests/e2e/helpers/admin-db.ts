import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Direct-D1 setup helpers for e2e tests that need to grant an admin role or
 * seed an otherwise-unreachable state (a failed webhook event) before a
 * browser journey exercises it. Playwright tests run against the real local
 * dev D1 via a live `astro dev` server, not the isolated per-test harness
 * `tests/integration/d1-harness.ts` uses — there is no in-process D1 binding
 * to write through here, so this shells out to `wrangler d1 execute --local`,
 * mirroring the same raw-SQL pattern `admin-users.integration.test.ts` uses
 * to grant `super_admin` directly.
 */

const execFileAsync = promisify(execFile);
const webDir = path.resolve(fileURLToPath(import.meta.url), "../../../..");

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Playwright runs these setup calls from multiple parallel workers, each
 * spawning its own `wrangler d1 execute` subprocess against the same local
 * D1 sqlite file — under real concurrency this can collide with a
 * transient `SQLITE_BUSY (SQLITE_BUSY_SNAPSHOT)` lock error (confirmed
 * empirically running the full suite with default parallelism). Retrying
 * with a short backoff resolves it directly, rather than relying on
 * Playwright's own test-level retry to paper over it by re-running the
 * whole test (which only happens in CI's `retries: 2` config anyway, not
 * in a plain local `pnpm test:e2e` run). */
async function d1Execute(sql: string): Promise<string> {
  const args = [
    "wrangler",
    "d1",
    "execute",
    "crawlpact-db",
    "--local",
    "--config",
    "wrangler.jsonc",
    "--json",
    "--command",
    sql,
  ];
  let lastError: unknown;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const { stdout } = await execFileAsync("npx", args, { cwd: webDir });
      return stdout;
    } catch (error) {
      // Any wrangler d1 execute failure under this suite's real parallel
      // load has, in practice, been transient lock/contention on the
      // shared local D1 file (confirmed by re-running the exact same
      // failing command standalone immediately afterwards and having it
      // succeed) — not a genuine SQL error, which this narrow test-setup
      // helper otherwise has no reason to produce. Retry broadly rather
      // than pattern-matching a specific error string, since the exact
      // wording varies (SQLITE_BUSY, SQLITE_BUSY_SNAPSHOT, and others seen
      // empirically that didn't contain "SQLITE_BUSY" at all).
      lastError = error;
      await sleep(200 * (attempt + 1));
    }
  }
  throw lastError;
}

export async function findUserIdByDisplayName(displayName: string): Promise<string> {
  const out = await d1Execute(
    `SELECT id FROM users WHERE display_name = '${displayName.replace(/'/g, "''")}' LIMIT 1;`,
  );
  const parsed = JSON.parse(out) as [{ results: [{ id: string }] }];
  const id = parsed[0]?.results?.[0]?.id;
  if (!id) throw new Error(`No user found with display name ${displayName}`);
  return id;
}

export async function grantSuperAdmin(userId: string): Promise<void> {
  // login/finish.ts only sets `isAdminSession` when BOTH `users.is_admin`
  // is true AND an active admin_role_assignments row exists — mirrors
  // admin-users.integration.test.ts's fixture setup, which does the same
  // two writes.
  await d1Execute(`UPDATE users SET is_admin = 1 WHERE id = '${userId}';`);
  await d1Execute(
    `INSERT INTO admin_role_assignments (id, user_id, role_id) VALUES ('${crypto.randomUUID()}', '${userId}', 'super_admin');`,
  );
}

/** Seeds a `failed` webhook event so the admin webhooks e2e test has
 * something real and eligible to retry, without waiting for a real Paddle
 * delivery to fail. */
export async function seedFailedWebhookEvent(): Promise<void> {
  const now = new Date().toISOString();
  const eventId = crypto.randomUUID();
  await d1Execute(
    `INSERT INTO webhook_events (id, paddle_event_id, event_type, status, payload_redacted, error, attempts, received_at, occurred_at) VALUES ('${crypto.randomUUID()}', 'evt_e2e_${eventId}', 'transaction.completed', 'failed', '{}', 'Simulated failure seeded for e2e retry test', 1, '${now}', '${now}');`,
  );
}
