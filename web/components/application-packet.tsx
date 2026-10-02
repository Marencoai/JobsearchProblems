"use client";
import { useState } from "react";
import type { JobView, Material, MaterialArtifact } from "@/lib/types";
import { applicationPacket } from "@/lib/application-packet";
import { label } from "@/lib/format";
import { MaterialDelivery } from "./material-delivery";
import type { MaterialDeliveryHandler } from "@/lib/material-delivery";
export function ApplicationPacket({
  job,
  onMaterial,
  artifacts,
  onDelivery,
}: {
  job: JobView;
  onMaterial: (m: Material) => void;
  artifacts: MaterialArtifact[];
  onDelivery?: MaterialDeliveryHandler;
}) {
  const p = applicationPacket(job),
    [status, setStatus] = useState(""),
    [error, setError] = useState("");
  async function copy(text: string, name: string) {
    setStatus("");
    setError("");
    try {
      await navigator.clipboard.writeText(text);
      setStatus(`${name} copied.`);
    } catch {
      setError(
        "Copy is unavailable. Select the recorded text and copy it manually.",
      );
    }
  }
  if (!p.approved)
    return (
      <section className="application-packet">
        <h3>Application packet</h3>
        <p>
          Approve the prepared package before using its files and answers.
          Recorded earlier versions remain available in Resume.
        </p>
      </section>
    );
  return (
    <section className="application-packet">
      <div className="item-title">
        <h3>Approved application packet</h3>
        <span className="tag">Package {job.package?.package_number}</span>
      </div>
      {p.applyUrl ? (
        <>
          <a
            className="button primary"
            href={p.applyUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open employer application
          </a>
          <p className="muted">
            {p.atsProvider ?? "Recorded employer form"} · Opening it does not
            record submission.
          </p>
        </>
      ) : (
        <>
          <p className="notice">
            An inspected employer application URL is not recorded. Check the
            application requirements before applying.
          </p>
          {p.listingUrl && (
            <a href={p.listingUrl} target="_blank" rel="noopener noreferrer">
              Open original listing
            </a>
          )}
        </>
      )}
      {p.submissionBlocked && (
        <p className="notice">
          {p.unresolved} required answer or attachment needs attention. Request
          a new package version after resolving it before confirming submission.
        </p>
      )}
      <h4>Exact approved files</h4>
      {p.materials
        .filter((m) => ["resume", "cover_letter"].includes(m.material_type))
        .map((m) => (
          <div className="packet-file" key={m.id}>
            <button className="material-row" onClick={() => onMaterial(m)}>
              {label(m.material_type)} · version {m.version_number}
            </button>
            {onDelivery ? (
              <MaterialDelivery
                material={m}
                artifacts={artifacts}
                load={onDelivery}
              />
            ) : (
              <p className="muted">
                Verified file delivery is not enabled yet.
              </p>
            )}
          </div>
        ))}
      {p.attachments
        .filter((f) => f.required && !f.material)
        .map((f) => (
          <p className="error" key={f.material_type}>
            Required {label(f.material_type).toLowerCase()} is not recorded in
            this approved package.
          </p>
        ))}
      <h4>Answers for the employer form</h4>
      {p.structured ? (
        p.fields.map((f) => (
          <section className="packet-answer" key={f.key}>
            <strong>
              {f.label}
              {f.required ? " · required" : ""}
            </strong>
            {f.sensitive ? (
              <p>
                Answer this voluntary or sensitive question yourself in the
                employer form. No answer is inferred here.
              </p>
            ) : f.value !== undefined ? (
              <>
                <p className="preserve-lines">{f.value}</p>
                <button
                  className="button"
                  onClick={() => void copy(f.value!, f.label)}
                >
                  Copy {f.label}
                </button>
              </>
            ) : (
              <p className="notice">
                {f.question ??
                  "No confirmed answer is recorded. Answer this question and request an updated version."}
              </p>
            )}
          </section>
        ))
      ) : (
        <p className="muted">
          Field-by-field requirements are not recorded in a structured format.
          Review the exact approved requirements and answers below; completeness
          cannot be inferred.
        </p>
      )}
      {[
        "application_requirements",
        "application_answers",
        "skills_list",
        ...p.materials
          .map((m) => m.material_type)
          .filter(
            (t) =>
              ![
                "resume",
                "cover_letter",
                "application_requirements",
                "application_answers",
                "skills_list",
              ].includes(t),
          ),
      ].map((type) => {
        const m = p.materials.find((m) => m.material_type === type);
        return m ? (
          <details className="packet-text" key={m.id}>
            <summary>
              {label(type)} · version {m.version_number}
            </summary>
            {p.structured && type === "application_requirements" ? (
              <p>
                Inspected {p.atsProvider ?? "employer"} form · {p.fields.length}{" "}
                recorded questions · {p.attachments.length} attachment
                requirements. The fields and files above belong to this exact
                requirements version.
              </p>
            ) : p.structured && type === "application_answers" ? (
              <p>
                Use the confirmed answers above. Voluntary and sensitive answers
                remain your choice.
              </p>
            ) : (
              <>
                <p className="preserve-lines">
                  {m.content_text ?? "No text is recorded for this version."}
                </p>
                {m.content_text && (
                  <button
                    className="button"
                    onClick={() => void copy(m.content_text!, label(type))}
                  >
                    Copy recorded {label(type).toLowerCase()}
                  </button>
                )}
              </>
            )}
            {!(
              p.structured &&
              ["application_requirements", "application_answers"].includes(type)
            ) && (
              <button className="button" onClick={() => onMaterial(m)}>
                View exact version
              </button>
            )}
          </details>
        ) : null;
      })}
      {!p.answers && (
        <p className="notice">
          No approved screening-answer material is recorded.
        </p>
      )}
      {!p.skills && (
        <p className="muted">
          No approved skills list is recorded. Confirm whether the employer form
          requests one.
        </p>
      )}
      <p className="notice">
        Complete the employer form yourself. Confirm submission only with the
        exact files and recorded answers used; changes require a new version to
        preserve accurate history.
      </p>
      {status && <p role="status">{status}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
