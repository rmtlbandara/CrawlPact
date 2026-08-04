// Read-only reconciliation: the DB-backed `plan_prices` catalog (packages/database) vs. the
// live Paddle catalog for the same environment. Never writes to Paddle or to D1 — see
// scripts/paddle-catalog-verify.ts's sibling `paddle:catalog:sync` (not yet built; any future
// write-capable command must be a separate, explicitly-gated script, never folded into this one)
// and docs/billing/PADDLE_CATALOG_RECONCILIATION_RUNBOOK.md for the full process this supports.
//
// Reads CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN (D1 REST read) and PADDLE_API_KEY (Paddle
// REST read) from the environment — never prints either credential, only price data that is
// already non-secret (see docs/billing/PADDLE_LIVE_CATALOG_MAP.md, which records the same IDs in
// plaintext in a committed doc).
//
// Run with:
//   node --experimental-strip-types scripts/paddle-catalog-verify.ts <preview|production>
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse as parseJsonc } from "jsonc-parser";

type Target = "preview" | "production";
type PaddleEnvironment = "sandbox" | "production";

type PlanPriceRow = {
  id: string;
  plan_id: string;
  environment: PaddleEnvironment;
  interval: "month" | "year";
  amount_usd_cents: number;
  paddle_product_id: string;
  paddle_price_id: string;
  active_for_new_checkout: number;
  legacy: number;
  archived_at: string | null;
};

type PaddlePrice = {
  id: string;
  product_id: string;
  status: "active" | "archived";
  unit_price: { amount: string; currency_code: string };
  billing_cycle: { interval: string; frequency: number } | null;
  trial_period: unknown | null;
};

type Status =
  | "matched"
  | "missing-in-paddle"
  | "missing-in-app"
  | "amount-mismatch"
  | "interval-mismatch"
  | "currency-mismatch"
  | "trial-mismatch"
  | "environment-mismatch"
  | "verification-blocked";

type Finding = {
  status: Status;
  planId: string;
  interval: string;
  paddlePriceId: string;
  detail: string;
  legacy: boolean;
};

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

function loadD1Target(target: Target): { databaseId: string; environment: PaddleEnvironment } {
  const raw = readFileSync(`${repoRoot}apps/web/wrangler.jsonc`, "utf-8");
  const config = parseJsonc(raw) as {
    d1_databases: { database_id: string }[];
    vars: { PADDLE_ENVIRONMENT: PaddleEnvironment };
    env: {
      preview: {
        d1_databases: { database_id: string }[];
        vars: { PADDLE_ENVIRONMENT: PaddleEnvironment };
      };
    };
  };
  function first(databases: { database_id: string }[]): string {
    const db = databases[0];
    if (!db) throw new Error("apps/web/wrangler.jsonc has no d1_databases configured.");
    return db.database_id;
  }

  if (target === "production") {
    return {
      databaseId: first(config.d1_databases),
      environment: config.vars.PADDLE_ENVIRONMENT,
    };
  }
  return {
    databaseId: first(config.env.preview.d1_databases),
    environment: config.env.preview.vars.PADDLE_ENVIRONMENT,
  };
}

async function queryD1(databaseId: string, sql: string): Promise<PlanPriceRow[]> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must both be set.");
  }
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sql }),
    },
  );
  const body = (await response.json()) as {
    success: boolean;
    errors: { code: number; message: string }[];
    result: { results: PlanPriceRow[] }[];
  };
  if (!response.ok || !body.success) {
    throw new Error(`Cloudflare D1 query failed: ${JSON.stringify(body.errors)}`);
  }
  return body.result[0]?.results ?? [];
}

function paddleApiBaseUrl(environment: PaddleEnvironment): string {
  return environment === "sandbox" ? "https://sandbox-api.paddle.com" : "https://api.paddle.com";
}

async function fetchAllPaddlePrices(environment: PaddleEnvironment): Promise<PaddlePrice[]> {
  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) throw new Error("PADDLE_API_KEY must be set (matching the target environment).");

  const prices: PaddlePrice[] = [];
  let after: string | null = null;
  do {
    const url = new URL(`${paddleApiBaseUrl(environment)}/prices`);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("include", "");
    if (after) url.searchParams.set("after", after);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
    const body = (await response.json()) as {
      data?: PaddlePrice[];
      meta?: { pagination?: { has_more: boolean; cursor: string | null } };
      error?: { detail: string };
    };
    if (!response.ok) {
      throw new Error(`Paddle API error: HTTP ${response.status} ${body.error?.detail ?? ""}`);
    }
    prices.push(...(body.data ?? []));
    after = body.meta?.pagination?.has_more ? body.meta.pagination.cursor : null;
  } while (after);
  return prices;
}

function compare(dbRows: PlanPriceRow[], paddlePrices: PaddlePrice[]): Finding[] {
  const findings: Finding[] = [];
  const paddleById = new Map(paddlePrices.map((p) => [p.id, p]));
  const seenPaddleIds = new Set<string>();

  const isPlaceholder = (id: string) => id.startsWith("pri_sandbox_placeholder_");

  for (const row of dbRows) {
    seenPaddleIds.add(row.paddle_price_id);
    const base = {
      planId: row.plan_id,
      interval: row.interval,
      paddlePriceId: row.paddle_price_id,
      legacy: Boolean(row.legacy),
    };

    if (isPlaceholder(row.paddle_price_id)) {
      findings.push({
        ...base,
        status: "verification-blocked",
        detail: "Placeholder ID (no real sandbox Paddle price created yet) — not verifiable.",
      });
      continue;
    }

    const live = paddleById.get(row.paddle_price_id);
    if (!live) {
      findings.push({
        ...base,
        status: "missing-in-paddle",
        detail: row.archived_at
          ? "Not found live, but locally archived — expected if Paddle-side deletion isn't possible; verify manually."
          : "plan_prices references a Paddle price ID that does not exist in the live catalog.",
      });
      continue;
    }

    if (live.product_id !== row.paddle_product_id) {
      findings.push({
        ...base,
        status: "environment-mismatch",
        detail: `Live price's product_id (${live.product_id}) does not match the DB's recorded product_id (${row.paddle_product_id}).`,
      });
      continue;
    }

    if (Number(live.unit_price.amount) !== row.amount_usd_cents) {
      findings.push({
        ...base,
        status: "amount-mismatch",
        detail: `Paddle amount ${live.unit_price.amount} cents vs. DB ${row.amount_usd_cents} cents.`,
      });
      continue;
    }

    if (live.unit_price.currency_code !== "USD") {
      findings.push({
        ...base,
        status: "currency-mismatch",
        detail: `Paddle currency ${live.unit_price.currency_code}, expected USD.`,
      });
      continue;
    }

    const expectedPaddleInterval = row.interval === "month" ? "month" : "year";
    if (live.billing_cycle?.interval !== expectedPaddleInterval) {
      findings.push({
        ...base,
        status: "interval-mismatch",
        detail: `Paddle billing_cycle.interval "${live.billing_cycle?.interval}" vs. DB "${row.interval}".`,
      });
      continue;
    }

    if (live.trial_period) {
      findings.push({
        ...base,
        status: "trial-mismatch",
        detail: "Live price has a trial_period configured — Phase 6 policy prohibits trials.",
      });
      continue;
    }

    findings.push({ ...base, status: "matched", detail: "OK" });
  }

  // Prices live in Paddle, under one of our known product IDs, with no corresponding DB row —
  // only meaningful for products this catalog actually owns (avoids false positives on unrelated
  // Paddle catalog entries, if any ever exist on the same account).
  const knownProductIds = new Set(dbRows.map((r) => r.paddle_product_id));
  for (const price of paddlePrices) {
    if (!knownProductIds.has(price.product_id)) continue;
    if (seenPaddleIds.has(price.id)) continue;
    findings.push({
      status: "missing-in-app",
      planId: "(unknown)",
      interval: price.billing_cycle?.interval ?? "(unknown)",
      paddlePriceId: price.id,
      detail: "Live Paddle price under a known product has no plan_prices row at all.",
      legacy: false,
    });
  }

  return findings;
}

function main(): void {
  void run();
}

async function run(): Promise<void> {
  const target = process.argv[2] as Target | undefined;
  if (!target || !(["preview", "production"] as Target[]).includes(target)) {
    console.error("Usage: paddle:catalog:verify <preview|production>");
    process.exit(1);
  }

  const { databaseId, environment } = loadD1Target(target);
  console.error(`Verifying ${target} (Paddle environment: ${environment})...`);

  let dbRows: PlanPriceRow[];
  let paddlePrices: PaddlePrice[];
  try {
    [dbRows, paddlePrices] = await Promise.all([
      queryD1(
        databaseId,
        `SELECT * FROM plan_prices WHERE environment = '${environment}' AND archived_at IS NULL`,
      ),
      fetchAllPaddlePrices(environment),
    ]);
  } catch (error) {
    console.error(`paddle:catalog:verify:${target}: FAILED to fetch — ${String(error)}`);
    process.exit(1);
    return;
  }

  const findings = compare(dbRows, paddlePrices);

  // Duplicate-paddle-price-id check — same rule as the Super Admin catalog view
  // (plan-catalog-status.ts's computeCatalogStatusFlags), re-derived here directly from this
  // run's own DB read so this command is self-contained and doesn't depend on the app being live.
  const seen = new Map<string, number>();
  for (const row of dbRows) seen.set(row.paddle_price_id, (seen.get(row.paddle_price_id) ?? 0) + 1);
  for (const [priceId, count] of seen) {
    if (count > 1) {
      console.error(`  DUPLICATE      ${priceId} appears in ${count} plan_prices rows`);
    }
  }

  const problems = findings.filter((f) => f.status !== "matched");
  for (const f of findings) {
    const tag = f.status.toUpperCase().padEnd(20);
    const legacyTag = f.legacy ? " [legacy]" : "";
    console.error(
      `  ${tag} ${f.planId}/${f.interval} ${f.paddlePriceId}${legacyTag} — ${f.detail}`,
    );
  }

  console.error(
    `\n${findings.length} row(s) checked, ${problems.length} problem(s) (${findings.length - problems.length} matched).`,
  );

  if (problems.some((f) => f.status !== "verification-blocked")) {
    process.exit(1);
  }
}

main();
