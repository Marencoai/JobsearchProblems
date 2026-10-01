import { describe, expect, it } from "vitest";
import {
  action,
  applicationPackage,
  emptyData,
  evaluation,
  opportunity,
  task,
  visualFixture,
} from "@/lib/qa-fixtures";
import { actionStage, buildJobViews, deriveStage } from "@/lib/workflow";

describe("derived human stages", () => {
  it.each(["discovered", "verified", "evaluating"])(
    "%s awaits Evaluate",
    (lifecycle) =>
      expect(
        deriveStage(opportunity("a", { opportunity_stage: lifecycle }), [], [])
          .stage,
      ).toBe("Evaluate"),
  );
  it.each([{ opportunity_stage: "closed" }, { is_currently_active: false }])(
    "excludes closed/inactive records from the active pipeline",
    (changes) =>
      expect(deriveStage(opportunity("a", changes), [], []).stage).toBeNull(),
  );
  it.each(["draft", "preparing"])("%s preparation remains Pursue", (status) =>
    expect(
      deriveStage(
        opportunity("a", { opportunity_stage: "pursuing" }),
        [],
        [],
        applicationPackage("p", { status }),
      ).stage,
    ).toBe("Pursue"),
  );
  it("material review is Resume", () =>
    expect(deriveStage(opportunity(), [], [], applicationPackage()).stage).toBe(
      "Resume",
    ));
  it("approved package is Application", () =>
    expect(
      deriveStage(
        opportunity(),
        [],
        [],
        applicationPackage("p", { status: "approved" }),
      ).stage,
    ).toBe("Application"));
  it("an apply action means Application", () =>
    expect(
      deriveStage(
        opportunity(),
        [action("apply", { action_type: "apply" })],
        [],
      ).stage,
    ).toBe("Application"));
  it("worker preparation questions mean Resume", () =>
    expect(
      actionStage(
        action("question", { action_type: "answer", internal_task_id: "p" }),
        [task("p", { domain: "application" })],
      ),
    ).toBe("Resume"));
  it("an application decision means Pursue", () =>
    expect(
      actionStage(
        action("question", { action_type: "decide", internal_task_id: "p" }),
        [task("p", { domain: "application" })],
      ),
    ).toBe("Pursue"));
  it("unrelated approval cannot invent a Resume stage", () =>
    expect(
      actionStage(action("x", { action_type: "approve" }), []),
    ).toBeUndefined());
  it("outreach is based on the linked domain", () =>
    expect(
      deriveStage(
        opportunity(),
        [action("send", { action_type: "send", internal_task_id: "o" })],
        [task("o", { domain: "outreach" })],
      ).stage,
    ).toBe("Outreach"));
  it("interview action takes precedence over a new review", () =>
    expect(
      deriveStage(
        opportunity(),
        [
          action(),
          action("i", {
            action_type: "prepare",
            internal_task_id: "i",
            priority: 10,
          }),
        ],
        [task("i", { domain: "interview" })],
      ).stage,
    ).toBe("Interview"));
  it.each(["interviewing", "offer"])(
    "lifecycle %s is inspectable without an action",
    (lifecycle) =>
      expect(
        deriveStage(opportunity("a", { opportunity_stage: lifecycle }), [], [])
          .stage,
      ).toBe(lifecycle === "offer" ? "Offer" : "Interview"),
  );
  it("completed/dismissed actions do not route the stage", () =>
    expect(
      deriveStage(
        opportunity(),
        [
          action("a", { action_type: "apply", status: "completed" }),
          action("b", { action_type: "apply", status: "dismissed" }),
        ],
        [],
      ).stage,
    ).toBe("Evaluate"));
  it("ignores other opportunities' actions", () =>
    expect(
      deriveStage(
        opportunity(),
        [action("a", { opportunity_id: "other", action_type: "apply" })],
        [],
      ).stage,
    ).toBe("Evaluate"));
  it("ranks priority then due date without mutating actions", () => {
    const actions = [
      action("low", { priority: 10 }),
      action("later", { priority: 80, due_at: "2026-10-03" }),
      action("first", { priority: 80, due_at: "2026-10-01" }),
    ];
    expect(deriveStage(opportunity(), actions, []).action?.id).toBe("first");
    expect(actions[0].id).toBe("low");
  });
  it("never fabricates evaluation scores or pursuit from a score", () => {
    const jobs = buildJobViews(
      emptyData({
        opportunities: [opportunity()],
        evaluations: [
          evaluation("e", {
            candidate_fit_score: 100,
            opportunity_fit_score: 100,
          }),
        ],
      }),
    );
    expect(jobs[0].stage).toBe("Evaluate");
    expect(jobs[0].package).toBeUndefined();
  });
  it("chooses the latest completed evaluation and its evidence", () => {
    const data = visualFixture();
    data.evaluations.push(
      evaluation("pending", {
        version_number: 3,
        evaluation_status: "pending",
      }),
      evaluation("new", { version_number: 2 }),
    );
    const job = buildJobViews(data).find(
      (j) => j.opportunity.id === "evaluate",
    )!;
    expect(job.evaluation?.id).toBe("new");
    expect(job.evidence).toHaveLength(0);
  });
  it("keeps historical package materials inspectable", () => {
    const data = visualFixture();
    data.packages.push(applicationPackage("p2", { package_number: 2 }));
    const job = buildJobViews(data).find((j) => j.opportunity.id === "resume")!;
    expect(job.package?.id).toBe("p2");
    expect(job.materials).toHaveLength(1);
  });
  it("does not duplicate a job across pipeline stages", () => {
    const jobs = buildJobViews(visualFixture());
    expect(new Set(jobs.map((j) => j.opportunity.id)).size).toBe(jobs.length);
    expect(jobs.filter((j) => j.stage)).toHaveLength(9);
  });
  it("submission does not invent Outreach work", () => {
    const job = buildJobViews(visualFixture()).find(
      (j) => j.opportunity.id === "application",
    )!;
    expect(job.stage).toBe("Application");
    expect(job.nextAction).toContain("Application confirmed");
    expect(job.submittedMaterials).toHaveLength(1);
  });
  it("includes events linked through activity_event_links exactly once", () => {
    const data = emptyData({
      opportunities: [opportunity()],
      activities: [
        {
          id: "event",
          opportunity_id: "evaluate",
          event_type: "interview_invitation",
          event_timestamp: "2026-10-01",
          summary: "Invitation",
          source_system: "gmail",
        },
      ],
      activityLinks: [
        {
          activity_event_id: "event",
          entity_type: "opportunity",
          entity_id: "evaluate",
        },
      ],
    });
    expect(buildJobViews(data)[0].activities).toHaveLength(1);
    data.activities[0].opportunity_id = null;
    expect(buildJobViews(data)[0].activities).toHaveLength(1);
  });
});
