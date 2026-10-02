import { notFound } from "next/navigation";
import { QaScreen } from "@/components/qa-screen";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    job?: string;
    actions?: string;
    intake?: string;
    delivery?: string;
    fail?: string;
    refresh?: string;
    packet?: string;
  }>;
}) {
  if (
    process.env.NODE_ENV !== "development" ||
    process.env.HQ_QA_FIXTURES !== "1"
  )
    notFound();
  const { job, actions, intake, delivery, fail, refresh, packet } =
    await searchParams;
  return (
    <QaScreen
      selectedId={job}
      actions={actions === "1"}
      intake={intake === "1"}
      delivery={delivery === "1"}
      fail={fail === "1"}
      refresh={refresh === "1"}
      packet={packet === "1"}
    />
  );
}
