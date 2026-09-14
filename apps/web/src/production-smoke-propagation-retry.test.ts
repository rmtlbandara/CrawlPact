import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { describe, expect, it } from "vitest";

/**
 * Regression guard for the Production smoke propagation-race hardening
 * (2026-09-14, Master Finalization Directive Phase 3.1). A real Stage-A
 * deployment (run 34835290020) proved that `deploy-production.yml`'s smoke
 * step, run immediately after `wrangler deploy` returns, can observe stale
 * pre-deploy Worker behavior for a few seconds due to ordinary Cloudflare
 * edge-propagation lag — not a routing defect (independently confirmed: an
 * identical smoke re-run ~18 minutes later, no redeploy in between, passed
 * 43/43). Fixed with `scripts/smoke-retry.sh`, a bounded, propagation-aware
 * retry wrapper around the existing `pnpm run smoke:production` command —
 * it never redeploys, never weakens an assertion, and a genuinely persistent
 * failure still fails the workflow exactly as before.
 *
 * This file proves two things: (1) the retry script's actual runtime
 * behavior — bounded attempts, early success, persistent-failure
 * propagation — by executing the real script against fixture commands, not
 * merely reading its source; and (2) `deploy-production.yml`'s structure:
 * every pre-existing safety guard (workflow_dispatch-only, typed
 * confirmation, exact SHA, exact-main membership, exact-commit CI check,
 * non-cancelling concurrency, a single deploy step, evidence upload) is
 * unchanged, and the smoke step now runs through the retry wrapper.
 */
const scriptPath = fileURLToPath(new URL("../../../scripts/smoke-retry.sh", import.meta.url));

function makeFixtureScript(dir: string, name: string, body: string): string {
  const path = join(dir, name);
  writeFileSync(path, `#!/usr/bin/env bash\n${body}\n`);
  chmodSync(path, 0o755);
  return path;
}

describe("scripts/smoke-retry.sh — real behavior (executed, not just read)", () => {
  const fastEnv = {
    ...process.env,
    SMOKE_RETRY_INITIAL_DELAY_SECONDS: "0",
    SMOKE_RETRY_BACKOFF_SECONDS: "0",
  };

  it("succeeds immediately when the wrapped command succeeds on the first attempt", () => {
    const dir = mkdtempSync(join(tmpdir(), "smoke-retry-"));
    const counter = join(dir, "count");
    writeFileSync(counter, "0");
    const cmd = makeFixtureScript(
      dir,
      "always-ok.sh",
      `n=$(cat "${counter}"); n=$((n+1)); echo $n > "${counter}"; exit 0`,
    );
    const out = execFileSync("bash", [scriptPath, cmd], { env: fastEnv }).toString();
    expect(out).toContain("attempt 1/3 succeeded");
    expect(readFileSync(counter, "utf-8").trim()).toBe("1");
  });

  it("retries and succeeds once the wrapped command starts passing (the real propagation-lag shape)", () => {
    const dir = mkdtempSync(join(tmpdir(), "smoke-retry-"));
    const counter = join(dir, "count");
    writeFileSync(counter, "0");
    const cmd = makeFixtureScript(
      dir,
      "flaky.sh",
      `n=$(cat "${counter}"); n=$((n+1)); echo $n > "${counter}"; if [ "$n" -lt 2 ]; then exit 1; fi; exit 0`,
    );
    const out = execFileSync("bash", [scriptPath, cmd], { env: fastEnv }).toString();
    expect(out).toContain("attempt 1/3 failed");
    expect(out).toContain("attempt 2/3 succeeded");
    expect(readFileSync(counter, "utf-8").trim()).toBe("2");
  });

  it("is bounded: a persistently failing command is invoked exactly MAX_ATTEMPTS times, never more, and the wrapper still exits non-zero", () => {
    const dir = mkdtempSync(join(tmpdir(), "smoke-retry-"));
    const counter = join(dir, "count");
    writeFileSync(counter, "0");
    const cmd = makeFixtureScript(
      dir,
      "always-fail.sh",
      `n=$(cat "${counter}"); n=$((n+1)); echo $n > "${counter}"; exit 1`,
    );
    expect(() => execFileSync("bash", [scriptPath, cmd], { env: fastEnv })).toThrow();
    expect(readFileSync(counter, "utf-8").trim()).toBe("3");
  });

  it("respects a custom bounded attempt count (still bounded, not hardcoded to 3)", () => {
    const dir = mkdtempSync(join(tmpdir(), "smoke-retry-"));
    const counter = join(dir, "count");
    writeFileSync(counter, "0");
    const cmd = makeFixtureScript(
      dir,
      "always-fail.sh",
      `n=$(cat "${counter}"); n=$((n+1)); echo $n > "${counter}"; exit 1`,
    );
    expect(() =>
      execFileSync("bash", [scriptPath, cmd], {
        env: { ...fastEnv, SMOKE_RETRY_MAX_ATTEMPTS: "1" },
      }),
    ).toThrow();
    expect(readFileSync(counter, "utf-8").trim()).toBe("1");
  });

  it("never invokes anything other than the exact command it was given (no hidden deploy call)", () => {
    const executableLines = readFileSync(scriptPath, "utf-8")
      .split("\n")
      .filter((line) => !line.trim().startsWith("#"));
    const source = executableLines.join("\n");
    expect(source).not.toMatch(/wrangler\s+deploy/);
    expect(source).not.toMatch(/deploy:production/);
    expect(source).not.toMatch(/deploy\.sh/);
  });

  it("logs every attempt (both success and failure paths produce a per-attempt log line)", () => {
    const dir = mkdtempSync(join(tmpdir(), "smoke-retry-"));
    const counter = join(dir, "count");
    writeFileSync(counter, "0");
    const cmd = makeFixtureScript(
      dir,
      "flaky.sh",
      `n=$(cat "${counter}"); n=$((n+1)); echo $n > "${counter}"; if [ "$n" -lt 2 ]; then exit 1; fi; exit 0`,
    );
    const out = execFileSync("bash", [scriptPath, cmd], { env: fastEnv }).toString();
    const attemptLines = out.split("\n").filter((line) => line.includes("[smoke-retry] attempt"));
    expect(attemptLines.length).toBeGreaterThanOrEqual(3);
  });
});

describe("deploy-production.yml — structure unchanged except the smoke step", () => {
  const path = fileURLToPath(
    new URL("../../../.github/workflows/deploy-production.yml", import.meta.url),
  );
  const workflow = parseYaml(readFileSync(path, "utf-8")) as {
    on?: {
      workflow_dispatch?: { inputs?: Record<string, { required?: boolean }> };
      push?: unknown;
      workflow_run?: unknown;
    };
    concurrency?: { group?: string; ["cancel-in-progress"]?: boolean };
    jobs: { deploy: { steps: Array<{ name?: string; run?: string; if?: string }> } };
  };

  it("is still workflow_dispatch-only — never push or workflow_run triggered", () => {
    expect(workflow.on?.workflow_dispatch).toBeDefined();
    expect(workflow.on?.push).toBeUndefined();
    expect(workflow.on?.workflow_run).toBeUndefined();
  });

  it("still requires the exact typed confirmation and an explicit commit_sha", () => {
    const inputs = workflow.on?.workflow_dispatch?.inputs;
    expect(inputs?.confirm?.required).toBe(true);
    expect(inputs?.commit_sha?.required).toBe(true);
  });

  it("still checks exact-main membership and exact-commit CI success before deploying", () => {
    const steps = workflow.jobs.deploy.steps;
    expect(steps.some((s) => s.name === "Require the commit to be contained in main")).toBe(true);
    expect(
      steps.some(
        (s) =>
          s.name ===
          "Require CI (including browser-smoke) to have actually succeeded for this exact commit",
      ),
    ).toBe(true);
  });

  it("still declares non-cancelling production concurrency, unchanged by this fix", () => {
    expect(workflow.concurrency?.group).toBe("deploy-production");
    expect(workflow.concurrency?.["cancel-in-progress"]).toBe(false);
  });

  it("deploys the Worker exactly once — no step other than 'Deploy production Worker' invokes wrangler deploy", () => {
    const deploySteps = workflow.jobs.deploy.steps.filter(
      (s) => s.run && /wrangler\s+deploy|pnpm run deploy:production/.test(s.run),
    );
    expect(deploySteps.map((s) => s.name)).toEqual(["Deploy production Worker"]);
  });

  it("now runs the smoke step through the bounded retry wrapper, not the bare command", () => {
    const smokeStep = workflow.jobs.deploy.steps.find((s) => s.run?.includes("smoke:production"));
    expect(smokeStep?.run).toBe("bash scripts/smoke-retry.sh pnpm run smoke:production");
  });

  it("the retry wrapper step does not redeploy — its run command contains no wrangler/deploy invocation", () => {
    const smokeStep = workflow.jobs.deploy.steps.find((s) => s.run?.includes("smoke-retry"));
    expect(smokeStep?.run).not.toMatch(/wrangler\s+deploy/);
    expect(smokeStep?.run).not.toMatch(/deploy:production/);
  });

  it("still uploads deployment evidence unconditionally (if: always())", () => {
    const uploadStep = workflow.jobs.deploy.steps.find(
      (s) => s.name === "Upload deployment evidence",
    );
    expect(uploadStep?.if).toBe("always()");
  });
});
