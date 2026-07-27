// Post-deploy binding-drift check: compares the *actually deployed* Worker's
// vars/secrets/bindings against what apps/web/wrangler.jsonc says they
// should be for the given target. This exists specifically to catch the
// class of regression already seen once in this project — a deploy that
// updates wrangler.jsonc but, because of how it was built/deployed, never
// actually refreshes the live Worker's vars — and to make sure a
// `wrangler secret put` is never mistaken for a full deployment.
//
// Reads only CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID from the
// environment. Never prints a secret *value* — only whether an expected
// secret *name* is present as type secret_text on the live Worker.
//
// Run with:
//   node --experimental-strip-types scripts/verify-bindings.ts <preview|production>
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse as parseJsonc } from "jsonc-parser";

type Target = "preview" | "production";

type Binding =
  | { type: "plain_text"; name: string; text: string }
  | { type: "secret_text"; name: string }
  | { type: "d1"; name: string; id: string }
  | { type: "kv_namespace"; name: string; namespace_id: string }
  | { type: "assets"; name: string }
  | { type: string; name: string; [key: string]: unknown };

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

const SECRET_NAMES = ["PADDLE_API_KEY", "PADDLE_WEBHOOK_SECRET", "SESSION_SIGNING_SECRET"];

function loadExpected(target: Target): {
  scriptName: string;
  vars: Record<string, string>;
  d1DatabaseId: string;
  kvId: string;
} {
  const raw = readFileSync(`${repoRoot}apps/web/wrangler.jsonc`, "utf-8");
  const config = parseJsonc(raw) as {
    name: string;
    vars: Record<string, string>;
    d1_databases: { database_id: string }[];
    kv_namespaces: { id: string }[];
    env: {
      preview: {
        vars: Record<string, string>;
        d1_databases: { database_id: string }[];
        kv_namespaces: { id: string }[];
      };
    };
  };
  function first<T>(items: T[], what: string): T {
    const item = items[0];
    if (!item) throw new Error(`apps/web/wrangler.jsonc has no ${what} configured for ${target}`);
    return item;
  }

  if (target === "production") {
    return {
      scriptName: config.name,
      vars: config.vars,
      d1DatabaseId: first(config.d1_databases, "d1_databases").database_id,
      kvId: first(config.kv_namespaces, "kv_namespaces").id,
    };
  }
  return {
    scriptName: `${config.name}-preview`,
    vars: config.env.preview.vars,
    d1DatabaseId: first(config.env.preview.d1_databases, "env.preview.d1_databases").database_id,
    kvId: first(config.env.preview.kv_namespaces, "env.preview.kv_namespaces").id,
  };
}

async function fetchLiveBindings(scriptName: string): Promise<{ bindings: Binding[] }> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    throw new Error(
      "CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must both be set (narrowly-scoped Workers deploy credentials only).",
    );
  }
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${scriptName}/settings`,
    { headers: { Authorization: `Bearer ${apiToken}` } },
  );
  const body = (await response.json()) as {
    success: boolean;
    errors: { code: number; message: string }[];
    result: { bindings: Binding[] };
  };
  if (!response.ok || !body.success) {
    throw new Error(
      `Cloudflare API error fetching settings for "${scriptName}": ${JSON.stringify(body.errors)}`,
    );
  }
  return body.result;
}

function main(): void {
  void run();
}

async function run(): Promise<void> {
  const target = process.argv[2] as Target | undefined;
  if (!target || !(["preview", "production"] as Target[]).includes(target)) {
    console.error("Usage: deploy:verify-bindings <preview|production>");
    process.exit(1);
  }

  const expected = loadExpected(target);
  const failures: string[] = [];

  let live: { bindings: Binding[] };
  try {
    live = await fetchLiveBindings(expected.scriptName);
  } catch (error) {
    console.error(`deploy:verify-bindings:${target}: FAILED — ${String(error)}`);
    process.exit(1);
    return;
  }

  const byName = new Map(live.bindings.map((b) => [b.name, b]));

  for (const [key, expectedValue] of Object.entries(expected.vars)) {
    const live = byName.get(key);
    if (!live || live.type !== "plain_text") {
      failures.push(`${key}: expected a plain_text var but found ${live ? live.type : "nothing"}`);
    } else if ((live as { text: string }).text !== expectedValue) {
      failures.push(`${key}: deployed value does not match apps/web/wrangler.jsonc`);
    }
  }

  for (const key of SECRET_NAMES) {
    const live = byName.get(key);
    if (!live || live.type !== "secret_text") {
      failures.push(
        `${key}: expected a secret_text binding but found ${live ? live.type : "nothing"}`,
      );
    }
  }

  const d1 = byName.get("DB");
  if (!d1 || d1.type !== "d1" || (d1 as { id: string }).id !== expected.d1DatabaseId) {
    failures.push(`DB: expected d1 binding to database ${expected.d1DatabaseId}`);
  }

  const kv = byName.get("SESSION");
  if (
    !kv ||
    kv.type !== "kv_namespace" ||
    (kv as { namespace_id: string }).namespace_id !== expected.kvId
  ) {
    failures.push(`SESSION: expected kv_namespace binding to ${expected.kvId}`);
  }

  const assets = byName.get("ASSETS");
  if (!assets || assets.type !== "assets") {
    failures.push("ASSETS: expected an assets binding");
  }

  if (failures.length > 0) {
    console.error(
      `deploy:verify-bindings:${target}: FAILED — deployed Worker "${expected.scriptName}" drifted from apps/web/wrangler.jsonc:\n${failures.map((f) => `  - ${f}`).join("\n")}`,
    );
    process.exit(1);
  }

  console.error(
    `deploy:verify-bindings:${target}: OK — "${expected.scriptName}" bindings match apps/web/wrangler.jsonc (cron trigger presence is not yet covered by this check — see docs/status/KNOWN_RISKS.md).`,
  );
}

main();
