// Bind already rendered/QA-passed local files to an exact draft Material.
// This helper does not render, approve, publish, submit, or access the network.
import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { uuid } from "./intake-contract.ts";
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
async function bounded(path: string) {
  const s = await stat(path);
  if (!s.isFile() || s.size < 1 || s.size > 16777216)
    throw new Error("Artifact file must be 1–16 MB");
  return readFile(path);
}
export async function materialManifest(
  context: {
    material: {
      id: string;
      workspace_id: string;
      material_type: string;
      status: string;
      is_current_package_version: boolean;
    };
    renderer_key: string;
  },
  input: Uint8Array,
  docx: Uint8Array,
  pdf: Uint8Array,
  qa: {
    renderer_key: string;
    input_sha256: string;
    docx_sha256: string;
    pdf_sha256: string;
    visual_pass: boolean;
    parse_back_pass: boolean;
    page_count: number;
  },
) {
  const m = context.material,
    ih = sha(input),
    dh = sha(docx),
    ph = sha(pdf);
  if (
    !uuid(m.id) ||
    !uuid(m.workspace_id) ||
    m.status !== "draft" ||
    !m.is_current_package_version
  )
    throw new Error("Select the exact current draft Material");
  if (
    docx[0] !== 80 ||
    docx[1] !== 75 ||
    new TextDecoder().decode(pdf.subarray(0, 5)) !== "%PDF-"
  )
    throw new Error("Expected final DOCX and PDF files");
  if (
    qa.visual_pass !== true ||
    qa.parse_back_pass !== true ||
    !Number.isInteger(qa.page_count) ||
    qa.page_count < 1 ||
    qa.page_count > 20 ||
    qa.renderer_key !== context.renderer_key ||
    qa.input_sha256 !== ih ||
    qa.docx_sha256 !== dh ||
    qa.pdf_sha256 !== ph
  )
    throw new Error("QA must attest to these exact input, DOCX and PDF bytes");
  if (
    m.material_type === "resume" &&
    (context.renderer_key !== "executive-brief-two-page-v2" ||
      qa.page_count !== 2)
  )
    throw new Error("Use the canonical two-page renderer");
  return (["docx", "pdf"] as const).map((format) => ({
    workspace_id: m.workspace_id,
    application_material_id: m.id,
    format,
    bucket_id: "hq-materials" as const,
    storage_path: `${m.workspace_id}/${m.id}/${format === "docx" ? dh : ph}.${format}`,
    sha256: format === "docx" ? dh : ph,
    byte_size: format === "docx" ? docx.byteLength : pdf.byteLength,
    renderer_key: context.renderer_key,
    input_sha256: ih,
    source_docx_sha256: dh,
    qa,
  }));
}
if (
  process.argv[1] &&
  import.meta.url === new URL("file://" + process.argv[1]).href
) {
  try {
    const [contextPath, inputPath, docxPath, pdfPath, qaPath] =
      process.argv.slice(2);
    if (!qaPath)
      throw new Error(
        "Usage: material-artifacts.mts context.json renderer-input.json final.docx final.pdf qa.json",
      );
    const [context, input, docx, pdf, qa] = await Promise.all([
      bounded(contextPath),
      bounded(inputPath),
      bounded(docxPath),
      bounded(pdfPath),
      bounded(qaPath),
    ]);
    process.stdout.write(
      JSON.stringify(
        await materialManifest(
          JSON.parse(context.toString()),
          input,
          docx,
          pdf,
          JSON.parse(qa.toString()),
        ),
      ) + "\n",
    );
  } catch (e) {
    process.stderr.write(
      (e instanceof Error ? e.message : "Invalid artifact inputs") + "\n",
    );
    process.exitCode = 1;
  }
}
