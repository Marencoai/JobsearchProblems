import type { InterviewBundle, InterviewService } from "./interview";
export function interviewFixture(): InterviewService {
  const bundle: InterviewBundle = {
    interviews: [
      {
        id: "synthetic-interview",
        workspace_id: "fixture-workspace",
        opportunity_id: "interview",
        interview_type: "Hiring manager",
        stage_name: "Round 2 · Hiring manager",
        scheduled_start_at: "2026-10-05T15:00:00Z",
        scheduled_end_at: "2026-10-05T15:45:00Z",
        meeting_url: "https://example.invalid/meeting",
        format: "Video",
        instructions:
          "Prepare examples of building a repeatable sales process.",
        interview_status: "scheduled",
        preparation_status: "ready",
        updated_at: "2026-10-01T12:00:00Z",
      },
    ],
    preparations: [
      {
        id: "synthetic-preparation",
        interview_id: "synthetic-interview",
        summary: "Discuss how you build pipeline and lead a team.",
        what_they_are_likely_evaluating:
          "Forecast judgment and repeatable execution.",
        company_context: "Synthetic employer expanding into a new segment.",
        interviewer_research: "Interviewer research not yet verified.",
        research_as_of: "2026-10-01T12:00:00Z",
        known_risks: "Ask how territories are allocated.",
        candidate_questions: "What distinguishes a strong first 90 days?",
        status: "draft",
        updated_at: "2026-10-01T12:00:00Z",
      },
    ],
    questions: [
      {
        id: "synthetic-question",
        interview_id: "synthetic-interview",
        interview_preparation_id: "synthetic-preparation",
        question_text: "Tell me about a pipeline you rebuilt.",
        question_source: "predicted",
        what_they_are_evaluating: "Diagnosis and operating cadence.",
      },
    ],
    evidence: [
      {
        id: "synthetic-evidence",
        interview_question_id: "synthetic-question",
        evidence_story_id: "synthetic-story",
        project_id: null,
        skill_id: null,
        relevance_summary:
          "Use your synthetic turnaround story: diagnosis, actions and measurable results.",
      },
    ],
    people: [
      {
        interview_id: "synthetic-interview",
        contact_id: "synthetic-contact",
        interviewer_role: "Hiring manager",
        name: "Alex Example",
        title: "VP Sales",
      },
    ],
  };
  return {
    load: async () => structuredClone(bundle),
    start: async () => {},
    save: async (_job, _interview, prep, input) => {
      for (const q of input.questions ?? []) {
        const id = crypto.randomUUID();
        bundle.questions.push({
          id,
          interview_id: prep.interview_id,
          interview_preparation_id: prep.id,
          question_text: q.question_text,
          question_source: q.question_source,
          what_they_are_evaluating: null,
        });
        if (q.evidence_story_id || q.project_id || q.skill_id)
          bundle.evidence.push({
            id: crypto.randomUUID(),
            interview_question_id: id,
            evidence_story_id: q.evidence_story_id ?? null,
            project_id: q.project_id ?? null,
            skill_id: q.skill_id ?? null,
            relevance_summary: q.relevance_summary ?? null,
          });
      }
      Object.assign(bundle.preparations.find((p) => p.id === prep.id)!, input, {
        status: input.reviewed ? "reviewed" : "ready",
        updated_at: new Date().toISOString(),
      });
    },
  };
}
