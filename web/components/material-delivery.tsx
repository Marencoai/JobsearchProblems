"use client";
import { PdfPreview } from "./pdf-preview";
import { useEffect, useRef, useState } from "react";
import type { Material, MaterialArtifact } from "@/lib/types";
import {
  artifactPair,
  materialFilename,
  type MaterialDeliveryHandler,
} from "@/lib/material-delivery";
export function MaterialDelivery({
  material,
  artifacts,
  load,
}: {
  material: Material;
  artifacts: MaterialArtifact[];
  load: MaterialDeliveryHandler;
}) {
  const pair = artifactPair(material, artifacts);
  const [preview, setPreview] = useState<{ blob: Blob; token: number } | null>(
      null,
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const sequence = useRef(0);
  const urls = useRef<string[]>([]),
    alive = useRef(true),
    inFlight = useRef(false);
  useEffect(() => {
    alive.current = true;
    const owned = urls.current;
    return () => {
      alive.current = false;
      owned.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);
  async function open(format: "pdf" | "docx", view = false) {
    if (!pair || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const blob = await load(material, pair[format]);
      if (!alive.current) return;
      if (view) setPreview({ blob, token: ++sequence.current });
      else {
        const url = URL.createObjectURL(blob);
        urls.current.push(url);
        const a = document.createElement("a");
        a.href = url;
        a.download = materialFilename(material, format);
        a.hidden = true;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setMessage(
        `Verified exact version ${material.version_number} ${format.toUpperCase()}.`,
      );
    } catch (e) {
      if (alive.current)
        setError(e instanceof Error ? e.message : "File could not be loaded.");
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  }
  if (!pair)
    return (
      <p className="notice">
        Exact PDF and DOCX files have not been recorded and verified for this
        material version yet.
      </p>
    );
  return (
    <section className="artifact-delivery">
      <div className="artifact-controls">
        <button
          className="button"
          disabled={busy}
          onClick={() => void open("pdf", true)}
        >
          Preview PDF
        </button>
        <button
          className="button"
          disabled={busy}
          onClick={() => void open("pdf")}
        >
          Download PDF
        </button>
        <button
          className="button"
          disabled={busy}
          onClick={() => void open("docx")}
        >
          Download DOCX
        </button>
      </div>
      {busy && <p role="status">Verifying exact file…</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {preview && (
        <PdfPreview
          key={preview.token}
          title={`Exact ${material.material_type} PDF version ${material.version_number}`}
          blob={preview.blob}
          pageCount={pair.pdf.qa.page_count}
        />
      )}
    </section>
  );
}
