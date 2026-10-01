"use client";
import { HqShell } from "./hq-shell";
import { fixtureIdentity, visualFixture } from "@/lib/qa-fixtures";
import { digest, prepareUpload } from "@/lib/intake";
import { syntheticPdf, syntheticDocxBytes } from "@/lib/qa-delivery-fixtures";
import type { MaterialArtifact } from "@/lib/types";
import { useState } from "react";
export function QaScreen({
  selectedId,
  actions = false,
  intake = false,
  delivery = false,
  fail = false,
}: {
  selectedId?: string;
  actions?: boolean;
  intake?: boolean;
  delivery?: boolean;
  fail?: boolean;
}) {
  const [result, setResult] = useState("");
  const data = visualFixture();
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
    <>
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
        onWorkspace={() => {}}
        onReload={() => {}}
        onSignOut={() => {}}
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
    </>
  );
}
