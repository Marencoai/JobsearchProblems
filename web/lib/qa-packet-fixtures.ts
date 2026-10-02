// Synthetic-only fixtures; never used for authenticated data or worker results.
import type { WorkspaceData } from "./types";
export function addSyntheticPacket(data: WorkspaceData) {
  const source = data.materials[0],
    pkg = data.packages.find((p) => p.id === "package-approved")!;
  const requirements = {
    contract_version: 1,
    form_inspected: true,
    apply_url: "https://example.invalid/ats/operations-role",
    ats_provider: "Synthetic employer form",
    attachments: [
      { material_type: "resume", required: true },
      { material_type: "cover_letter", required: false },
    ],
    fields: [
      {
        key: "salary",
        label: "Salary response",
        required: true,
        sensitive: false,
      },
      {
        key: "work_auth",
        label: "Work authorization",
        required: true,
        sensitive: false,
      },
      {
        key: "portfolio",
        label: "Portfolio",
        required: false,
        sensitive: false,
      },
      {
        key: "voluntary",
        label: "Voluntary demographic question",
        required: false,
        sensitive: true,
      },
    ],
  };
  const answers = {
    contract_version: 1,
    requirements_material_id: "qa-requirements",
    answers: [
      {
        field_key: "salary",
        state: "confirmed",
        value: "Synthetic QA response: compensation depends on the role scope.",
      },
      {
        field_key: "work_auth",
        state: "confirmed",
        value: "Synthetic QA work-authorization response; not candidate facts.",
      },
      {
        field_key: "portfolio",
        state: "confirmed",
        value: "https://example.invalid/portfolio",
      },
      { field_key: "voluntary", state: "voluntary", value: null },
    ],
  };
  const entries = [
    [
      "qa-resume",
      "resume",
      "Synthetic approved resume; file transport fixture only.",
    ],
    [
      "qa-cover-letter",
      "cover_letter",
      "Synthetic approved cover letter. Not candidate content.",
    ],
    [
      "qa-requirements",
      "application_requirements",
      JSON.stringify(requirements),
    ],
    ["qa-answers", "application_answers", JSON.stringify(answers)],
    [
      "qa-skills",
      "skills_list",
      "Process design\nProgram delivery\nWorkflow improvement",
    ],
  ];
  data.materials.push(
    ...entries.map(([id, material_type, content_text]) => ({
      ...source,
      id,
      material_type,
      content_text,
      application_package_id: pkg.id,
      status: "approved",
      is_current_package_version: true,
    })),
  );
  return { requirements, answers };
}
