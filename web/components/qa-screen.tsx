"use client";
import { InterviewContext } from "./interview-panel";
import { interviewFixture } from "@/lib/interview-fixture";
import { OfferContext } from "./offer-panel";
import { offerFixture } from "@/lib/offer-fixture";
import type { QaCanonical } from "@/lib/qa-canonical-types";
import { digest, prepareUpload } from "@/lib/intake";
import { syntheticPdf, syntheticDocxBytes } from "@/lib/qa-delivery-fixtures";
import type { MaterialArtifact } from "@/lib/types";
import { addSyntheticPacket } from "@/lib/qa-packet-fixtures";
import { HqShell } from "./hq-shell";
import { fixtureIdentity, visualFixture } from "@/lib/qa-fixtures";
import { useState, useRef, useMemo } from "react";
import { outreachFixture, applyOutreachFixture } from "@/lib/outreach-fixtures";
import type { Json } from "@/lib/database.types";
export function QaScreen({
  selectedId,
  actions = false,
  outreach = false,
  intake = false,
  delivery = false,
  fail = false,
  refresh = false,
  packet = false,
  canonical,
  history = false,
}: {
  selectedId?: string;
  actions?: boolean;
  outreach?: boolean;
  intake?: boolean;
  delivery?: boolean;
  fail?: boolean;
  refresh?: boolean;
  packet?: boolean;
  canonical?: QaCanonical;
  history?: boolean;
}) {
  const interview = useMemo(() => interviewFixture(), []);
  const offer = useMemo(() => offerFixture(), []);
  const [result, setResult] = useState("");
  const [outreachData, setOutreachData] = useState(outreachFixture);
  const savedRequests = useRef(
    new Map<string, { input: string; result: Json }>(),
  );
  const data = visualFixture();
  const decode = (value: string) =>
    Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
  const usesCanonical = (materialId: string) =>
    !!canonical && (!history || materialId === "fixture-submitted-material");
  const fixtureBytes = (format: "pdf" | "docx", materialId: string) =>
    usesCanonical(materialId)
      ? decode(canonical![format])
      : format === "pdf"
        ? syntheticPdf()
        : syntheticDocxBytes();
  if (canonical)
    data.materials[0].content_text =
      "Fictional Casey Example. Canonical synthetic resume, unchanged executive-brief-two-page-v2 renderer. No real candidate or employer data.";

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
    const groups = await Promise.all(
      data.materials
        .filter((m) => ["resume", "cover_letter"].includes(m.material_type))
        .map(async (m) => {
          const pdf = fixtureBytes("pdf", m.id),
            docx = fixtureBytes("docx", m.id);
          const ph = await digest(pdf.buffer as ArrayBuffer),
            dh = await digest(docx.buffer as ArrayBuffer);
          const inputHash = usesCanonical(m.id)
            ? canonical!.manifest[0].input_sha256
            : "c".repeat(64);
          return (["pdf", "docx"] as const).map((format) => ({
            id: "fixture-" + m.id + "-" + format,
            workspace_id: m.workspace_id,
            application_material_id: m.id,
            format,
            bucket_id: "hq-materials" as const,
            storage_path: `${m.workspace_id}/${m.id}/${format === "pdf" ? ph : dh}.${format}`,
            sha256: format === "pdf" ? ph : dh,
            byte_size: format === "pdf" ? pdf.length : docx.length,
            renderer_key: "executive-brief-two-page-v2",
            input_sha256: inputHash,
            source_docx_sha256: dh,
            qa: {
              visual_pass: true,
              parse_back_pass: true,
              page_count: 2,
              renderer_key: "executive-brief-two-page-v2",
              input_sha256: inputHash,
              docx_sha256: dh,
              pdf_sha256: ph,
            },
            created_at: m.created_at,
            created_by_principal_id: "fixture",
          }));
        }),
    );
    setArtifactRows(groups.flat());
  };
  data.artifacts = artifactRows;
  if (actions) {
    if (!history) data.applications = [];
    if (!packet)
      data.materials.push({
        ...data.materials[0],
        id: "application-resume-fixture",
        application_package_id: "package-approved",
        status: "approved",
      });
  }
  if (packet) addSyntheticPacket(data);
  if (history) {
    const original = {
      ...data.materials[0],
      id: "fixture-submitted-material",
      application_package_id: "package-approved",
      version_number: 1,
      status: "submitted",
      is_current_package_version: false,
      content_text:
        "Exact historical synthetic Casey Example resume version one.",
      file_url: "https://example.invalid/legacy-unverified-artifact.pdf",
    };
    data.materials.push(original, {
      ...original,
      id: "new-current-resume",
      version_number: 2,
      status: "approved",
      is_current_package_version: true,
      content_text:
        "Newer synthetic resume version two; never substitute for submitted version one.",
    });
  }

  return (
    <InterviewContext.Provider value={interview}>
      <OfferContext.Provider value={offer}>
        {(intake || delivery) && (
          <p role="status" className="notice">
            Synthetic intake/file transport preview. No database, storage or
            worker execution.{" "}
            {canonical &&
              "Using the committed fictional Casey Example canonical pair; converter-runtime acceptance remains pending."}{" "}
            {result}
            {delivery && (
              <button className="button" onClick={() => void openFiles()}>
                Load synthetic file fixtures
              </button>
            )}
          </p>
        )}
        {(actions || outreach) && (
          <p role="status" className="notice">
            Synthetic action preview. No database connection or worker
            execution. {result}
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
          fixturePacket={packet}
          fixtureCanonical={!!canonical}
          fixtureHistory={history}
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
          onResearchRefresh={
            refresh
              ? async (_opportunity, request) => {
                  if (fail && !failed) {
                    setFailed(true);
                    throw new Error(
                      "Synthetic uncertain research response. Retry the same request.",
                    );
                  }
                  setResult(
                    "Confirmed synthetic research request " + request + ".",
                  );
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
              ? async (material, artifact) => {
                  const bytes = fixtureBytes(artifact.format, material.id);
                  if (
                    artifact.application_material_id !== material.id ||
                    artifact.workspace_id !== material.workspace_id ||
                    bytes.byteLength !== artifact.byte_size ||
                    (await digest(bytes.buffer as ArrayBuffer)) !==
                      artifact.sha256
                  )
                    throw new Error(
                      "Synthetic exact-version byte verification failed.",
                    );
                  return new Blob([bytes.buffer as ArrayBuffer], {
                    type:
                      artifact.format === "pdf"
                        ? "application/pdf"
                        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                  });
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
      </OfferContext.Provider>
    </InterviewContext.Provider>
  );
}
