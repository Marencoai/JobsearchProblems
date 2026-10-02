import { readFile } from "node:fs/promises";
import type { QaCanonical } from "@/lib/qa-canonical-types";
import { notFound } from "next/navigation";
import { QaScreen } from "@/components/qa-screen";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    job?: string;
    outreach?: string;
    actions?: string;
    intake?: string;
    delivery?: string;
    fail?: string;
    refresh?: string;
    packet?: string;
    canonical?: string;
    history?: string;
  }>;
}) {
  if (
    process.env.NODE_ENV !== "development" ||
    process.env.HQ_QA_FIXTURES !== "1"
  )
    notFound();
  const {
    job,
    actions,
    intake,
    delivery,
    fail,
    outreach,
    refresh,
    packet,
    canonical,
    history,
  } = await searchParams;
  let canonicalFixture: QaCanonical | undefined;
  if (canonical === "1") {
    // This is after the dev-only guard. Hardcoded committed fictional fixtures;
    // no caller-supplied file path, converter execution or hosted data access.
    const base = new URL("file://" + process.cwd() + "/qa-evidence/canonical/");
    const [pdf, docx, manifest] = await Promise.all([
      readFile(new URL("resume-v1.pdf", base)),
      readFile(new URL("resume-v1.docx", base)),
      readFile(new URL("artifact-manifest.json", base), "utf8"),
    ]);
    canonicalFixture = {
      pdf: pdf.toString("base64"),
      docx: docx.toString("base64"),
      manifest: JSON.parse(manifest),
    };
  }
  return (
    <QaScreen
      selectedId={job ?? (outreach === "1" ? "outreach" : undefined)}
      outreach={outreach === "1"}
      actions={actions === "1"}
      intake={intake === "1"}
      delivery={delivery === "1"}
      fail={fail === "1"}
      refresh={refresh === "1"}
      packet={packet === "1"}
      canonical={canonicalFixture}
      history={history === "1"}
    />
  );
}
