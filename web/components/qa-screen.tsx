"use client";
import { HqShell } from "./hq-shell";
import { fixtureIdentity, visualFixture } from "@/lib/qa-fixtures";
import { InterviewContext } from "./interview-panel";
import { interviewFixture } from "@/lib/interview-fixture";
import { useMemo, useState } from "react";
export function QaScreen({
  selectedId,
  actions = false,
}: {
  selectedId?: string;
  actions?: boolean;
}) {
  const [result, setResult] = useState("");
  const interview = useMemo(() => interviewFixture(), []);
  const data = visualFixture();
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
    <InterviewContext.Provider value={interview}>
      {actions && (
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
    </InterviewContext.Provider>
  );
}
