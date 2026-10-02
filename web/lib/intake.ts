import type { HqClient } from "./supabase/client";
import {
  INTAKE_LIMIT,
  MIME_EXT,
  validFileSignature,
  validateIntake,
  type IntakeInput,
} from "../../worker-support/intake-contract";
export { MIME_EXT, type IntakeInput };
export type IntakeHandler = (
  input: IntakeInput,
  requestId: string,
) => Promise<void>;
export type IntakeUploadHandler = (
  file: File,
  requestId: string,
) => Promise<IntakeInput>;
export async function digest(bytes: ArrayBuffer): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export async function prepareUpload(
  file: File,
  workspace: string,
  principal: string,
  request: string,
) {
  if (file.size < 1 || file.size > INTAKE_LIMIT || !(file.type in MIME_EXT))
    throw new Error(
      "Choose a PDF, DOCX, PNG, JPEG, or text document up to 8 MB.",
    );
  const bytes = await file.arrayBuffer();
  const mime = file.type as keyof typeof MIME_EXT;
  if (!validFileSignature(new Uint8Array(bytes), mime))
    throw new Error("The file contents do not match its document type.");
  const hash = await digest(bytes);
  const input = validateIntake({
    mode: "upload",
    upload: {
      storage_path: [
        workspace,
        principal,
        request,
        hash + "." + MIME_EXT[mime],
      ].join("/"),
      sha256: hash,
      byte_size: bytes.byteLength,
      mime_type: mime,
      name: file.name,
    },
  });
  return { input, bytes };
}
export async function uploadIntake(
  client: HqClient,
  file: File,
  workspace: string,
  principal: string,
  request: string,
): Promise<IntakeInput> {
  const { input, bytes } = await prepareUpload(
    file,
    workspace,
    principal,
    request,
  );
  if (input.mode !== "upload") throw new Error("Invalid upload");
  const result = await client.storage
    .from("hq-intake")
    .upload(input.upload.storage_path, bytes, {
      contentType: input.upload.mime_type,
      upsert: false,
      cacheControl: "0",
    });
  if (result.error) {
    // An uncertain first upload may already exist. Never overwrite it; verify
    // its exact bytes under authenticated RLS before reusing the same request.
    const prior = await client.storage
      .from("hq-intake")
      .download(input.upload.storage_path);
    if (
      prior.error ||
      !prior.data ||
      (await digest(await prior.data.arrayBuffer())) !== input.upload.sha256
    )
      throw new Error("Upload could not be confirmed. Retry this same file.");
  }
  return input;
}
export async function requestIntake(
  client: HqClient,
  workspace: string,
  input: IntakeInput,
  request: string,
) {
  const { data, error } = await client.rpc("hq_request_job_intake", {
    target_workspace_id: workspace,
    request_id: request,
    input: validateIntake(input),
  });
  if (error)
    throw new Error(
      error.code === "40001"
        ? "This retry belongs to different evidence. Start a new request."
        : error.code === "42501"
          ? "Your account cannot add a job in this workspace."
          : "The intake request could not be confirmed. Retry this same request safely.",
    );
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    data.command !== "request_job_intake" ||
    typeof data.task_id !== "string"
  )
    throw new Error(
      "The intake request could not be confirmed. Retry this same request safely.",
    );
  return data;
}
