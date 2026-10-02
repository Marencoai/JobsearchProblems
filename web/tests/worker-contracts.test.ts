import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  plannerEligibility,
  preparationTarget,
  type PreparationTask,
} from "../../worker-support/hq-contracts";
const now = "2026-10-01T12:00:00Z";
const base = {
  workspace_id: "workspace",
  assigned_to_principal_id: "human",
  status: "open",
};
const task: PreparationTask = {
  id: "00000000-0000-4000-8000-000000000003",
  workspace_id: "workspace",
  opportunity_id: "role",
  task_type: "prepare_application_package",
  domain: "application",
  trigger_type: "candidate_action",
  trigger_reference: "candidate_decided_to_pursue",
  title: "Prepare requested application revisions",
  description:
    "Use draft package 00000000-0000-4000-8000-000000000002. Change evidence",
};
const packages = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    workspace_id: "workspace",
    opportunity_id: "role",
    package_number: 1,
    status: "approved",
    candidate_notes: "Frozen original",
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    workspace_id: "workspace",
    opportunity_id: "role",
    package_number: 2,
    status: "draft",
    candidate_notes: "Revision: Change evidence",
    hq_preparation_task_id: task.id,
  },
];
describe("worker deferral and package handoff", () => {
  it("pins the proposed SQL and changes only the verified HQ worker fragments", async () => {
    const artifact = JSON.parse(
      await readFile(
        new URL(
          "../qa-evidence/phase2-hardening-proposed-worker-prompts.json",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const snapshot = await readFile(
      new URL(
        "../../docs/live-worker-instructions-verified-2026-10-01.md",
        import.meta.url,
      ),
      "utf8",
    );
    const hash = (data: string) =>
      createHash("sha256").update(data).digest("hex");
    const prompts = [...snapshot.matchAll(/```text\n(.*?)\n```/gs)].map(
      (m) => m[1],
    );
    expect(hash(snapshot)).toBe(artifact.snapshot_sha256);
    expect(artifact.status).toBe("PROPOSED_NOT_ADOPTED");
    expect(artifact.live_task_write_attempted).toBe(false);
    expect(artifact.schedule_and_enabled_state_changes).toBe(false);
    expect(prompts).toHaveLength(2);
    for (const [index, entry] of artifact.entries.entries()) {
      const current = prompts[index];
      expect(hash(current)).toBe(entry.verified_current_prompt_sha256);
      expect(current.split(entry.old_hq_fragment)).toHaveLength(2);
      expect(
        entry.proposed_prompt.split(entry.proposed_hq_fragment),
      ).toHaveLength(2);
      expect(
        entry.proposed_prompt.replace(entry.proposed_hq_fragment, ""),
      ).toBe(current.replace(entry.old_hq_fragment, ""));
      expect(hash(entry.proposed_prompt)).toBe(entry.proposed_prompt_sha256);
    }
    const sql = await readFile(
      new URL("../../" + artifact.migration_file, import.meta.url),
      "utf8",
    );
    expect(hash(sql)).toBe(artifact.migration_sha256);
  });
  it("executes planner filtering through the exact CLI named by the worker skill", () => {
    const script = fileURLToPath(
      new URL("../../worker-support/cli.mts", import.meta.url),
    );
    const output = execFileSync(
      process.execPath,
      ["--experimental-strip-types", script, "planner"],
      {
        input: JSON.stringify({
          workspace_id: "workspace",
          principal_id: "human",
          now,
          actions: [
            {
              ...base,
              id: "deferred",
              available_after: "2026-10-02T12:00:00Z",
            },
          ],
          plan_items: [
            {
              id: "old",
              workspace_id: "workspace",
              next_action_id: "deferred",
            },
          ],
        }),
        encoding: "utf8",
        env: { PATH: "/usr/bin:/bin", NODE_ENV: "test" },
      },
    );
    expect(JSON.parse(output)).toEqual({
      deduplication_action_ids: ["deferred"],
      eligible_action_ids: [],
      delivery_plan_item_ids: [],
    });
  });
  it("executes exact revision package routing through the worker CLI", () => {
    const script = fileURLToPath(
      new URL("../../worker-support/cli.mts", import.meta.url),
    );
    const output = execFileSync(
      process.execPath,
      ["--experimental-strip-types", script, "preparation"],
      {
        input: JSON.stringify({ task, packages }),
        encoding: "utf8",
        env: { PATH: "/usr/bin:/bin", NODE_ENV: "test" },
      },
    );
    expect(JSON.parse(output)).toEqual({
      disposition: "reuse",
      package_id: packages[1].id,
      candidate_notes: packages[1].candidate_notes,
    });
  });
  it("keeps deferred actions for deduplication while excluding new work and old plan delivery", () => {
    const result = plannerEligibility(
      "workspace",
      "human",
      [
        { ...base, id: "later", available_after: "2026-10-02T12:00:00Z" },
        { ...base, id: "today" },
        { ...base, id: "done", status: "completed" },
        { ...base, id: "foreign", workspace_id: "other" },
        {
          ...base,
          id: "other-human",
          assigned_to_principal_id: "someone-else",
        },
      ],
      [
        {
          id: "old-later-item",
          workspace_id: "workspace",
          next_action_id: "later",
        },
        {
          id: "today-item",
          workspace_id: "workspace",
          next_action_id: "today",
        },
        { id: "foreign-item", workspace_id: "other", next_action_id: "today" },
      ],
      now,
    );
    expect(result).toEqual({
      deduplication_action_ids: ["later", "today", "other-human"],
      eligible_action_ids: ["today"],
      delivery_plan_item_ids: ["today-item"],
    });
  });
  it("resumes the same action exactly at the deferral time", () => {
    expect(
      plannerEligibility(
        "workspace",
        "human",
        [{ ...base, id: "later", available_after: now }],
        [],
        now,
      ).eligible_action_ids,
    ).toEqual(["later"]);
  });
  it("fails closed on malformed clock or deferral input", () => {
    expect(() =>
      plannerEligibility("workspace", "human", [], [], "bad"),
    ).toThrow();
    expect(() =>
      plannerEligibility(
        "workspace",
        "human",
        [{ ...base, id: "bad", available_after: "bad" }],
        [],
        now,
      ),
    ).toThrow();
  });
  it("routes revision work to the new draft and its notes without mutating approved history", () => {
    const before = structuredClone(packages);
    expect(preparationTarget(task, packages)).toEqual({
      disposition: "reuse",
      package_id: packages[1].id,
      candidate_notes: packages[1].candidate_notes,
    });
    expect(packages).toEqual(before);
  });
  it("rejects missing, foreign, archived, or superseded revision packages", () => {
    expect(
      preparationTarget({ ...task, description: null }, packages).package_id,
    ).toBe(packages[1].id);
    expect(
      preparationTarget(
        task,
        packages.map((p) => ({ ...p, hq_preparation_task_id: null })),
      ).disposition,
    ).toBe("owner_handoff_required");
    expect(() =>
      preparationTarget(task, [
        packages[0],
        { ...packages[1], workspace_id: "other" },
      ]),
    ).toThrow("foreign");
    expect(() =>
      preparationTarget(task, [
        packages[0],
        { ...packages[1], status: "archived" },
      ]),
    ).toThrow("archived");
    expect(() =>
      preparationTarget(task, [
        ...packages,
        {
          ...packages[1],
          id: "newer",
          package_number: 3,
          hq_preparation_task_id: null,
        },
      ]),
    ).toThrow("superseded");
  });
  it("retries a completed preparation handoff without regenerating reviewed materials", () => {
    expect(
      preparationTarget(task, [
        packages[0],
        { ...packages[1], status: "ready_for_review" },
      ]).disposition,
    ).toBe("already_ready");
  });
  it("never interprets a score or machine event as candidate preparation authority", () => {
    expect(() =>
      preparationTarget({ ...task, trigger_type: "system_event" }, packages),
    ).toThrow("candidate");
  });
  it("supports initial pursuit without reusing an approved package as a working target", () => {
    const initial = {
      ...task,
      title: "Prepare the application package",
      description: null,
    };
    expect(preparationTarget(initial, []).disposition).toBe(
      "owner_handoff_required",
    );
    expect(preparationTarget(initial, [packages[0]]).disposition).toBe(
      "owner_handoff_required",
    );
  });
});
