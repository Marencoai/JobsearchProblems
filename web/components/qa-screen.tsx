"use client";
import { HqShell } from "./hq-shell";
import { fixtureIdentity, visualFixture } from "@/lib/qa-fixtures";
export function QaScreen({ selectedId }: { selectedId?: string }) {
  return (
    <HqShell
      identity={fixtureIdentity}
      data={visualFixture()}
      workspaceId="fixture-workspace"
      selectedId={selectedId}
      loading={false}
      error=""
      fixture
      onWorkspace={() => {}}
      onReload={() => {}}
      onSignOut={() => {}}
    />
  );
}
