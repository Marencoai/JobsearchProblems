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
  }>;
}) {
  if (
    process.env.NODE_ENV !== "development" ||
    process.env.HQ_QA_FIXTURES !== "1"
  )
    notFound();
  const { job, actions, intake, delivery, fail, outreach } = await searchParams;
  return (
    <QaScreen
      selectedId={job ?? (outreach === "1" ? "outreach" : undefined)}
      outreach={outreach === "1"}
      actions={actions === "1"}
      intake={intake === "1"}
      delivery={delivery === "1"}
      fail={fail === "1"}
    />
  );
}
