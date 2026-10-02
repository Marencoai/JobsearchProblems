"use client";
import { InterviewContext } from "./interview-panel";
import { interviewFixture } from "@/lib/interview-fixture";
import { OfferContext } from "./offer-panel";
import { offerFixture } from "@/lib/offer-fixture";
import { digest, prepareUpload } from "@/lib/intake";
import { syntheticPdf, syntheticDocxBytes } from "@/lib/qa-delivery-fixtures";
import type { MaterialArtifact } from "@/lib/types";
import { HqShell } from "./hq-shell";
import { fixtureIdentity, visualFixture } from "@/lib/qa-fixtures";
import { useState, useRef, useMemo } from "react";
import { outreachFixture, applyOutreachFixture } from "@/lib/outreach-fixtures";
import type { Json } from "@/lib/database.types";
export function QaScreen({
  selectedId,
  actions = false,
  outreach = false,
  intake=false,delivery=false,fail=false,
}: {
  selectedId?: string;
  actions?: boolean;
  outreach?: boolean;
  intake?: boolean;delivery?: boolean;fail?: boolean;
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
  const [artifactRows, setArtifactRows] = useState<MaterialArtifact[]>([]);
  const [failed, setFailed] = useState(false);
  // Preview metadata is synthesized after the explicit Open files control.
  const openFiles = async () => {
    const m = data.materials[0],
      docx = syntheticDocxBytes(),
      pdf = syntheticPdf();
    const dh = await digest(docx.buffer as ArrayBuffer),
      ph = await digest(pdf.buffer as ArrayBuffer);
    setArtifactRows(
      (["pdf", "docx"] as const).map((format) => ({
        id: "fixture-" + format,
        workspace_id: m.workspace_id,
        application_material_id: m.id,
        format,
        bucket_id: "hq-materials",
        storage_path: `${m.workspace_id}/${m.id}/${format === "pdf" ? ph : dh}.${format}`,
        sha256: format === "pdf" ? ph : dh,
        byte_size: format === "pdf" ? pdf.length : docx.length,
        renderer_key: "executive-brief-two-page-v2",
        input_sha256: "c".repeat(64),
        source_docx_sha256: dh,
        qa: {
          visual_pass: true,
          parse_back_pass: true,
          page_count: 2,
          renderer_key: "executive-brief-two-page-v2",
          input_sha256: "c".repeat(64),
          docx_sha256: dh,
          pdf_sha256: ph,
        },
        created_at: m.created_at,
        created_by_principal_id: "fixture",
      })),
    );
  };
  data.artifacts = artifactRows;
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
      {(intake || delivery) && (
        <p role="status" className="notice">
          Synthetic intake/file transport preview. No database, storage or
          worker execution. {result}
          {delivery && (
            <button className="button" onClick={() => void openFiles()}>
              Load synthetic file fixtures
            </button>
          )}
        </p>
      )}
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
        onIntake={
          intake
            ? async (_input, request) => {
                if (fail && !failed) {
                  setFailed(true);
                  throw new Error(
                    "Synthetic uncertain response. Retry the same request.",
                  );
                }
                setResult("Confirmed synthetic intake " + request + ".");
              }
            : undefined
        }
        onUpload={
          intake
            ? async (file, request) =>
                (
                  await prepareUpload(
                    file,
                    "11111111-1111-1111-1111-111111111111",
                    "22222222-2222-2222-2222-222222222222",
                    request,
                  )
                ).input
            : undefined
        }
        onDelivery={
          delivery
            ? async (_material, a) =>
                new Blob(
                  [
                    a.format === "pdf"
                      ? (syntheticPdf().buffer as ArrayBuffer)
                      : (syntheticDocxBytes().buffer as ArrayBuffer),
                  ],
                  {
                    type:
                      a.format === "pdf"
                        ? "application/pdf"
                        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                  },
                )
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
