import { notFound } from "next/navigation";
import { QaScreen } from "@/components/qa-screen";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ job?: string }>;
}) {
  if (
    process.env.NODE_ENV !== "development" ||
    process.env.HQ_QA_FIXTURES !== "1"
  )
    notFound();
  const { job } = await searchParams;
  return <QaScreen selectedId={job} />;
}
