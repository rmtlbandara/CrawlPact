import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { describe, expect, it } from "vitest";

/**
 * Regression guard for a real, live-observed GitHub Actions orchestration
 * defect (2026-09-14, found during Phase 4 Stage A's post-merge Preview
 * deployment — run `34821431442` in this repository's Actions history):
 * `deploy-preview.yml` is triggered by `workflow_run` on *every* completed
 * run of the "CI" workflow, regardless of branch — `jobs.deploy.if` is what
 * actually filters that down to "CI succeeded on `main`." A workflow-level
 * `concurrency` block is entered the moment a run is *created*, before any
 * job's `if` is evaluated, so an unrelated CI completion (a burst of
 * Dependabot dependency-update PRs' own CI runs, in the real incident) still
 * spawned a new "Deploy preview" *run* that entered the `deploy-preview`
 * concurrency group and cancelled a real, legitimate, still-deploying run —
 * mid-Lighthouse-check, after the actual deploy/bindings/smoke-test steps
 * had already succeeded.
 *
 * Fix: move `concurrency` from workflow level into `jobs.deploy` itself. A
 * job skipped by its own `if` (Dependabot's `head_branch` is never `main`)
 * never enters or affects a job-level concurrency group, so it can no
 * longer cancel a real deployment; a genuinely newer deploy of `main` still
 * correctly cancels an older one, unchanged.
 *
 * This test guards the *source* workflow file against the bug's exact
 * shape recurring — it does not (and cannot, from a unit test) prove the
 * real-world race is gone; that was independently confirmed by reading the
 * actual incident's GitHub Actions run history before this fix.
 */
describe("deploy-preview.yml — concurrency scoping (Phase 4 Stage A incident fix)", () => {
  const path = fileURLToPath(
    new URL("../../../.github/workflows/deploy-preview.yml", import.meta.url),
  );
  const workflow = parseYaml(readFileSync(path, "utf-8")) as {
    concurrency?: unknown;
    on?: { workflow_run?: unknown; workflow_dispatch?: unknown };
    jobs: {
      deploy: {
        if?: string;
        concurrency?: { group?: string; ["cancel-in-progress"]?: boolean };
      };
    };
  };

  it("has NO workflow-level concurrency block (that is what caused the incident)", () => {
    expect(workflow.concurrency).toBeUndefined();
  });

  it("declares the concurrency group on jobs.deploy instead", () => {
    expect(workflow.jobs.deploy.concurrency?.group).toBe("deploy-preview");
  });

  it("still cancels an in-flight deploy of an older commit (cancel-in-progress: true)", () => {
    expect(workflow.jobs.deploy.concurrency?.["cancel-in-progress"]).toBe(true);
  });

  it("still requires manual dispatch or successful CI on main before deploying", () => {
    expect(workflow.jobs.deploy.if).toBe(
      "github.event_name == 'workflow_dispatch' || (github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.head_branch == 'main')",
    );
  });

  it("still listens for every CI completion (the trigger itself is intentionally broad — the fix is in where concurrency is scoped, not the trigger)", () => {
    expect(workflow.on?.workflow_run).toBeDefined();
    expect(workflow.on?.workflow_dispatch).toBeDefined();
  });
});

describe("deploy-production.yml — unaffected by this fix", () => {
  const path = fileURLToPath(
    new URL("../../../.github/workflows/deploy-production.yml", import.meta.url),
  );
  const workflow = parseYaml(readFileSync(path, "utf-8")) as {
    concurrency?: { group?: string; ["cancel-in-progress"]?: boolean };
    on?: { workflow_dispatch?: unknown; workflow_run?: unknown };
  };

  it("is triggered only by workflow_dispatch — never exposed to the workflow_run race this fix addresses", () => {
    expect(workflow.on?.workflow_dispatch).toBeDefined();
    expect(workflow.on?.workflow_run).toBeUndefined();
  });

  it("keeps its own workflow-level concurrency block exactly as before (not touched by this PR)", () => {
    expect(workflow.concurrency?.group).toBe("deploy-production");
    expect(workflow.concurrency?.["cancel-in-progress"]).toBe(false);
  });
});
