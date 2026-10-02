import type { Material, MaterialArtifact } from "./types";
import type { HqClient } from "./supabase/client";
import { digest } from "./intake";
export type MaterialDeliveryHandler = (
  material: Material,
  artifact: MaterialArtifact,
) => Promise<Blob>;
export function artifactPair(material: Material, rows: MaterialArtifact[]) {
  const own = rows.filter(
    (a) =>
      a.application_material_id === material.id &&
      a.workspace_id === material.workspace_id,
  );
  const pdf = own.find((a) => a.format === "pdf"),
    docx = own.find((a) => a.format === "docx");
  const valid = (a: MaterialArtifact) =>
    a.bucket_id === "hq-materials" &&
    /^[a-f0-9]{64}$/.test(a.sha256) &&
    a.storage_path ===
      `${material.workspace_id}/${material.id}/${a.sha256}.${a.format}` &&
    Number.isInteger(a.byte_size) &&
    a.byte_size > 0 &&
    a.byte_size <= 16777216 &&
    a.qa?.visual_pass === true &&
    a.qa?.parse_back_pass === true &&
    Number.isInteger(a.qa.page_count) &&
    a.qa.page_count > 0 &&
    a.qa.page_count <= 20 &&
    a.qa.renderer_key === a.renderer_key &&
    a.qa.input_sha256 === a.input_sha256 &&
    /^[a-f0-9]{64}$/.test(a.input_sha256) &&
    a.qa.docx_sha256 === a.source_docx_sha256 &&
    /^[a-f0-9]{64}$/.test(a.qa.pdf_sha256) &&
    (a.format !== "pdf" || a.qa.pdf_sha256 === a.sha256) &&
    (material.material_type !== "resume" ||
      (a.renderer_key === "executive-brief-two-page-v2" &&
        a.qa.page_count === 2));
  if (
    !pdf ||
    !docx ||
    own.length !== 2 ||
    !valid(pdf) ||
    !valid(docx) ||
    pdf.source_docx_sha256 !== docx.sha256 ||
    docx.source_docx_sha256 !== docx.sha256 ||
    pdf.input_sha256 !== docx.input_sha256 ||
    pdf.renderer_key !== docx.renderer_key ||
    docx.qa.pdf_sha256 !== pdf.sha256 ||
    pdf.qa.page_count !== docx.qa.page_count
  )
    return null;
  return { pdf, docx };
}
export async function loadMaterialArtifact(
  client: HqClient,
  material: Material,
  artifact: MaterialArtifact,
): Promise<Blob> {
  if (
    artifact.application_material_id !== material.id ||
    artifact.workspace_id !== material.workspace_id ||
    artifact.bucket_id !== "hq-materials" ||
    artifact.storage_path !==
      `${material.workspace_id}/${material.id}/${artifact.sha256}.${artifact.format}`
  )
    throw new Error(
      "This file does not belong to the selected material version.",
    );
  const { data, error } = await client.storage
    .from("hq-materials")
    .download(artifact.storage_path);
  if (error || !data)
    throw new Error("The exact file could not be loaded. Please retry.");
  const bytes = await data.arrayBuffer();
  if (
    bytes.byteLength !== artifact.byte_size ||
    (await digest(bytes)) !== artifact.sha256
  )
    throw new Error(
      "File verification failed. Download is unavailable until the recorded artifact is corrected.",
    );
  return new Blob([bytes], {
    type:
      artifact.format === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}
export function materialFilename(material: Material, format: "pdf" | "docx") {
  return `${material.material_type.replace(/[^a-zA-Z0-9_-]/g, "_")}-v${material.version_number}-${material.id}.${format}`;
}
