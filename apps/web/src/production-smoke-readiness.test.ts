import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { describe, expect, it } from "vitest";

/**
 * Regression guard for the Production Stage A smoke-readiness fix
 * (2026-09-14): `scripts/smoke-test.ts` has supported an optional third
 * `appBaseUrl` argument since Preview's own Stage A validation — when
 * present, it checks the apex→app redirect topology instead of the legacy
 * pre-cutover direct-200 `/sign-in` response. `package.json`'s
 * `smoke:production` script did not pass it, which would have made
 * `deploy-production.yml`'s final smoke step fail the instant Production's
 * apex actually starts redirecting (Stage A's own runtime behavior, already
 * live and tested — this is a deployment-gate config gap, not a routing
 * defect). Fixed by passing `https://app.crawlpact.com` as the third
 * argument, ahead of the real Production Stage A deployment.
 *
 * This file does not re-test Stage A's redirect/API-ownership behavior
 * itself (covered by `worker.host-boundary.test.ts`,
 * `legacy-redirect.test.ts`) or WebAuthn's still-dual-origin ceremony
 * pinning (covered, unmodified, by `auth/webauthn.test.ts` — Stage C would
 * break that suite's existing "succeeds ... at the public origin" case, so
 * a clean run of it is itself the Stage-C-not-introduced proof). It only
 * guards the specific config/workflow surface this fix touched.
 */
describe("smoke:preview / smoke:production — Stage A app-origin argument", () => {
  const packageJsonPath = fileURLToPath(new URL("../../../package.json", import.meta.url));
  const pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as {
    scripts: Record<string, string>;
  };

  it("smoke:preview passes both the public and app Preview origins", () => {
    expect(pkg.scripts["smoke:preview"]).toContain("https://preview.crawlpact.com");
    expect(pkg.scripts["smoke:preview"]).toContain("https://app.preview.crawlpact.com");
  });

  it("smoke:production passes both the public and app Production origins", () => {
    expect(pkg.scripts["smoke:production"]).toContain("https://crawlpact.com");
    expect(pkg.scripts["smoke:production"]).toContain("https://app.crawlpact.com");
  });

  it("smoke:production's apex URL is not itself the app origin (a real second argument, not a typo)", () => {
    const script = pkg.scripts["smoke:production"] ?? "";
    const args = script.split(/\s+/).filter((token) => token.startsWith("https://"));
    expect(args).toEqual(["https://crawlpact.com", "https://app.crawlpact.com"]);
  });
});

describe("deploy-production.yml — smoke step and safety guards unchanged", () => {
  const path = fileURLToPath(
    new URL("../../../.github/workflows/deploy-production.yml", import.meta.url),
  );
  const workflow = parseYaml(readFileSync(path, "utf-8")) as {
    on?: { workflow_dispatch?: { inputs?: Record<string, { required?: boolean }> } };
    concurrency?: { group?: string; ["cancel-in-progress"]?: boolean };
    jobs: { deploy: { steps: Array<{ name?: string; run?: string }> } };
  };

  it("still runs pnpm run smoke:production as its final live-verification step", () => {
    const smokeStep = workflow.jobs.deploy.steps.find((s) => s.run === "pnpm run smoke:production");
    expect(smokeStep).toBeDefined();
  });

  it("is still workflow_dispatch-only, with the typed confirmation and explicit commit_sha both still required (Section: 'no Production workflow trigger/safety guard changed')", () => {
    const inputs = workflow.on?.workflow_dispatch?.inputs;
    expect(inputs?.commit_sha?.required).toBe(true);
    expect(inputs?.confirm?.required).toBe(true);
  });

  it("still declares its own workflow-level concurrency, unchanged by the deploy-preview.yml fix", () => {
    expect(workflow.concurrency?.group).toBe("deploy-production");
    expect(workflow.concurrency?.["cancel-in-progress"]).toBe(false);
  });
});
