import { WorkspaceScreen } from "@/components/workspace-screen";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <WorkspaceScreen selectedId={id} />;
}
