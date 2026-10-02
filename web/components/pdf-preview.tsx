"use client";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentLoadingTask } from "pdfjs-dist";
// Render only verified in-memory bytes. No URL fetch, document scripting,
// embedded attachments, external links, or PDF form actions are exposed.
export function PdfPreview({
  blob,
  pageCount,
  title,
}: {
  blob: Blob;
  pageCount: number;
  title: string;
}) {
  const host = useRef<HTMLDivElement>(null),
    [error, setError] = useState(""),
    [complete, setComplete] = useState(false),
    [text, setText] = useState("");
  useEffect(() => {
    let cancelled = false,
      loading: PDFDocumentLoadingTask | undefined;
    const target = host.current;
    const render = async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const bytes = new Uint8Array(await blob.arrayBuffer());
        if (cancelled) return;
        loading = pdfjs.getDocument({
          data: bytes,
          useWorkerFetch: false,
          useSystemFonts: true,
          enableXfa: false,
        });
        const pdf = await loading.promise;
        if (pdf.numPages !== pageCount || pdf.numPages > 20)
          throw new Error("The PDF page count does not match its recorded QA.");
        const lines: string[] = [];
        for (let n = 1; n <= pdf.numPages; n++) {
          if (cancelled) return;
          const page = await pdf.getPage(n),
            viewport = page.getViewport({ scale: 1.25 });
          if (
            !Number.isFinite(viewport.width) ||
            !Number.isFinite(viewport.height) ||
            viewport.width < 1 ||
            viewport.height < 1 ||
            viewport.width > 2400 ||
            viewport.height > 3600
          )
            throw new Error("PDF page dimensions exceed the preview limit.");
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          canvas.setAttribute(
            "aria-label",
            `${title} page ${n} of ${pdf.numPages}`,
          );
          canvas.setAttribute("role", "img");
          const context = canvas.getContext("2d");
          if (!context) throw new Error("This browser cannot draw PDF pages.");
          await page.render({ canvas, canvasContext: context, viewport })
            .promise;
          if (cancelled) return;
          const content = await page.getTextContent();
          lines.push(
            `Page ${n}\n` +
              content.items
                .map((item) => ("str" in item ? item.str : ""))
                .join(" "),
          );
          target?.appendChild(canvas);
        }
        if (!cancelled) {
          setText(lines.join("\n\n"));
          setComplete(true);
        }
      } catch {
        if (!cancelled)
          setError(
            "PDF preview could not be displayed. Download the verified PDF to open it in your document viewer.",
          );
      }
    };
    void render();
    return () => {
      cancelled = true;
      void loading?.destroy();
      target?.replaceChildren();
    };
  }, [blob, pageCount, title]);
  return (
    <div className="artifact-preview" aria-label={title}>
      {!complete && !error && <p role="status">Rendering exact PDF pages…</p>}
      {error && <p role="alert">{error}</p>}
      <div ref={host} className="pdf-pages" />
      {complete && (
        <details className="pdf-text">
          <summary>Text from the exact PDF</summary>
          <p className="preserve-lines">{text}</p>
        </details>
      )}
    </div>
  );
}
