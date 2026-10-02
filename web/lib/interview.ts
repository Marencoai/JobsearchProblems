import type { SupabaseClient } from "@supabase/supabase-js";
import type { HqClient } from "./supabase/client";
import type { JobView } from "./types";

export type Interview = {
  id: string;
  workspace_id: string;
  opportunity_id: string;
  interview_type: string;
  stage_name: string | null;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  meeting_url: string | null;
  format: string | null;
  instructions: string | null;
  interview_status: string;
  preparation_status: string;
  updated_at: string;
};
export type Preparation = {
  id: string;
  interview_id: string;
  summary: string | null;
  what_they_are_likely_evaluating: string | null;
  company_context: string | null;
  interviewer_research: string | null;
  research_as_of: string | null;
  known_risks: string | null;
  candidate_questions: string | null;
  status: string;
  updated_at: string;
};
export type InterviewQuestion = {
  id: string;
  interview_id: string;
  interview_preparation_id: string | null;
  question_text: string;
  question_source: string;
  what_they_are_evaluating: string | null;
};
export type InterviewEvidence = {
  id: string;
  interview_question_id: string;
  evidence_story_id: string | null;
  project_id: string | null;
  skill_id: string | null;
  relevance_summary: string | null;
  story_title?: string;
  story_text?: string;
  validation_status?: string;
};
export type InterviewPerson = {
  interview_id: string;
  contact_id: string;
  interviewer_role: string | null;
  name: string | null;
  title: string | null;
};
export type InterviewBundle = {
  interviews: Interview[];
  preparations: Preparation[];
  questions: InterviewQuestion[];
  evidence: InterviewEvidence[];
  people: InterviewPerson[];
};
export type PrepQuestion = {
  question_text: string;
  question_source: "predicted";
  evidence_story_id?: string;
  project_id?: string;
  skill_id?: string;
  relevance_summary?: string;
};
export type PrepInput = {
  questions?: PrepQuestion[];
  summary: string;
  what_they_are_likely_evaluating: string;
  company_context: string;
  candidate_questions: string;
  known_risks: string;
  reviewed: boolean;
};
export type InterviewService = {
  load: (job: JobView) => Promise<InterviewBundle>;
  start: (
    job: JobView,
    interview: Interview,
    requestId: string,
  ) => Promise<void>;
  save: (
    job: JobView,
    interview: Interview,
    prep: Preparation,
    input: PrepInput,
    requestId: string,
  ) => Promise<void>;
};
export const INTERVIEW_TABLES = [
  "interviews",
  "interview_processes",
  "interview_preparations",
  "interview_questions",
  "interview_question_evidence",
  "interview_contacts",
  "contacts",
  "evidence_stories",
];
export function interviewService(
  client: HqClient,
  workspaceId: () => string,
  reload: () => Promise<void>,
): InterviewService {
  // Proposal types intentionally separate from live generated schema.
  const db = client as unknown as SupabaseClient;
  const read = async <T>(
    table: string,
    field: string,
    ids: string[],
    scope: string,
  ): Promise<T[]> => {
    if (!ids.length) return [];
    const rows: T[] = [];
    for (let from = 0; from < 10000; from += 200) {
      const result = await db
        .from(table)
        .select("*")
        .eq("workspace_id", scope)
        .in(field, ids)
        .order("id")
        .range(from, from + 199);
      if (result.error || !Array.isArray(result.data))
        throw new Error(
          "Interview records could not be loaded. Retry after access and rollout are verified.",
        );
      rows.push(...(result.data as T[]));
      if (result.data.length < 200) return rows;
    }
    throw new Error("Interview records need a more focused query.");
  };
  return {
    async load(job) {
      const scope = workspaceId();
      if (job.opportunity.workspace_id !== scope)
        throw new Error("Interview workspace changed. Reload.");
      const interviews = await read<Interview>(
        "interviews",
        "opportunity_id",
        [job.opportunity.id],
        scope,
      );
      const ids = interviews.map((i) => i.id);
      const [preparations, questions, links] = await Promise.all([
        read<Preparation>("interview_preparations", "interview_id", ids, scope),
        read<InterviewQuestion>(
          "interview_questions",
          "interview_id",
          ids,
          scope,
        ),
        read<{
          interview_id: string;
          contact_id: string;
          interviewer_role: string | null;
        }>("interview_contacts", "interview_id", ids, scope),
      ]);
      const [evidence, contacts] = await Promise.all([
        read<InterviewEvidence>(
          "interview_question_evidence",
          "interview_question_id",
          questions.map((q) => q.id),
          scope,
        ),
        read<{ id: string; full_name: string; title: string | null }>(
          "contacts",
          "id",
          links.map((l) => l.contact_id),
          scope,
        ),
      ]);
      const stories = await read<{
        id: string;
        title: string;
        situation: string | null;
        actions_taken: string | null;
        outcome: string | null;
        quantitative_impact: string | null;
        validation_status: string;
      }>(
        "evidence_stories",
        "id",
        evidence.flatMap((e) =>
          e.evidence_story_id ? [e.evidence_story_id] : [],
        ),
        scope,
      );
      const enriched = evidence.map((e) => {
        const story = stories.find((s) => s.id === e.evidence_story_id);
        return story
          ? {
              ...e,
              story_title: story.title,
              story_text: [
                story.situation,
                story.actions_taken,
                story.outcome,
                story.quantitative_impact,
              ]
                .filter(Boolean)
                .join(" · "),
              validation_status: story.validation_status,
            }
          : e;
      });
      return {
        interviews,
        preparations,
        questions,
        evidence: enriched,
        people: links.map((l) => ({
          ...l,
          name: contacts.find((c) => c.id === l.contact_id)?.full_name ?? null,
          title: contacts.find((c) => c.id === l.contact_id)?.title ?? null,
        })),
      };
    },
    async save(job, interview, prep, input, requestId) {
      const result = await db.rpc("hq_interview_action", {
        target_workspace_id: workspaceId(),
        target_opportunity_id: job.opportunity.id,
        expected_updated_at: job.opportunity.updated_at,
        request_id: requestId,
        command: "save_prep",
        payload: {
          interview_id: interview.id,
          preparation_id: prep.id,
          preparation_updated_at: prep.updated_at,
          ...input,
        },
      });
      if (result.error || result.data?.interview_id !== interview.id)
        throw new Error(
          "Preparation could not be confirmed. Reload or retry this same request.",
        );
      await reload();
    },
    async start(job, interview, requestId) {
      const result = await db.rpc("hq_interview_action", {
        target_workspace_id: workspaceId(),
        target_opportunity_id: job.opportunity.id,
        expected_updated_at: job.opportunity.updated_at,
        request_id: requestId,
        command: "start_prep",
        payload: {
          interview_id: interview.id,
          interview_updated_at: interview.updated_at,
        },
      });
      if (result.error || result.data?.interview_id !== interview.id)
        throw new Error(
          "Preparation could not be confirmed. Reload or retry this same request.",
        );
      await reload();
    },
  };
}
export function cheatSheet(
  interview: Interview,
  prep: Preparation | undefined,
  questions: InterviewQuestion[],
  evidence: InterviewEvidence[],
  people: InterviewPerson[],
): string {
  const lines = [
    `INTERVIEW CHEAT SHEET`,
    `${interview.stage_name ?? interview.interview_type}`,
    interview.scheduled_start_at ?? "Time not recorded",
    `Interviewers: ${people.map((p) => p.name ?? "Name not recorded").join(", ") || "Not recorded"}`,
    `Purpose: ${prep?.summary ?? "Not recorded"}`,
    `Likely testing: ${prep?.what_they_are_likely_evaluating ?? "Not recorded"}`,
    `Company context: ${prep?.company_context ?? "Not recorded"}`,
    `Research as of: ${prep?.research_as_of ?? "Not recorded"}`,
    `Interviewer research: ${prep?.interviewer_research ?? "Not recorded"}`,
    `Risks: ${prep?.known_risks ?? "Not recorded"}`,
    `Questions to ask: ${prep?.candidate_questions ?? "Not recorded"}`,
  ];
  for (const q of questions.slice(0, 8)) {
    lines.push(`${q.question_source}: ${q.question_text}`);
    for (const e of evidence
      .filter((e) => e.interview_question_id === q.id)
      .slice(0, 2))
      lines.push(
        `Story/evidence: ${e.relevance_summary ?? "See linked knowledge"} ${e.story_title ?? ""} ${e.story_text ?? ""}`,
      );
  }
  return lines
    .map((l) => l.slice(0, 500))
    .join("\n\n")
    .slice(0, 10000);
}
