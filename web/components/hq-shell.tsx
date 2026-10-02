"use client";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  Bookmark,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileText,
  History,
  LogOut,
  MapPin,
  Menu,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  Trophy,
  Users,
  X,
} from "lucide-react";
import type {
  Identity,
  JobView,
  Material,
  Stage,
  WorkspaceData,
} from "@/lib/types";
import { STAGES } from "@/lib/types";
import { buildJobViews } from "@/lib/workflow";
import { age, date, humanText, initials, label, safeUrl } from "@/lib/format";
import { HumanActions } from "./human-actions";
import type { HumanActionHandler } from "@/lib/human-actions";
import type { OutreachHandler } from "@/lib/outreach";
import type { OutreachData } from "@/lib/outreach-types";
import { OutreachPanel } from "./outreach-panel";

type ShellProps = {
  identity: Identity;
  data: WorkspaceData | null;
  workspaceId: string;
  selectedId?: string;
  loading: boolean;
  error: string;
  onWorkspace: (id: string) => void;
  onReload: () => void;
  onSignOut: () => void;
  fixture?: boolean;
  onAction?: HumanActionHandler;
  onOutreach?: OutreachHandler;
};
const stageIcons = [
  Target,
  BriefcaseBusiness,
  FileText,
  Bookmark,
  MessageSquare,
  Users,
  Trophy,
];
function subscribeToMobile(listener: () => void) {
  const media = window.matchMedia?.("(max-width: 760px)");
  media?.addEventListener("change", listener);
  return () => media?.removeEventListener("change", listener);
}
function mobileSnapshot() {
  return window.matchMedia?.("(max-width: 760px)").matches ?? false;
}
export function HqShell(props: ShellProps) {
  const { identity, data, workspaceId, loading, error } = props;
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Stage[]>([]);
  const [expanded, setExpanded] = useState<Stage[]>([]);
  const [history, setHistory] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobile = useSyncExternalStore(
    subscribeToMobile,
    mobileSnapshot,
    () => false,
  );
  const sidebar = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    sidebar.current?.querySelector<HTMLButtonElement>(".mobile-close")?.focus();
    return () => previous?.focus();
  }, [mobileOpen]);
  const jobs = useMemo(() => (data ? buildJobViews(data) : []), [data]);
  const selected = props.selectedId
    ? jobs.find((j) => j.opportunity.id === props.selectedId)
    : (jobs.find((j) => j.stage !== null) ?? jobs[0]);
  const visible = jobs.filter((j) =>
    `${j.opportunity.title} ${j.company?.name ?? ""} ${j.opportunity.location_text ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase().trim()),
  );
  const currentWorkspace = identity.workspaces.find(
    (w) => w.id === workspaceId,
  );
  const roleId = identity.memberships.find(
    (m) => m.workspace_id === workspaceId,
  )?.role_id;
  const role = identity.roles.find((r) => r.id === roleId)?.name ?? "Member";
  const jobLink = (id: string) =>
    props.fixture
      ? `/qa?job=${encodeURIComponent(id)}${props.onAction ? "&actions=1" : ""}${data?.outreach ? "&outreach=1" : ""}`
      : `/jobs/${encodeURIComponent(id)}`;
  return (
    <div className="app-shell">
      <aside
        ref={sidebar}
        className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}
        aria-label="Job pipeline"
        role={mobile ? "dialog" : undefined}
        aria-modal={mobile && mobileOpen ? true : undefined}
        aria-hidden={mobile && !mobileOpen ? true : undefined}
        inert={mobile && !mobileOpen}
        onKeyDown={(e) => {
          if (!mobileOpen) return;
          if (e.key === "Escape") setMobileOpen(false);
          if (e.key === "Tab") {
            const nodes = [
              ...(sidebar.current?.querySelectorAll<HTMLElement>(
                "button:not(:disabled),a[href],input",
              ) ?? []),
            ];
            const first = nodes[0];
            const last = nodes.at(-1);
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <div className="brand">
          <Link href={props.fixture ? "/qa" : "/jobs"}>Job Hunt HQ</Link>
          <p>Turn opportunities into outcomes.</p>
          <button
            className="mobile-close icon-button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          >
            <X size={19} />
          </button>
        </div>
        <button
          className="button primary add-job"
          disabled
          title="Job intake will be available in a later phase"
        >
          <Plus size={19} /> Add Job
        </button>
        <label className="search sidebar-search">
          <Search size={16} />
          <input
            aria-label="Search pipeline"
            placeholder="Search jobs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <nav className="pipeline">
          {STAGES.map((stage, index) => {
            const Icon = stageIcons[index];
            const group = visible.filter((j) => j.stage === stage);
            const closed =
              collapsed.includes(stage) ||
              (!expanded.includes(stage) &&
                stage !== (selected?.stage ?? "Evaluate"));
            return (
              <section key={stage} className="pipeline-group">
                <button
                  className="stage-group"
                  aria-expanded={!closed}
                  onClick={() => {
                    setCollapsed((old) =>
                      closed ? old.filter((s) => s !== stage) : [...old, stage],
                    );
                    setExpanded((old) =>
                      closed ? [...old, stage] : old.filter((s) => s !== stage),
                    );
                  }}
                >
                  <span className={`stage-icon color-${index}`}>
                    <Icon size={12} />
                  </span>
                  <strong>{stage}</strong>
                  <span className="count">{group.length}</span>
                  {closed ? (
                    <ChevronRight size={14} />
                  ) : (
                    <ChevronDown size={14} />
                  )}
                </button>
                {!closed && (
                  <div className="job-list">
                    {group.map((job) => (
                      <Link
                        key={job.opportunity.id}
                        href={jobLink(job.opportunity.id)}
                        aria-current={
                          selected?.opportunity.id === job.opportunity.id
                            ? "page"
                            : undefined
                        }
                        className="job-link"
                        onClick={() => setMobileOpen(false)}
                      >
                        <span className="job-link-title">
                          {job.opportunity.title}
                        </span>
                        <span>
                          {job.company?.name ?? "Company not recorded"}
                        </span>
                        <span className="job-next">{job.nextAction}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
          <button
            className="history-toggle"
            aria-expanded={history}
            onClick={() => setHistory(!history)}
          >
            <History size={16} /> History
            <span className="count">
              {visible.filter((j) => !j.stage).length}
            </span>
            {history ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {history && (
            <div className="job-list">
              {visible
                .filter((j) => !j.stage)
                .map((job) => (
                  <Link
                    key={job.opportunity.id}
                    href={jobLink(job.opportunity.id)}
                    className="job-link"
                    aria-current={
                      selected?.opportunity.id === job.opportunity.id
                        ? "page"
                        : undefined
                    }
                    onClick={() => setMobileOpen(false)}
                  >
                    <span className="job-link-title">
                      {job.opportunity.title}
                    </span>
                    <span>{job.company?.name}</span>
                    <span className="job-next">
                      {label(job.opportunity.closed_reason)}
                    </span>
                  </Link>
                ))}
            </div>
          )}
          {search && !visible.length && (
            <p className="sidebar-empty">No jobs match “{search}”.</p>
          )}
        </nav>
        <div className="encouragement">
          <Sun size={25} />
          <h3>You’ve got this.</h3>
          <p>
            Right opportunities.
            <br />
            Real progress.
          </p>
        </div>
      </aside>
      {mobileOpen && (
        <button
          className="nav-scrim"
          aria-label="Close navigation overlay"
          tabIndex={-1}
          onClick={() => setMobileOpen(false)}
        />
      )}
      <div className="main-column" inert={mobile && mobileOpen}>
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={22} />
          </button>
          <label className="search global-search">
            <Search size={18} />
            <input
              aria-label="Search jobs, companies, or locations"
              placeholder="Search jobs, companies, or locations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div className="profile">
            <span className="avatar">{initials(identity.principal.name)}</span>
            <div>
              <strong>{identity.principal.name}</strong>
              <span>Make AI work for the way you work.</span>
            </div>
          </div>
          <button
            className="icon-button"
            aria-label="Sign out"
            title="Sign out"
            onClick={props.onSignOut}
          >
            <LogOut size={17} />
          </button>
        </header>
        <div className="workspace-bar">
          <label className="workspace-picker">
            <span className="sr-only">Workspace</span>
            <select
              aria-label="Workspace"
              value={workspaceId}
              onChange={(e) => props.onWorkspace(e.target.value)}
              disabled={loading}
            >
              {identity.workspaces.map((w) => (
                <option value={w.id} key={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          <span className="access-badge">
            <ShieldCheck size={13} />
            {role} ·{" "}
            {props.onAction || props.onOutreach ? "Human actions" : "Read-only"}
            {props.fixture ? " · QA fixture" : ""}
          </span>
          <button
            className="reload"
            disabled={loading}
            onClick={props.onReload}
          >
            <RefreshCw size={13} className={loading ? "spin" : ""} />
            {loading ? "Loading…" : "Reload data"}
          </button>
        </div>
        <main className="workspace-content" id="main-content">
          {error && (
            <div className="error error-panel" role="alert">
              <strong>We couldn’t load this workspace.</strong>
              <p>{error}</p>
              <button className="button" onClick={props.onReload}>
                Retry
              </button>
            </div>
          )}
          {loading && (
            <div className="loading-state" role="status">
              <div className="skeleton" />
              <h2>Loading your workspace</h2>
              <p>Reading your authenticated data…</p>
            </div>
          )}
          {!loading && !error && !selected && (
            <Empty
              title={
                props.selectedId
                  ? "This opportunity isn’t visible in this workspace"
                  : "Your workspace is ready"
              }
              text={
                props.selectedId
                  ? "Choose an opportunity from the pipeline, or switch to a workspace you can access."
                  : data
                    ? "No opportunities are recorded here yet."
                    : "Workspace data is not available."
              }
            />
          )}
          {!loading && !error && selected && (
            <JobWorkspace
              key={`${workspaceId}:${selected.opportunity.id}`}
              job={selected}
              onAction={props.onAction}
              outreach={data?.outreach}
              tasks={data?.tasks ?? []}
              onOutreach={props.onOutreach}
            />
          )}
          {!loading && data && (
            <footer className="data-footer">
              {currentWorkspace?.name} · {jobs.length}{" "}
              {jobs.length === 1 ? "opportunity" : "opportunities"} ·{" "}
              {identity.email}
            </footer>
          )}
        </main>
      </div>
    </div>
  );
}

export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state">
      <Sparkles size={25} />
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}
function External({
  url,
  children,
}: {
  url?: string | null;
  children: React.ReactNode;
}) {
  const href = safeUrl(url);
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <ArrowUpRight size={13} />
    </a>
  ) : (
    <span className="muted">Not recorded</span>
  );
}
function TextBlock({
  title,
  text,
  icon = false,
}: {
  title: string;
  text?: string | null;
  icon?: boolean;
}) {
  return (
    <section className="text-block">
      {icon && (
        <span className="section-icon">
          <FileText size={19} />
        </span>
      )}
      <div>
        <h3>{title}</h3>
        <p className="preserve-lines">{text || "Not yet recorded."}</p>
      </div>
    </section>
  );
}

function JobWorkspace({
  job,
  onAction,
  outreach,
  tasks,
  onOutreach,
}: {
  job: JobView;
  onAction?: HumanActionHandler;
  outreach?: OutreachData;
  tasks: WorkspaceData["tasks"];
  onOutreach?: OutreachHandler;
}) {
  const [stage, setStage] = useState<Stage>(job.stage ?? "Evaluate");
  const [tab, setTab] = useState("Overview");
  const [material, setMaterial] = useState<Material | null>(null);
  const [jobDescription, setJobDescription] = useState(false);
  const currentIndex = job.stage ? STAGES.indexOf(job.stage) : -1;
  const Icon = stageIcons[STAGES.indexOf(stage)];
  return (
    <>
      <section className="job-header">
        <span className="company-logo">
          {initials(job.company?.name ?? "?")}
        </span>
        <div className="job-heading">
          <h1>{job.opportunity.title}</h1>
          <p className="company-name">
            {job.company?.name ?? "Company not recorded"}
          </p>
          <div className="job-meta">
            <span>
              <MapPin size={15} />
              {job.opportunity.location_text ?? "Location not recorded"}
            </span>
            <span>
              <BriefcaseBusiness size={15} />
              {label(job.opportunity.employment_type)}
            </span>
            <span>
              <Activity size={15} />
              {label(job.opportunity.work_arrangement)}
            </span>
            <span>
              <Clock3 size={15} />
              {job.opportunity.posting_date
                ? `Posted ${age(job.opportunity.posting_date).toLowerCase()}`
                : `First seen ${age(job.opportunity.first_discovered_at).toLowerCase()}`}
            </span>
          </div>
        </div>
        <button
          className="button save"
          disabled
          title={
            onAction
              ? "Use Save for later in Evaluate while a decision is open"
              : "Saving is unavailable in the read-only preview"
          }
        >
          <Bookmark size={15} />
          Save
        </button>
      </section>
      {!job.stage && (
        <div className="history-banner">
          <History size={16} />
          Historical opportunity · {label(job.opportunity.closed_reason)}. All
          recorded stages remain available to inspect.
        </div>
      )}
      <nav className="stage-stepper" aria-label="Opportunity stages">
        {STAGES.map((item, index) => (
          <button
            key={item}
            className={`${item === stage ? "selected" : ""} ${index < currentIndex ? "past" : ""}`}
            onClick={() => {
              setStage(item);
              setTab("Overview");
            }}
            aria-current={item === stage ? "step" : undefined}
            aria-label={`${item}${item === job.stage ? ", current stage" : ""}`}
          >
            <span className="step-dot">
              {index < currentIndex ? (
                <Check size={12} />
              ) : item === stage ? (
                <span />
              ) : null}
            </span>
            <span>{item}</span>
            {item === job.stage && (
              <span className="sr-only">Current stage</span>
            )}
          </button>
        ))}
      </nav>
      <div className="workspace-grid">
        <article className="stage-panel">
          <div className="stage-title">
            <div>
              <h2>{stage}</h2>
              <p>
                {stage === "Evaluate"
                  ? "Determine whether this opportunity deserves your time."
                  : stageDescription[stage]}
              </p>
            </div>
            <div
              className={`current-card ${stage !== job.stage ? "viewing" : ""}`}
            >
              <span>
                <Icon size={13} />
                {stage === job.stage ? "Current stage" : "Viewing stage"}
              </span>
              <small>
                {stage === job.stage
                  ? `Next step: ${job.nextAction}`
                  : job.stage
                    ? `Current stage: ${job.stage}`
                    : "Historical opportunity"}
              </small>
            </div>
          </div>
          {stage === "Evaluate" ? (
            <>
              <div className="fit-grid">
                <FitScore
                  score={job.evaluation?.candidate_fit_score}
                  title="You fit them"
                  text="How well your experience and skills match what they need"
                  color="green"
                />
                <FitScore
                  score={job.evaluation?.opportunity_fit_score}
                  title="They fit you"
                  text="How well this opportunity matches your goals and preferences"
                  color="blue"
                />
              </div>
              {job.evaluation && (
                <p className="record-caption">
                  Completed evaluation · Version {job.evaluation.version_number}{" "}
                  · {date(job.evaluation.evaluated_at)}
                </p>
              )}
              {!job.evaluation && (
                <p className="notice">
                  Evaluation is pending. Scores and recommendations appear when
                  the evaluation workflow records them.
                </p>
              )}
              <div
                className="tabs"
                role="tablist"
                aria-label="Evaluation details"
              >
                {["Overview", "Fit Analysis", "Company", "My Take"].map(
                  (item) => (
                    <button
                      role="tab"
                      aria-selected={tab === item}
                      aria-controls="evaluation-content"
                      id={`tab-${item.replaceAll(" ", "-")}`}
                      tabIndex={tab === item ? 0 : -1}
                      key={item}
                      onClick={() => setTab(item)}
                      onKeyDown={(e) => {
                        const options = [
                          "Overview",
                          "Fit Analysis",
                          "Company",
                          "My Take",
                        ];
                        const index = options.indexOf(item);
                        if (
                          ["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                            e.key,
                          )
                        ) {
                          e.preventDefault();
                          const next =
                            e.key === "Home"
                              ? 0
                              : e.key === "End"
                                ? 3
                                : (index +
                                    (e.key === "ArrowRight" ? 1 : -1) +
                                    4) %
                                  4;
                          setTab(options[next]);
                          document
                            .getElementById(
                              `tab-${options[next].replaceAll(" ", "-")}`,
                            )
                            ?.focus();
                        }
                      }}
                    >
                      {item}
                    </button>
                  ),
                )}
              </div>
              <div
                className="evaluation-content"
                role="tabpanel"
                id="evaluation-content"
                aria-labelledby={`tab-${tab.replaceAll(" ", "-")}`}
              >
                {tab === "Overview" && (
                  <>
                    <TextBlock
                      icon
                      title="Plain-English job translation"
                      text={job.evaluation?.problem_translation}
                    />
                    <TextBlock
                      icon
                      title="What they actually need"
                      text={job.evaluation?.problem_fit_summary}
                    />
                    <div className="reasons-grid">
                      <section className="reason pursue">
                        <h3>
                          <Check size={17} />
                          Reasons to pursue
                        </h3>
                        <p className="preserve-lines">
                          {job.evaluation?.strengths_summary ??
                            "No strengths recorded yet."}
                        </p>
                      </section>
                      <section className="reason hesitate">
                        <h3>
                          <X size={17} />
                          Reasons to hesitate
                        </h3>
                        <p className="preserve-lines">
                          {job.evaluation?.tradeoffs_summary ??
                            "No tradeoffs recorded yet."}
                        </p>
                      </section>
                    </div>
                  </>
                )}
                {tab === "Fit Analysis" && (
                  <>
                    <TextBlock
                      title="Problem fit"
                      text={job.evaluation?.problem_fit_summary}
                    />
                    <p className="record-caption">
                      Evidence confidence:{" "}
                      {label(job.evaluation?.evidence_confidence)} ·{" "}
                      {job.evaluation
                        ? `Evaluation version ${job.evaluation.version_number} · ${date(job.evaluation.evaluated_at)}`
                        : "No completed evaluation"}
                    </p>
                    <h3 className="section-heading">Supporting evidence</h3>
                    {job.evidence.length ? (
                      job.evidence.map((e) => (
                        <section className="evidence-card" key={e.id}>
                          <div className="item-title">
                            <h4>
                              {humanText(e.evidence_snapshot) ??
                                label(e.evidence_role)}
                            </h4>
                            <span className="tag">
                              {label(e.confidence_level)}
                            </span>
                          </div>
                          <p>
                            {e.relevance_summary ??
                              "No relevance summary recorded."}
                          </p>
                          <small>{label(e.evidence_role)}</small>
                        </section>
                      ))
                    ) : (
                      <p className="muted">No supporting evidence recorded.</p>
                    )}
                    <h3 className="section-heading">Application gaps</h3>
                    {job.gaps.length ? (
                      job.gaps.map((g) => (
                        <section className="evidence-card" key={g.id}>
                          <div className="item-title">
                            <h4>{label(g.gap_type)}</h4>
                            <span className="tag">
                              {label(g.resolution_status)}
                            </span>
                          </div>
                          <p>{g.description}</p>
                          <small>
                            {label(g.severity)} · {label(g.blocking_status)}
                          </small>
                          {g.resolution_notes && <p>{g.resolution_notes}</p>}
                        </section>
                      ))
                    ) : (
                      <p className="muted">
                        No gaps recorded for this evaluation.
                      </p>
                    )}
                    <TextBlock
                      title="Questions to resolve"
                      text={job.evaluation?.unresolved_questions}
                    />
                  </>
                )}
                {tab === "Company" && (
                  <>
                    <TextBlock
                      title="Company fit"
                      text={job.evaluation?.company_fit_summary}
                    />
                    <h3 className="section-heading">
                      Research used in this evaluation
                    </h3>
                    {job.evaluationIntelligence.length ? (
                      job.evaluationIntelligence.map((i) => (
                        <section className="evidence-card" key={i.id}>
                          <h4>
                            {humanText(i.intelligence_snapshot) ??
                              "Company research"}
                          </h4>
                          <p>
                            {i.relevance_summary ??
                              "No relevance summary recorded."}
                          </p>
                        </section>
                      ))
                    ) : (
                      <p className="muted">
                        No company research snapshots linked to this evaluation.
                      </p>
                    )}
                  </>
                )}
                {tab === "My Take" && (
                  <>
                    <TextBlock
                      title="Career optionality"
                      text={job.evaluation?.career_optionality_summary}
                    />
                    <TextBlock
                      title="Recorded recommendation"
                      text={label(job.evaluation?.recommended_next_action)}
                    />
                    <TextBlock
                      title="Candidate notes"
                      text={job.package?.candidate_notes}
                    />
                    <p className="notice">
                      Recommendations inform your decision. Only your explicit
                      pursuit decision authorizes application preparation.
                    </p>
                  </>
                )}
              </div>
              {onAction ? (
                <HumanActions job={job} stage={stage} onAction={onAction} />
              ) : (
                <div className="decision-actions">
                  <button
                    className="button success"
                    disabled
                    title="Pursuit decisions are unavailable in Phase 1"
                  >
                    <Check size={17} />
                    <span>
                      <strong>Pursue</strong>
                      <small>Move to strategy and positioning</small>
                    </span>
                  </button>
                  <button
                    className="button danger"
                    disabled
                    title="Passing is unavailable in Phase 1"
                  >
                    <X size={17} />
                    <span>
                      <strong>Pass</strong>
                      <small>Not the right opportunity</small>
                    </span>
                  </button>
                  <button
                    className="button"
                    disabled
                    title="Saving is unavailable in Phase 1"
                  >
                    <Bookmark size={16} />
                    Save for later
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              {stage === "Outreach" && outreach ? (
                <OutreachPanel
                  job={job}
                  data={outreach}
                  tasks={tasks}
                  onAction={onOutreach}
                />
              ) : (
                <StageRecords
                  stage={stage}
                  job={job}
                  onMaterial={setMaterial}
                  humanActions={!!onAction}
                />
              )}
              {onAction && (
                <HumanActions job={job} stage={stage} onAction={onAction} />
              )}
            </>
          )}
          <details
            className="job-description"
            open={jobDescription}
            onToggle={(e) => setJobDescription(e.currentTarget.open)}
          >
            <summary>Original job description</summary>
            <div className="preserve-lines">
              {job.opportunity.job_description_text ??
                "No job description recorded."}
            </div>
          </details>
          <p className="record-caption panel-caption">
            Backend lifecycle: {label(job.opportunity.opportunity_stage)} ·
            {onAction || onOutreach
              ? "Candidate workspace"
              : "Read-only preview"}
          </p>
        </article>
        <IntelligencePanel job={job} />
      </div>
      {material && (
        <MaterialDialog material={material} onClose={() => setMaterial(null)} />
      )}
    </>
  );
}
const stageDescription: Record<Exclude<Stage, "Evaluate">, string> = {
  Pursue: "Your recorded strategy and preparation progress.",
  Resume: "Review recorded material versions and package status.",
  Application:
    "Keep the submitted application and its exact materials in view.",
  Outreach: "Inspect recorded outreach activity and next actions.",
  Interview: "Inspect interview updates and preparation activity.",
  Offer: "Review recorded offer activity and outstanding decisions.",
};
export function FitScore({
  score,
  title,
  text,
  color,
}: {
  score?: number | null;
  title: string;
  text: string;
  color: string;
}) {
  const valid =
    typeof score === "number" &&
    Number.isFinite(score) &&
    score >= 0 &&
    score <= 100;
  return (
    <div className={`fit-card ${color}`}>
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
      <div
        className="score-ring"
        role="img"
        aria-label={`${title}: ${valid ? `${score} out of 100` : "score not recorded"}`}
      >
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle className="ring-track" cx="50" cy="50" r="42" />
          <circle
            className="ring-fill"
            cx="50"
            cy="50"
            r="42"
            pathLength="100"
            strokeDasharray={`${valid ? score : 0} 100`}
          />
        </svg>
        <strong>{valid ? score : "—"}</strong>
      </div>
    </div>
  );
}
function StageRecords({
  stage,
  job,
  onMaterial,
  humanActions,
}: {
  stage: Stage;
  job: JobView;
  onMaterial: (material: Material) => void;
  humanActions: boolean;
}) {
  if (stage === "Pursue")
    return (
      <div className="stage-records">
        <TextBlock
          title="Strategy and positioning"
          text={job.evaluation?.problem_fit_summary}
        />
        <TextBlock
          title="Your strongest evidence"
          text={job.evaluation?.strengths_summary}
        />
        <TextBlock
          title="Tradeoffs to address"
          text={job.evaluation?.tradeoffs_summary}
        />
        <PackageSummary job={job} />
        <p className="notice">
          {humanActions
            ? "Your application worker prepares the materials. Its recorded results appear here."
            : "Preparation belongs to the existing application workflow. This preview displays its recorded results."}
        </p>
        <EventList job={job} />
      </div>
    );
  if (stage === "Resume")
    return (
      <div className="stage-records">
        <PackageSummary job={job} />
        <h3 className="section-heading">Application materials</h3>
        {job.materials.length ? (
          job.materials.map((m) => (
            <button
              className="material-row"
              key={m.id}
              onClick={() => onMaterial(m)}
            >
              <span className="section-icon">
                <FileText size={18} />
              </span>
              <span>
                <strong>{label(m.material_type)}</strong>
                <small>
                  Package{" "}
                  {job.packages.find((p) => p.id === m.application_package_id)
                    ?.package_number ?? "—"}{" "}
                  · Version {m.version_number} · {label(m.status)}
                  {m.is_current_package_version
                    ? " · Current package version"
                    : " · Historical version"}
                </small>
              </span>
              <ChevronRight size={17} />
            </button>
          ))
        ) : (
          <Empty
            title="No materials recorded yet"
            text="Resume and application materials will appear when preparation records them."
          />
        )}
        <p className="notice">
          Material approval and revision requests become available with the
          human action workflow in a later phase.
        </p>
      </div>
    );
  if (stage === "Application")
    return (
      <div className="stage-records">
        <PackageSummary job={job} />
        {job.applications.length ? (
          job.applications.map((app) => (
            <section className="application-card" key={app.id}>
              <div className="item-title">
                <h3>Attempt {app.attempt_number}</h3>
                <span className="tag">{label(app.application_stage)}</span>
              </div>
              <dl className="facts">
                <div>
                  <dt>Submitted</dt>
                  <dd>{date(app.submitted_at)}</dd>
                </div>
                <div>
                  <dt>Confirmed</dt>
                  <dd>{date(app.confirmed_at)}</dd>
                </div>
                <div>
                  <dt>Method</dt>
                  <dd>{label(app.submission_method)}</dd>
                </div>
                <div>
                  <dt>Confirmation</dt>
                  <dd>
                    {app.confirmation_reference ?? label(app.confirmation_type)}
                  </dd>
                </div>
              </dl>
              {app.notes && <p className="preserve-lines">{app.notes}</p>}
              <External url={app.application_url}>
                Open application site
              </External>
              <h4>Exact submitted materials</h4>
              {job.submittedMaterials
                .filter((m) => m.application_id === app.id)
                .map((m) => (
                  <details className="snapshot" key={m.id}>
                    <summary>
                      {label(m.material_type)} · submitted{" "}
                      {date(m.submitted_at)}
                    </summary>
                    <p>
                      {snapshotText(m.submitted_material_snapshot) ??
                        "A submission snapshot exists, but no text preview is recorded."}
                    </p>
                  </details>
                ))}
              {!job.submittedMaterials.some(
                (m) => m.application_id === app.id,
              ) && (
                <p className="muted">
                  No submitted material snapshots recorded for this attempt.
                </p>
              )}
            </section>
          ))
        ) : (
          <Empty
            title="No application recorded"
            text="An application appears only when its workflow records an attempt. Opening a site never marks it submitted."
          />
        )}
        <p className="notice">
          {humanActions
            ? "After completing the employer application, confirm the exact materials you submitted here."
            : "Submission remains an explicit human confirmation. This preview cannot submit or confirm an application."}
        </p>
      </div>
    );
  return (
    <div className="stage-records">
      <div className="notice">
        {stage} is a derived view of the existing lifecycle and recorded
        activity. Structured {stage.toLowerCase()} records will be introduced
        after their schema review.
      </div>
      <TextBlock
        title="Current next action"
        text={
          job.stage === stage
            ? job.nextAction
            : `No current ${stage.toLowerCase()} action recorded.`
        }
      />
      <EventList job={job} filter={stage.toLowerCase()} />
    </div>
  );
}
function PackageSummary({ job }: { job: JobView }) {
  return (
    <section className="package-summary">
      <div className="item-title">
        <h3>Application package</h3>
        <span className="tag">{label(job.package?.status)}</span>
      </div>
      {job.package ? (
        <p>
          Package {job.package.package_number} · Updated{" "}
          {date(job.package.updated_at)}
          {job.package.approved_at
            ? ` · Approved ${date(job.package.approved_at)}`
            : ""}
        </p>
      ) : (
        <p className="muted">No application package recorded.</p>
      )}
      {job.package?.candidate_notes && <p>{job.package.candidate_notes}</p>}
    </section>
  );
}
function EventList({ job, filter }: { job: JobView; filter?: string }) {
  const events = filter
    ? job.activities.filter((e) => e.event_type.includes(filter))
    : job.activities;
  return (
    <section className="timeline">
      <h3 className="section-heading">Recorded activity</h3>
      {events.length ? (
        events.map((event) => (
          <div className="timeline-item" key={event.id}>
            <span className="timeline-dot" />
            <div>
              <strong>{label(event.event_type)}</strong>
              <p>{event.summary ?? "No summary recorded."}</p>
              <small>
                {date(event.event_timestamp)} · {label(event.source_system)}
              </small>
            </div>
          </div>
        ))
      ) : (
        <p className="muted">
          No {filter ? `${filter} ` : ""}activity recorded for this opportunity.
        </p>
      )}
    </section>
  );
}
function snapshotText(snapshot: unknown): string | undefined {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot))
    return;
  const text = (snapshot as Record<string, unknown>).content_text;
  return typeof text === "string" ? text : humanText(snapshot);
}
function MaterialDialog({
  material,
  onClose,
}: {
  material: Material;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => previous?.focus();
  }, []);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <dialog
        ref={dialog}
        open
        aria-modal="true"
        className="material-dialog"
        aria-labelledby="material-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Tab") {
            const focusable = [
              ...(dialog.current?.querySelectorAll<HTMLElement>(
                "button,a[href]",
              ) ?? []),
            ];
            const first = focusable[0];
            const last = focusable.at(-1);
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <div className="modal-header">
          <div>
            <h2 id="material-title">{label(material.material_type)}</h2>
            <p>
              Version {material.version_number} · {label(material.status)}
            </p>
          </div>
          <button
            className="icon-button"
            aria-label="Close material preview"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <div className="material-content preserve-lines">
          {material.content_text ??
            "No text preview recorded for this material."}
        </div>
        <div className="modal-footer">
          <External url={material.file_url}>Open recorded artifact</External>
          <button className="button" onClick={onClose}>
            Done
          </button>
        </div>
      </dialog>
    </div>
  );
}
function IntelligencePanel({ job }: { job: JobView }) {
  const intel = [...job.intelligence].sort((a, b) =>
    b.researched_at.localeCompare(a.researched_at),
  );
  const sources = [...job.sources].sort((a, b) =>
    b.discovered_at.localeCompare(a.discovered_at),
  );
  return (
    <aside className="intelligence-panel" aria-label="Opportunity intelligence">
      <div className="intelligence-heading">
        <h2>
          <Activity size={19} />
          Opportunity Intelligence
        </h2>
        <button
          className="button research-refresh"
          disabled
          title="Research refresh must be queued through the worker workflow in a later phase"
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>
      <section className="intelligence-card">
        <h3>Company snapshot</h3>
        <div className="company-snapshot">
          <span className="company-logo small">
            {initials(job.company?.name ?? "?")}
          </span>
          <div>
            <strong>{job.company?.name ?? "Company not recorded"}</strong>
            <p>{job.company?.industry ?? "Industry not recorded"}</p>
          </div>
        </div>
        <dl className="facts">
          <div>
            <dt>Headquarters</dt>
            <dd>{job.company?.headquarters_location ?? "Not recorded"}</dd>
          </div>
          <div>
            <dt>Company size</dt>
            <dd>{job.company?.company_size ?? "Not recorded"}</dd>
          </div>
          <div>
            <dt>Industry</dt>
            <dd>{job.company?.industry ?? "Not recorded"}</dd>
          </div>
          <div>
            <dt>Website</dt>
            <dd>
              <External url={job.company?.website_url}>
                Company website
              </External>
            </dd>
          </div>
        </dl>
      </section>
      <section className="intelligence-card">
        <h3>Requisition details</h3>
        <dl className="facts">
          <div>
            <dt>First seen</dt>
            <dd>{date(job.opportunity.first_discovered_at)}</dd>
          </div>
          <div>
            <dt>Posting age</dt>
            <dd>
              {job.opportunity.posting_date
                ? age(job.opportunity.posting_date)
                : "Not recorded"}
            </dd>
          </div>
          <div>
            <dt>Last verified</dt>
            <dd>{date(job.opportunity.last_verified_at)}</dd>
          </div>
          <div>
            <dt>Requisition</dt>
            <dd>{job.opportunity.requisition_id ?? "Not recorded"}</dd>
          </div>
          <div>
            <dt>Current status</dt>
            <dd>
              <span
                className={`status-dot ${job.opportunity.is_currently_active ? "active" : ""}`}
              />
              {job.opportunity.is_currently_active ? "Active" : "Inactive"}
            </dd>
          </div>
          <div>
            <dt>Closes</dt>
            <dd>{date(job.opportunity.closing_date)}</dd>
          </div>
        </dl>
        <External url={job.opportunity.canonical_url}>
          View original listing
        </External>
      </section>
      <section className="intelligence-card">
        <h3>Listing sources</h3>
        {sources.length ? (
          sources.map((source) => (
            <div className="source-row" key={source.id}>
              <div className="item-title">
                <strong>{label(source.source_type)}</strong>
                <span className="tag">
                  {source.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <p>
                <External url={source.source_url}>View source</External>
              </p>
              <small>
                Checked {date(source.last_checked_at)} · Found{" "}
                {date(source.discovered_at)}
              </small>
            </div>
          ))
        ) : (
          <p className="muted">No listing sources recorded.</p>
        )}
      </section>
      <section className="intelligence-card">
        <h3>Recent company signals</h3>
        {intel.length ? (
          intel.map((item) => (
            <details className="signal" key={item.id}>
              <summary>{item.title ?? label(item.intelligence_type)}</summary>
              <p className="preserve-lines">{item.summary}</p>
              <p>
                <External url={item.source_url}>
                  {item.source_name ?? "View research source"}
                </External>
              </p>
              <small>
                {label(item.evidence_type)} · Confidence:{" "}
                {label(item.confidence_level)} · Researched{" "}
                {date(item.researched_at)}
                {item.expires_at ? ` · Expires ${date(item.expires_at)}` : ""}
              </small>
            </details>
          ))
        ) : (
          <p className="muted">No active company intelligence recorded.</p>
        )}
        <div className="research-freshness">
          <RefreshCw size={16} />
          <div>
            Research freshness
            <small>
              {intel[0]
                ? `Last researched ${age(intel[0].researched_at).toLowerCase()}`
                : "Not yet researched"}
            </small>
          </div>
        </div>
      </section>
    </aside>
  );
}
