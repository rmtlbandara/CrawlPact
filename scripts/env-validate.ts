// Validates an environment's configuration against the canonical schema in
// packages/config/src/env.ts, so a misconfigured environment (a missing
// var, a leftover placeholder, a live Paddle credential outside
// production) fails clearly and locally, before anything is built or
// deployed. Never reads or prints a real secret *value* — local reads
// .dev.vars (your own file, never committed); preview/production read only
// the non-secret `vars` block already committed in apps/web/wrangler.jsonc,
// standing in a shape-only placeholder for the fields that are real
// Cloudflare Worker secrets (never committed, see deploy:verify-bindings
// for how those are checked instead — presence only, never value).
//
// Run directly with Node's TypeScript support:
//   node --experimental-strip-types scripts/env-validate.ts <local|preview|production>
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse as parseJsonc } from "jsonc-parser";
import { InvalidEnvironmentError, parseEnv } from "../packages/config/src/env.ts";

type Target = "local" | "preview" | "production";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

function loadDotEnv(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function loadWranglerVars(scope: "top" | "preview"): Record<string, string> {
  const raw = readFileSync(`${repoRoot}apps/web/wrangler.jsonc`, "utf-8");
  const config = parseJsonc(raw) as {
    vars?: Record<string, string>;
    env?: { preview?: { vars?: Record<string, string> } };
  };
  return (scope === "top" ? config.vars : config.env?.preview?.vars) ?? {};
}

// Cloudflare Worker secrets (PADDLE_API_KEY, PADDLE_WEBHOOK_SECRET,
// SESSION_SIGNING_SECRET) are never committed, so a static file-based check
// can't see their real values — these are shape-only stand-ins, deliberately
// not equal to any known placeholder, so BILLING_ENABLED=true's
// "reject placeholder values" refinement still exercises meaningfully for
// the fields that *are* committed (price IDs, client token) without a false
// failure on fields this script structurally cannot see.
function secretShapePlaceholders(): Record<string, string> {
  return {
    PADDLE_API_KEY: "cloudflare-worker-secret-not-checked-by-this-script",
    PADDLE_WEBHOOK_SECRET: "cloudflare-worker-secret-not-checked-by-this-script",
    SESSION_SIGNING_SECRET: "cloudflare-worker-secret-not-checked-by-this-script-min16",
  };
}

function main(): void {
  const target = process.argv[2] as Target | undefined;
  if (!target || !(["local", "preview", "production"] as Target[]).includes(target)) {
    console.error("Usage: env:validate <local|preview|production>");
    process.exit(1);
  }

  let record: Record<string, string>;
  let note: string;

  if (target === "local") {
    const devVarsPath = `${repoRoot}.dev.vars`;
    if (existsSync(devVarsPath)) {
      record = loadDotEnv(devVarsPath);
      note = "validated your local .dev.vars";
    } else {
      record = loadDotEnv(`${repoRoot}.env.example`);
      note =
        "no .dev.vars found — validated .env.example instead; run `cp .env.example .dev.vars` for a real check of your own setup";
    }
  } else if (target === "preview") {
    record = { ...secretShapePlaceholders(), ...loadWranglerVars("preview") };
    note =
      "validated the committed apps/web/wrangler.jsonc env.preview.vars (secret values live in Cloudflare Worker secrets and aren't checked here — see deploy:verify-bindings)";
  } else {
    record = { ...secretShapePlaceholders(), ...loadWranglerVars("top") };
    note =
      "validated the committed apps/web/wrangler.jsonc top-level vars (secret values live in Cloudflare Worker secrets and aren't checked here — see deploy:verify-bindings)";
  }

  try {
    parseEnv(record);
    console.error(`env:validate:${target}: OK — ${note}`);
  } catch (error) {
    if (error instanceof InvalidEnvironmentError) {
      console.error(`env:validate:${target}: FAILED — ${note}\n${error.message}`);
    } else {
      console.error(`env:validate:${target}: FAILED — ${note}\n${String(error)}`);
    }
    process.exit(1);
  }
}

main();
