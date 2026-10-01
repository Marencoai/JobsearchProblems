// @vitest-environment jsdom
import { afterEach, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import { InterviewPanel, InterviewContext } from "@/components/interview-panel";
import { interviewFixture } from "@/lib/interview-fixture";
import { cheatSheet } from "@/lib/interview";
import { buildJobViews } from "@/lib/workflow";
import { visualFixture } from "@/lib/qa-fixtures";
import { readOnlyFetch } from "@/lib/supabase/client";
afterEach(cleanup);
const job = buildJobViews(visualFixture()).find(
  (j) => j.opportunity.id === "interview",
)!;
it("does not read or render write controls while the domain flag is off", () => {
  render(<InterviewPanel job={job} />);
  expect(
    screen.queryByRole("button", { name: "Start prep session" }),
  ).toBeNull();
});
it("renders structured round, source distinction, evidence and starts prep once", async () => {
  const service = interviewFixture();
  service.start = vi.fn().mockResolvedValue(undefined);
  render(
    <InterviewContext.Provider value={service}>
      <InterviewPanel job={job} />
    </InterviewContext.Provider>,
  );
  await screen.findByText("Round 2 · Hiring manager");
  expect(screen.getByText("predicted")).toBeTruthy();
  expect(screen.getByText(/synthetic turnaround story/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Start prep session" }));
  await screen.findByRole("status");
  expect(service.start).toHaveBeenCalledTimes(1);
});
it("requires review checkbox for freezing and keeps retry request/input stable", async () => {
  const service = interviewFixture();
  service.save = vi
    .fn()
    .mockRejectedValueOnce(new Error("uncertain"))
    .mockResolvedValue(undefined);
  render(
    <InterviewContext.Provider value={service}>
      <InterviewPanel job={job} />
    </InterviewContext.Provider>,
  );
  const input = await screen.findByLabelText("Concise purpose");
  fireEvent.change(input, { target: { value: "Reviewed concise purpose" } });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Save preparation" }));
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Save preparation" }));
  await waitFor(() => expect(service.save).toHaveBeenCalledTimes(2));
  const calls = vi.mocked(service.save).mock.calls;
  expect(calls[0][3].reviewed).toBe(true);
  expect(calls[1][3]).toEqual(calls[0][3]);
  expect(calls[1][4]).toEqual(calls[0][4]);
});
it("downloads only recorded bounded preparation and distinguishes predicted questions", async () => {
  const bundle = await interviewFixture().load(job);
  const text = cheatSheet(
    bundle.interviews[0],
    bundle.preparations[0],
    bundle.questions,
    bundle.evidence,
    bundle.people,
  );
  expect(text).toContain("predicted: Tell me about a pipeline");
  expect(text).toContain("Alex Example");
  expect(text).toContain("synthetic turnaround story");
  expect(text.length).toBeLessThan(12000);
});
it("transport blocks all domain reads and RPC when disabled and all raw writes when enabled", async () => {
  const origin = "https://xhhfnxswwspejdxjyvzz.supabase.co";
  const native = vi.fn().mockResolvedValue(new Response("{}"));
  const off = readOnlyFetch(origin, native);
  await expect(off(origin + "/rest/v1/interviews")).rejects.toThrow();
  await expect(
    off(origin + "/rest/v1/rpc/hq_interview_action", { method: "POST" }),
  ).rejects.toThrow();
  const on = readOnlyFetch(origin, native, false, true);
  await on(origin + "/rest/v1/interviews");
  await on(origin + "/rest/v1/rpc/hq_interview_action", { method: "POST" });
  await expect(
    on(origin + "/rest/v1/interviews", { method: "PATCH" }),
  ).rejects.toThrow();
  expect(native).toHaveBeenCalledTimes(2);
});

it("renders the exact local cheat sheet as a download without remote delivery", async () => {
  const service = interviewFixture();
  render(
    <InterviewContext.Provider value={service}>
      <InterviewPanel job={job} />
    </InterviewContext.Provider>,
  );
  const link = await screen.findByRole("link", {
    name: "Download concise cheat sheet",
  });
  expect(link.getAttribute("download")).toBe(
    "interview-synthetic-interview-cheat-sheet.txt",
  );
  const href = link.getAttribute("href")!;
  expect(href.startsWith("data:text/plain;charset=utf-8,")).toBe(true);
  expect(decodeURIComponent(href.split(",").slice(1).join(","))).toContain(
    "predicted: Tell me about a pipeline",
  );
});
it("SDK reads canonical full_name and RLS-scoped recorded stories in a fixed workspace", async () => {
  const { createHqClient } = await import("@/lib/supabase/client");
  const { interviewService } = await import("@/lib/interview");
  const bundle = await interviewFixture().load(job);
  const rows: Record<string, unknown[]> = {
    interviews: bundle.interviews,
    interview_preparations: bundle.preparations,
    interview_questions: bundle.questions,
    interview_question_evidence: bundle.evidence,
    interview_contacts: bundle.people.map((p) => ({
      interview_id: p.interview_id,
      contact_id: p.contact_id,
      interviewer_role: p.interviewer_role,
    })),
    contacts: [
      {
        id: "synthetic-contact",
        full_name: "Canonical Alex",
        title: "VP Sales",
      },
    ],
    evidence_stories: [
      {
        id: "synthetic-story",
        title: "Turnaround story",
        situation: "Pipeline stalled",
        actions_taken: "Reset operating cadence",
        outcome: "Pipeline recovered",
        quantitative_impact: "Synthetic metric",
        validation_status: "confirmed",
      },
    ],
  };
  const native = vi
    .fn()
    .mockImplementation(
      async (input) =>
        new Response(
          JSON.stringify(
            rows[new URL(String(input)).pathname.split("/").at(-1)!] ?? [],
          ),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
  const client = createHqClient(
    {
      url: "https://xhhfnxswwspejdxjyvzz.supabase.co",
      key: "sb_publishable_fixture_only",
      interview: true,
    },
    native,
  );
  const result = await interviewService(
    client,
    () => job.opportunity.workspace_id,
    async () => {},
  ).load(job);
  expect(result.people[0].name).toBe("Canonical Alex");
  expect(result.evidence[0].story_title).toBe("Turnaround story");
  expect(result.evidence[0].story_text).toContain("Reset operating cadence");
  for (const [url] of native.mock.calls)
    expect(new URL(String(url)).searchParams.get("workspace_id")).toBe(
      "eq." + job.opportunity.workspace_id,
    );
  client.auth.stopAutoRefresh();
});
