"use client";
import { InterviewContext } from "./interview-panel";
import { interviewFixture } from "@/lib/interview-fixture";
import { OfferContext } from "./offer-panel";
import { offerFixture } from "@/lib/offer-fixture";
import { HqShell } from "./hq-shell";
import { fixtureIdentity, visualFixture } from "@/lib/qa-fixtures";
import { useState, useRef, useMemo } from "react";
import { outreachFixture, applyOutreachFixture } from "@/lib/outreach-fixtures";
import type { Json } from "@/lib/database.types";
export function QaScreen({
  selectedId,
  actions = false,
  outreach = false,
}: {
  selectedId?: string;
  actions?: boolean;
  outreach?: boolean;
}) {
  const interview = useMemo(() => interviewFixture(), []);
  const offer = useMemo(() => offerFixture(), []);
  const [result, setResult] = useState("");
  const [outreachData, setOutreachData] = useState(outreachFixture);
  const savedRequests = useRef(
    new Map<string, { input: string; result: Json }>(),
  );
  const data = visualFixture();
  if (outreach) {
    data.outreach = outreachData;
    data.actions = data.actions.map((a) =>
      a.opportunity_id === "outreach"
        ? { ...a, action_type: "review", title: "Review this exact draft" }
        : a,
    );
    data.tasks = data.tasks.map((t) =>
      t.id === "outreach-task"
        ? { ...t, status: "waiting", task_type: "review_outreach_message" }
        : t,
    );
  }
  if (actions) {
    data.applications = [];
    data.materials.push({
      ...data.materials[0],
      id: "application-resume-fixture",
      application_package_id: "package-approved",
      status: "approved",
    });
  }
  return (
    <InterviewContext.Provider value={interview}><OfferContext.Provider value={offer}>
      {(actions || outreach) && (
        <p role="status" className="notice">
          Synthetic action preview. No database connection or worker execution.{" "}
          {result}
        </p>
      )}
      <HqShell
        identity={fixtureIdentity}
        data={data}
        workspaceId="fixture-workspace"
        selectedId={selectedId}
        loading={false}
        error=""
        fixture
        domainActions
        onWorkspace={() => {}}
        onReload={() => {}}
        onSignOut={() => {}}
        onOutreach={
          outreach
            ? async (command, payload, requestId) => {
                const input = JSON.stringify({ command, payload });
                const previous = savedRequests.current.get(requestId);
                if (previous) {
                  if (previous.input !== input)
                    throw new Error("Synthetic retry input changed");
                  return previous.result;
                }
                const next = applyOutreachFixture(
                  outreachData,
                  command,
                  payload,
                  requestId,
                );
                savedRequests.current.set(requestId, {
                  input,
                  result: next.result,
                });
                setOutreachData(next.data);
                setResult(
                  "Confirmed synthetic " + command.replaceAll("_", " ") + ".",
                );
                return next.result;
              }
            : undefined
        }
        onAction={
          actions
            ? async (_job, command) => {
                setResult(
                  "Confirmed synthetic " + command.replaceAll("_", " ") + ".",
                );
              }
            : undefined
        }
      />
    </OfferContext.Provider></InterviewContext.Provider>
  );
}
