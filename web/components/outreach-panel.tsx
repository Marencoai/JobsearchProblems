"use client";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  MessageSquare,
  Plus,
  RefreshCw,
  Users,
} from "lucide-react";
import type { JobView, Task } from "@/lib/types";
import type {
  Contact,
  Engagement,
  OutreachData,
  OutreachMessage,
} from "@/lib/outreach-types";
import type {
  OutreachCommand,
  OutreachHandler,
  OutreachPayload,
} from "@/lib/outreach";
import { date, label, initials, safeUrl } from "@/lib/format";

type Review = {
  command: OutreachCommand;
  title: string;
  payload: OutreachPayload;
  message?: OutreachMessage;
  contact?: Contact;
  followUps?: { id: string; message: string }[];
};
function localTime(value = new Date()) {
  return new Date(value.getTime() - value.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
function destination(contact: Contact, channel: string) {
  return channel === "email"
    ? contact.email
    : channel === "linkedin"
      ? contact.linkedin_url
      : ["sms", "phone"].includes(channel)
        ? contact.phone
        : null;
}
export function OutreachPanel({
  job,
  data,
  onAction,
  tasks = [],
}: {
  job: JobView;
  data: OutreachData;
  onAction?: OutreachHandler;
  tasks?: Task[];
}) {
  const role = job.opportunity.id,
    workspace = job.opportunity.workspace_id;
  const [selected, setSelected] = useState("");
  const [general, setGeneral] = useState(false);
  const [review, setReview] = useState<Review | null>(null);
  const [notice, setNotice] = useState("");
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!review) returnFocus.current?.focus();
  }, [review]);
  // Only this role/workspace's contacts are presented; durable history is shared
  // through exact linked engagements, independent of the Opportunity lifecycle.
  const links = data.opportunityContacts.filter(
    (l) => l.workspace_id === workspace && l.opportunity_id === role,
  );
  const contacts = data.contacts.filter(
    (c) =>
      c.workspace_id === workspace &&
      c.status === "active" &&
      (general || links.some((l) => l.contact_id === c.id)),
  );
  const contact =
    contacts.find((c) => c.id === selected) ??
    contacts.find((c) =>
      links.some((l) => l.contact_id === c.id && l.is_primary),
    ) ??
    contacts[0];
  const engagements = data.engagements.filter(
    (e) =>
      e.workspace_id === workspace &&
      e.contact_id === contact?.id &&
      e.status === "active" &&
      (general ||
        data.engagementOpportunities.some(
          (l) =>
            l.workspace_id === workspace &&
            l.outreach_engagement_id === e.id &&
            l.opportunity_id === role &&
            l.is_current,
        )),
  );
  const engagement = engagements[0];
  const followUps = data.taskLinks
    .filter(
      (l) =>
        l.workspace_id === workspace &&
        l.outreach_engagement_id === engagement?.id &&
        l.purpose === "follow_up",
    )
    .flatMap((l) => {
      const task = tasks.find(
        (t) =>
          t.id === l.internal_task_id &&
          !["completed", "cancelled"].includes(t.status),
      );
      return task
        ? [
            {
              id: task.id,
              message:
                data.messages
                  .find(
                    (m) =>
                      m.workspace_id === workspace &&
                      m.id === l.outreach_message_id,
                  )
                  ?.content.slice(0, 80) ?? "Recorded outreach",
            },
          ]
        : [];
    });
  function open(value: Review) {
    returnFocus.current = document.activeElement as HTMLElement;
    setNotice("");
    setReview(value);
  }
  function close() {
    setReview(null);
  }
  const shared = data.engagementOpportunities.filter(
    (l) =>
      l.workspace_id === workspace &&
      l.outreach_engagement_id === engagement?.id &&
      l.is_current &&
      l.opportunity_id !== role,
  );
  return (
    <section className="outreach-panel" aria-label="Outreach workspace">
      <div className="outreach-intro">
        <span className="section-icon blue">
          <Users size={21} />
        </span>
        <div>
          <h3>Build a relationship, one thoughtful step at a time.</h3>
          <p className="muted">
            Choose a person, shape your message, and keep the conversation in
            context.
          </p>
        </div>
      </div>
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      {!onAction && (
        <p className="notice">
          Read-only Outreach. Candidate actions are not enabled for this
          workspace.
        </p>
      )}
      <label>
        Relationship context
        <select
          value={general ? "general" : "role"}
          aria-label="Relationship context"
          onChange={(e) => {
            setGeneral(e.target.value === "general");
            setSelected("");
            setNotice("");
          }}
        >
          <option value="role">This opportunity</option>
          <option value="general">
            General networking · all reusable contacts
          </option>
        </select>
      </label>
      <div className="outreach-grid">
        <aside className="outreach-targets" aria-label="People to contact">
          <div className="outreach-heading">
            <h3>People to contact</h3>
            <span className="count">{contacts.length}</span>
          </div>
          <p className="muted outreach-help">
            Recommendations are starting points. You choose who deserves your
            time.
          </p>
          {contacts.length === 0 && (
            <div className="outreach-empty">
              <Users size={26} />
              <h4>No contacts yet</h4>
              <p>Add someone you know or want to connect with.</p>
            </div>
          )}
          {contacts.map((c) => {
            const link = links.find((l) => l.contact_id === c.id);
            return (
              <article
                className={`contact-card ${c.id === contact?.id ? "selected" : ""}`}
                key={c.id}
              >
                <button
                  className="contact-select"
                  aria-label={`${c.full_name}, ${c.title ?? "Professional contact"}`}
                  onClick={() => {
                    setSelected(c.id);
                    setNotice("");
                  }}
                  aria-pressed={c.id === contact?.id}
                >
                  <span className="contact-avatar">
                    {initials(c.full_name)}
                  </span>
                  <span>
                    <strong>{c.full_name}</strong>
                    <small>{c.title ?? "Title not recorded"}</small>
                  </span>
                </button>
                <span className="contact-tag">
                  {!link
                    ? "Reusable contact"
                    : link.selection_method === "manual"
                      ? "Your selection"
                      : "Recommended"}
                  {link?.is_primary ? " · Primary" : ""}
                </span>
                <p>
                  {link?.relevance ??
                    c.relationship_context ??
                    "A professional relationship that can continue across opportunities."}
                </p>
                <small className="muted">
                  Source: {label(link?.source_system ?? c.source_system)}
                  {link?.source_reference && (
                    <>
                      {" "}
                      ·{" "}
                      {safeUrl(link.source_reference) ? (
                        <a
                          href={safeUrl(link.source_reference)!}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View source <ExternalLink size={12} />
                        </a>
                      ) : (
                        link.source_reference
                      )}
                    </>
                  )}
                </small>
                <div className="outreach-inline">
                  {safeUrl(c.linkedin_url) && (
                    <a
                      href={safeUrl(c.linkedin_url)!}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open profile <ExternalLink size={12} />
                    </a>
                  )}
                  {onAction && link && !link.is_primary && !general && (
                    <button
                      className="text-button"
                      onClick={() =>
                        open({
                          command: "select_primary_contact",
                          title: "Choose primary contact",
                          payload: {
                            opportunity_id: role,
                            contact_id: c.id,
                            relationship_role: link.relationship_role,
                          },
                          contact: c,
                        })
                      }
                    >
                      Make primary
                    </button>
                  )}
                </div>
              </article>
            );
          })}
          {onAction && (
            <button
              className="button outreach-wide"
              onClick={() =>
                open({
                  command: general ? "save_contact" : "add_manual_target",
                  title: "Add a person",
                  payload: general ? {} : { opportunity_id: role },
                })
              }
            >
              <Plus size={16} /> Add a person
            </button>
          )}
          {onAction &&
            data.contacts.some(
              (c) =>
                c.workspace_id === workspace &&
                c.status === "active" &&
                !contacts.some((x) => x.id === c.id),
            ) && (
              <button
                className="text-button"
                onClick={() =>
                  open({
                    command: "link_contact",
                    title: "Use an existing contact",
                    payload: { opportunity_id: role },
                  })
                }
              >
                Use an existing contact
              </button>
            )}
        </aside>
        <div className="outreach-workspace">
          {contact ? (
            <>
              <div className="outreach-recipient">
                <div>
                  <p className="eyebrow">YOUR RELATIONSHIP WITH</p>
                  <h3>{contact.full_name}</h3>
                  <p className="muted">
                    {contact.title ?? "Professional contact"}
                  </p>
                </div>
                <span className="contact-tag">
                  {label(engagement?.relationship_state ?? "cold")} relationship
                </span>
              </div>
              {engagement ? (
                <>
                  {shared.length > 0 && (
                    <p className="outreach-help muted">
                      This relationship is also linked to {shared.length} other{" "}
                      {shared.length === 1 ? "opportunity" : "opportunities"}.
                      Its history stays with the person.
                    </p>
                  )}
                  <Composer
                    key={`${engagement.id}:${data.messages
                      .filter(
                        (m) =>
                          m.workspace_id === workspace &&
                          m.outreach_engagement_id === engagement.id &&
                          m.opportunity_id === (general ? null : role) &&
                          ["draft", "review", "approved"].includes(
                            m.message_status,
                          ),
                      )
                      .map((m) => m.id)
                      .join(":")}:${general}`}
                    job={job}
                    contact={contact}
                    engagement={engagement}
                    data={data}
                    tasks={tasks}
                    followUps={followUps}
                    general={general}
                    writable={!!onAction}
                    open={open}
                    notice={setNotice}
                  />
                  <RelationshipHistory
                    contact={contact}
                    engagement={engagement}
                    data={data}
                  />
                  {onAction &&
                    followUps.map((f) => (
                      <div key={f.id} className="outreach-history-item">
                        <p className="muted">
                          Outstanding follow-up: {f.message}…
                        </p>
                        <button
                          className="text-button"
                          onClick={() =>
                            open({
                              command: "resolve_follow_up",
                              title: "Close this follow-up",
                              payload: {
                                engagement_id: engagement.id,
                                expected_revision: engagement.revision,
                                task_id: f.id,
                              },
                            })
                          }
                        >
                          Close follow-up with a reason
                        </button>
                      </div>
                    ))}
                  {onAction && (
                    <div className="outreach-inline">
                      <button
                        className="button"
                        onClick={() =>
                          open({
                            command: "add_note",
                            title: "Add relationship context",
                            payload: {
                              contact_id: contact.id,
                              engagement_id: engagement.id,
                            },
                          })
                        }
                      >
                        Add a note
                      </button>
                      <button
                        className="button"
                        onClick={() =>
                          open({
                            command: "record_interaction",
                            title: "Record a relationship step",
                            payload: {
                              engagement_id: engagement.id,
                              expected_revision: engagement.revision,
                              opportunity_id: general ? null : role,
                            },
                          })
                        }
                      >
                        Record interaction
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="outreach-empty">
                  <MessageSquare size={26} />
                  <h4>Start with this person</h4>
                  <p>
                    Keep your draft and conversation together in one
                    relationship.
                  </p>
                  {onAction && (
                    <button
                      className="button primary"
                      onClick={() =>
                        open({
                          command: general
                            ? "create_engagement"
                            : "start_engagement",
                          title: "Start this relationship",
                          payload: {
                            ...(general ? {} : { opportunity_id: role }),
                            contact_id: contact.id,
                          },
                          contact,
                        })
                      }
                    >
                      Start a message
                    </button>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="outreach-empty">
              <MessageSquare size={30} />
              <h3>Your next conversation starts here.</h3>
              <p>Select or add a contact to draft a personal message.</p>
            </div>
          )}
        </div>
      </div>
      {review && onAction && (
        <OutreachReview
          key={review.command}
          review={review}
          contacts={data.contacts.filter(
            (c) =>
              c.workspace_id === workspace &&
              c.status === "active" &&
              !contacts.some((x) => x.id === c.id),
          )}
          onAction={onAction}
          close={close}
          done={(result) => {
            if (
              result &&
              typeof result === "object" &&
              !Array.isArray(result) &&
              typeof result.contact_id === "string"
            )
              setSelected(result.contact_id);
            setNotice(
              review.command === "request_draft"
                ? "Draft preparation requested. Your worker will return a new version for review."
                : review.command === "mark_sent"
                  ? "Your exact sent message is recorded. Follow-up reflects your choice."
                  : "Saved. Your relationship history is up to date.",
            );
            close();
          }}
        />
      )}
    </section>
  );
}
function Composer({
  job,
  contact,
  engagement,
  data,
  tasks,
  followUps,
  general,
  writable,
  open,
  notice,
}: {
  job: JobView;
  contact: Contact;
  engagement: Engagement;
  data: OutreachData;
  tasks: Task[];
  followUps: { id: string; message: string }[];
  general: boolean;
  writable: boolean;
  open: (v: Review) => void;
  notice: (v: string) => void;
}) {
  const messages = data.messages.filter(
    (m) =>
      m.workspace_id === job.opportunity.workspace_id &&
      m.outreach_engagement_id === engagement.id &&
      m.opportunity_id === (general ? null : job.opportunity.id),
  );
  const saved = messages
    .filter((m) => ["draft", "review", "approved"].includes(m.message_status))
    .sort(
      (a, b) =>
        b.created_at.localeCompare(a.created_at) ||
        b.version_number - a.version_number,
    )[0];
  const [body, setBody] = useState(saved?.content ?? "");
  const [subject, setSubject] = useState(saved?.subject ?? "");
  const [channel, setChannel] = useState(saved?.channel ?? "linkedin");
  const changed =
    body !== (saved?.content ?? "") ||
    subject !== (saved?.subject ?? "") ||
    channel !== (saved?.channel ?? "linkedin");
  const base = {
    engagement_id: engagement.id,
    expected_revision: engagement.revision,
    opportunity_id: general ? null : job.opportunity.id,
  };
  const outstanding = data.taskLinks
    .filter(
      (l) =>
        l.workspace_id === job.opportunity.workspace_id &&
        l.outreach_engagement_id === engagement.id &&
        l.purpose === "draft",
    )
    .map((l) => tasks.find((t) => t.id === l.internal_task_id))
    .filter((t) => t && !["completed", "cancelled"].includes(t.status));
  return (
    <section className="message-composer" aria-label="Message draft">
      <div className="outreach-heading">
        <h3>Your message</h3>
        <span className="contact-tag">
          {saved
            ? `Version ${saved.version_number} · ${label(saved.message_status)}`
            : "New draft"}
        </span>
      </div>
      <p className="muted outreach-help">
        Make it sound like you. Saving creates an exact version for your review.
      </p>
      <div className="outreach-fields">
        <label>
          Channel
          <select
            disabled={!writable}
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
          >
            <option value="linkedin">LinkedIn</option>
            <option value="email">Email</option>
            <option value="sms">SMS</option>
            <option value="phone">Phone</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          Subject (optional)
          <input
            disabled={!writable}
            value={subject}
            maxLength={500}
            onChange={(e) => setSubject(e.target.value)}
          />
        </label>
      </div>
      <label>
        Message
        <textarea
          className="message-body"
          aria-label="Message"
          disabled={!writable}
          value={body}
          maxLength={20000}
          rows={8}
          placeholder={`Hi ${contact.full_name.split(" ")[0]}, …`}
          onChange={(e) => setBody(e.target.value)}
        />
      </label>
      {data.messageEvidence
        .filter(
          (e) =>
            e.workspace_id === job.opportunity.workspace_id &&
            e.outreach_message_id === saved?.id,
        )
        .map((e) => (
          <p key={e.id} className="outreach-help muted">
            Candidate evidence: {e.usage_context}
          </p>
        ))}
      <div className="outreach-inline composer-actions">
        {writable && (
          <button
            className="button primary"
            disabled={!body.trim() || !changed}
            onClick={() =>
              open({
                command: "save_draft",
                title: saved ? "Save a new message version" : "Save your draft",
                payload: {
                  ...base,
                  ...(saved ? { message_id: saved.id } : {}),
                  channel,
                  subject: subject.trim() || null,
                  content: body,
                  purpose: "opportunity_outreach",
                },
              })
            }
          >
            <Check size={16} />
            {saved ? "Save new version" : "Save draft"}
          </button>
        )}
        <button
          className="button"
          disabled={!body}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(body);
              notice(
                "Message copied. Send it yourself when you choose, then record the exact sent version.",
              );
            } catch {
              notice(
                "Copy is unavailable. Select the message text and copy it manually.",
              );
            }
          }}
        >
          <Copy size={16} />
          Copy message
        </button>
        {writable && (
          <button
            className="button"
            onClick={() =>
              open({
                command: "request_draft",
                title: saved ? "Request a revised draft" : "Request a draft",
                payload: {
                  ...base,
                  ...(saved ? { message_id: saved.id } : {}),
                },
              })
            }
          >
            <RefreshCw size={16} />
            {saved ? "Request revision" : "Request draft"}
          </button>
        )}
      </div>
      {outstanding.length > 0 && (
        <p className="notice" role="status">
          {outstanding.length} draft preparation{" "}
          {outstanding.length === 1 ? "request is" : "requests are"} queued or
          in progress. Review the worker&apos;s result when ready.
        </p>
      )}
      {writable && saved && (
        <div className="outreach-sent-gate">
          <p className="muted">
            After you send it outside Job Hunt HQ, record what was actually
            sent.
          </p>
          <button
            className="button"
            disabled={changed}
            onClick={() =>
              open({
                command: "mark_sent",
                title: "Record an already-sent message",
                payload: {
                  engagement_id: engagement.id,
                  expected_revision: engagement.revision,
                  message_id: saved.id,
                },
                message: saved,
                contact,
                followUps,
              })
            }
          >
            I sent this message
          </button>
          {changed && (
            <small className="muted">
              Save your edits as a new version first.
            </small>
          )}
        </div>
      )}
    </section>
  );
}
function RelationshipHistory({
  contact,
  engagement,
  data,
}: {
  contact: Contact;
  engagement: Engagement;
  data: OutreachData;
}) {
  const messages = data.messages
    .filter(
      (m) =>
        m.workspace_id === engagement.workspace_id &&
        m.outreach_engagement_id === engagement.id,
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const notes = data.notes.filter(
    (n) =>
      n.workspace_id === engagement.workspace_id && n.contact_id === contact.id,
  );
  const interactions = data.interactions.filter(
    (i) =>
      i.workspace_id === engagement.workspace_id &&
      i.outreach_engagement_id === engagement.id,
  );
  return (
    <section className="relationship-history" aria-label="Relationship history">
      <div className="outreach-heading">
        <h3>Relationship history</h3>
        <span className="muted">
          {messages.length} message{" "}
          {messages.length === 1 ? "record" : "records"}
        </span>
      </div>
      {engagement.next_follow_up_at && (
        <p className="notice">
          Next follow-up review: {date(engagement.next_follow_up_at)}
        </p>
      )}
      {!messages.length && !notes.length && !interactions.length && (
        <p className="muted">
          Your drafts, conversations, and professional context will stay
          together here.
        </p>
      )}
      {messages.map((m) => {
        const snapshot =
          m.recipient_snapshot &&
          typeof m.recipient_snapshot === "object" &&
          !Array.isArray(m.recipient_snapshot)
            ? m.recipient_snapshot
            : null;
        const op =
          m.opportunity_snapshot &&
          typeof m.opportunity_snapshot === "object" &&
          !Array.isArray(m.opportunity_snapshot)
            ? m.opportunity_snapshot
            : null;
        return (
          <details key={m.id} className="outreach-history-item">
            <summary>
              <span>
                {label(m.message_status)} · {label(m.channel)} · v
                {m.version_number}
              </span>
              <small>{date(m.sent_at ?? m.received_at ?? m.created_at)}</small>
            </summary>
            <p className="muted">
              {snapshot
                ? `${String(snapshot.name ?? "")} · ${String(snapshot.address ?? (m.channel === "email" ? snapshot.email : snapshot.linkedin_url) ?? "")}`
                : contact.full_name}
              {op && typeof op.title === "string" ? ` · ${op.title}` : ""}
              {m.opportunity_id === null
                ? " · General relationship"
                : m.opportunity_id !==
                    data.engagementOpportunities.find(
                      (l) => l.outreach_engagement_id === engagement.id,
                    )?.opportunity_id
                  ? " · Linked opportunity"
                  : ""}
            </p>
            {m.subject && <h4>{m.subject}</h4>}
            <p className="preserve-lines">{m.content}</p>
            {m.sent_at && (
              <small className="muted">
                Actual sent time (UTC): {m.sent_at}
              </small>
            )}
            {m.received_at && (
              <small className="muted">
                Actual received time (UTC): {m.received_at}
              </small>
            )}
            {m.external_reference && (
              <small className="muted">
                External source reference: {m.external_reference}
              </small>
            )}
            <small className="muted">
              {m.sent_at
                ? "Exact recorded sent version"
                : m.received_at
                  ? "Verified incoming record"
                  : "Preserved message version"}
            </small>
          </details>
        );
      })}
      {interactions.map((i) => (
        <article key={i.id} className="outreach-history-item">
          <strong>{label(i.interaction_type)}</strong>
          <small>{date(i.occurred_at)}</small>
          <p>{i.summary}</p>
          <small className="muted">Source: {label(i.source_system)}</small>
        </article>
      ))}
      {notes.map((n) => (
        <article key={n.id} className="outreach-history-item">
          <span className="contact-tag">{label(n.validation_status)}</span>
          <p>{n.note_text}</p>
          <small className="muted">{date(n.created_at)}</small>
        </article>
      ))}
    </section>
  );
}
function OutreachReview({
  review,
  contacts,
  onAction,
  close,
  done,
}: {
  review: Review;
  contacts: Contact[];
  onAction: OutreachHandler;
  close: () => void;
  done: (v: Awaited<ReturnType<OutreachHandler>>) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const lock = useRef(false);
  const attempt = useRef<{ input: string; id: string } | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const form = new FormData(event.currentTarget),
      field = (name: string) => String(form.get(name) ?? "").trim();
    const payload: OutreachPayload = { ...review.payload };
    if (["add_manual_target", "save_contact"].includes(review.command))
      Object.assign(payload, {
        full_name: field("full_name"),
        title: field("title") || null,
        email: field("email") || null,
        linkedin_url: field("linkedin_url") || null,
        ...(review.command === "save_contact"
          ? {
              source_system: "candidate",
              relationship_context: field("reason") || null,
            }
          : { reason: field("reason") || "Selected by the candidate" }),
      });
    if (review.command === "link_contact")
      Object.assign(payload, {
        contact_id: field("contact_id"),
        relationship_role: "outreach_target",
        selection_method: "manual",
        relevance: field("reason"),
        source_system: "candidate",
      });
    if (review.command === "request_draft")
      payload.instructions = field("instructions");
    if (review.command === "add_note")
      Object.assign(payload, {
        note_type: "professional_context",
        note_text: field("note_text"),
        validation_status: field("validation_status"),
      });
    if (review.command === "resolve_follow_up")
      payload.reason = field("reason");
    if (review.command === "record_interaction") {
      const occurred = new Date(field("occurred_at"));
      if (
        !Number.isFinite(occurred.getTime()) ||
        occurred.getTime() > Date.now() + 60000
      ) {
        setError("Choose when this interaction actually happened.");
        return;
      }
      Object.assign(payload, {
        interaction_type: field("interaction_type"),
        summary: field("summary"),
        occurred_at: occurred.toISOString(),
        source_system: "candidate",
      });
    }
    if (review.command === "mark_sent") {
      if (!form.has("confirmed")) {
        setError("Confirm that you already sent this exact saved message.");
        return;
      }
      const sent = new Date(field("sent_at")),
        follow =
          field("follow_up_choice") === "future"
            ? new Date(field("follow_up_at"))
            : null;
      if (
        !Number.isFinite(sent.getTime()) ||
        sent.getTime() > Date.now() + 60000 ||
        !field("follow_up_choice") ||
        (follow &&
          (!Number.isFinite(follow.getTime()) ||
            follow.getTime() <= Math.max(sent.getTime(), Date.now())))
      ) {
        setError(
          "Choose an actual sent time and a future follow-up, or explicitly choose no follow-up.",
        );
        return;
      }
      Object.assign(payload, {
        confirmed: true,
        exact_content: review.message!.content,
        exact_subject: review.message!.subject,
        recipient: {
          name: review.contact!.full_name,
          address: field("address"),
        },
        sent_at: sent.toISOString(),
        follow_up_choice: follow ? "scheduled" : "none",
        follow_up_at: follow?.toISOString() ?? null,
        ...(field("resolves_follow_up_task_id")
          ? { resolves_follow_up_task_id: field("resolves_follow_up_task_id") }
          : {}),
      });
    }
    const input = JSON.stringify(payload);
    if (attempt.current?.input !== input)
      attempt.current = { input, id: crypto.randomUUID() };
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await onAction(
        review.command,
        payload,
        attempt.current.id,
      );
      done(result);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The result could not be confirmed. Retry this same request safely.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <dialog
      className="human-action-dialog outreach-dialog"
      ref={dialog}
      aria-labelledby="outreach-review-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!lock.current) close();
      }}
    >
      <form onSubmit={submit}>
        <h2 id="outreach-review-title">{review.title}</h2>
        <fieldset disabled={busy}>
          {["add_manual_target", "save_contact"].includes(review.command) && (
            <>
              <p className="muted">
                Choose anyone relevant to your professional search. They do not
                need to appear in recommendations.
              </p>
              <label>
                Full name
                <input
                  name="full_name"
                  required
                  maxLength={300}
                  autoComplete="off"
                />
              </label>
              <label>
                Professional title (optional)
                <input name="title" maxLength={500} />
              </label>
              <label>
                Email (optional)
                <input type="email" name="email" maxLength={320} />
              </label>
              <label>
                LinkedIn profile (optional)
                <input
                  type="url"
                  name="linkedin_url"
                  pattern="https://(www\.)?linkedin\.com/in/[^\s?#@]+/?"
                  placeholder="https://www.linkedin.com/in/…"
                />
              </label>
              <label>
                Why this person? (optional)
                <textarea name="reason" maxLength={2000} />
              </label>
            </>
          )}
          {review.command === "link_contact" && (
            <>
              <label>
                Existing person
                <select name="contact_id" required defaultValue="">
                  <option value="" disabled>
                    Select a contact
                  </option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} · {c.title ?? "Professional contact"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Why this person for this role?
                <textarea name="reason" required maxLength={2000} />
              </label>
            </>
          )}
          {["start_engagement", "create_engagement"].includes(
            review.command,
          ) && (
            <p>
              Start a workstream with {review.contact?.full_name}. No message
              will be prepared or sent until you choose the next step.
            </p>
          )}
          {review.command === "select_primary_contact" && (
            <p>
              Use {review.contact?.full_name} as your primary target for this
              role. Other recommendations and history stay available.
            </p>
          )}
          {review.command === "request_draft" && (
            <>
              <p className="muted">
                Request preparation from your existing worker. Its result will
                be a new draft for you to review.
              </p>
              <label>
                Guidance (optional)
                <textarea
                  name="instructions"
                  maxLength={2000}
                  placeholder="What should the message emphasize?"
                />
              </label>
            </>
          )}
          {review.command === "resolve_follow_up" && (
            <>
              <p className="muted">
                Close this exact waiting task without claiming another message
                was sent. Other relationship follow-ups stay available.
              </p>
              <label>
                Reason for closing
                <textarea name="reason" required maxLength={2000} />
              </label>
            </>
          )}
          {review.command === "save_draft" && (
            <>
              <p className="muted">
                This saves the whole message as a new version. Your earlier
                versions stay in history.
              </p>
              <p>
                <strong>{label(String(review.payload.channel))}</strong>
                {review.payload.subject && (
                  <> · {String(review.payload.subject)}</>
                )}
              </p>
              <p className="outreach-exact preserve-lines">
                {String(review.payload.content)}
              </p>
            </>
          )}
          {review.command === "add_note" && (
            <>
              <label>
                Professional context
                <textarea name="note_text" required maxLength={4000} />
              </label>
              <label>
                How certain is this?
                <select
                  name="validation_status"
                  required
                  defaultValue="candidate_review_needed"
                >
                  <option value="candidate_review_needed">Needs review</option>
                  <option value="inferred">Inferred</option>
                  <option value="confirmed">Confirmed by me</option>
                </select>
              </label>
            </>
          )}
          {review.command === "record_interaction" && (
            <>
              <label>
                Relationship step
                <select name="interaction_type" defaultValue="connect">
                  {[
                    "follow",
                    "connect",
                    "connection_accepted",
                    "comment",
                    "call",
                    "referral",
                    "meeting",
                    "introduction",
                    "other",
                  ].map((v) => (
                    <option key={v} value={v}>
                      {label(v)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                What actually happened?
                <textarea name="summary" required maxLength={2000} />
              </label>
              <label>
                When did it happen?
                <input
                  name="occurred_at"
                  type="datetime-local"
                  defaultValue={localTime()}
                  required
                />
              </label>
            </>
          )}
          {review.command === "mark_sent" && (
            <SentFields
              message={review.message!}
              contact={review.contact!}
              followUps={review.followUps ?? []}
            />
          )}
        </fieldset>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={close}
          >
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            {busy
              ? "Confirming…"
              : review.command === "mark_sent"
                ? "Record sent message"
                : review.command === "request_draft"
                  ? "Request preparation"
                  : "Confirm"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
function SentFields({
  message,
  contact,
  followUps,
}: {
  message: OutreachMessage;
  contact: Contact;
  followUps: { id: string; message: string }[];
}) {
  const [follow, setFollow] = useState("");
  const address = destination(contact, message.channel);
  return (
    <>
      <p className="muted">
        Record an action you already took outside Job Hunt HQ.
      </p>
      <p>
        <strong>{contact.full_name}</strong> · {label(message.channel)} ·
        Version {message.version_number}
      </p>
      {message.subject && <h4>{message.subject}</h4>}
      <p className="outreach-exact preserve-lines">{message.content}</p>
      <label>
        Exact recipient destination
        <input
          name="address"
          defaultValue={address ?? ""}
          readOnly={!!address}
          required
          maxLength={1000}
        />
      </label>
      <label>
        Actual sent time
        <input
          name="sent_at"
          type="datetime-local"
          defaultValue={localTime()}
          required
        />
      </label>
      {followUps.length > 0 && (
        <label>
          Previous follow-up resolved by this message (optional)
          <select name="resolves_follow_up_task_id" defaultValue="">
            <option value="">Leave previous follow-ups unchanged</option>
            {followUps.map((f) => (
              <option key={f.id} value={f.id}>
                {f.message}…
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        Follow-up choice
        <select
          name="follow_up_choice"
          value={follow}
          onChange={(e) => setFollow(e.target.value)}
          required
        >
          <option value="" disabled>
            Choose a follow-up
          </option>
          <option value="future">Remind me to review a follow-up</option>
          <option value="none">No follow-up</option>
        </select>
      </label>
      {follow === "future" && (
        <label>
          Follow-up review time
          <input name="follow_up_at" type="datetime-local" required />
        </label>
      )}
      <label className="confirmation-check">
        <input type="checkbox" name="confirmed" required />
        <span>
          I confirm I already sent this exact saved message to{" "}
          {contact.full_name} at the destination above.
        </span>
      </label>
    </>
  );
}
