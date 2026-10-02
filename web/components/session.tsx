"use client";
import { InterviewContext } from "./interview-panel";
import { interviewService, type InterviewService } from "@/lib/interview";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createHqClient, type HqClient } from "@/lib/supabase/client";
import { resolveIdentity, loadWorkspace } from "@/lib/queries";
import type { Identity, WorkspaceData } from "@/lib/types";
import { runHumanAction, type HumanActionHandler } from "@/lib/human-actions";

type SessionState = {
  identity: Identity | null;
  data: WorkspaceData | null;
  workspaceId: string;
  loading: boolean;
  ready: boolean;
  error: string;
  humanActions: boolean;
  domainActions: boolean;
  act: HumanActionHandler;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  selectWorkspace: (id: string) => Promise<void>;
  reload: () => Promise<void>;
};
const Context = createContext<SessionState | null>(null);
export function useSession() {
  const value = useContext(Context);
  if (!value) throw new Error("Session unavailable");
  return value;
}
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const client = useRef<HqClient | null>(null);
  const generation = useRef(0);
  const identityRef = useRef<Identity | null>(null);
  const workspaceRef = useRef("");
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [workspaceId, setWorkspaceId] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [humanActions, setHumanActions] = useState(false);
  const [interview, setInterview] = useState<InterviewService | null>(null);
  const refresh = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    refresh.current = reload;
  });
  const mutation = useRef(false);
  useEffect(() => {
    const activeGeneration = generation;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    async function init() {
      try {
        const response = await fetch("/api/public-config", {
          cache: "no-store",
        });
        if (!response.ok) throw new Error();
        const config = await response.json();
        if (cancelled) return;
        const instance = createHqClient(config);
        client.current = instance;
        if (config.interview === true)
          setInterview(
            interviewService(
              instance,
              () => workspaceRef.current,
              async () => {
                await refresh.current();
              },
            ),
          );
        setHumanActions(config.humanActions === true);
        const subscription = instance.auth.onAuthStateChange((event) => {
          if (event === "SIGNED_OUT") {
            generation.current++;
            identityRef.current = null;
            workspaceRef.current = "";
            setIdentity(null);
            setData(null);
            setWorkspaceId("");
            setLoading(false);
          }
        });
        unsubscribe = () => subscription.data.subscription.unsubscribe();
        setReady(true);
      } catch {
        if (!cancelled)
          setError(
            "Public connection settings are unavailable. Configure the preview and retry.",
          );
      }
    }
    void init();
    return () => {
      cancelled = true;
      unsubscribe?.();
      client.current = null;
      activeGeneration.current++;
    };
  }, []);

  async function readWorkspace(id: string, profile: Identity) {
    const instance = client.current;
    if (!instance || !profile.workspaces.some((w) => w.id === id)) return;
    const run = ++generation.current;
    workspaceRef.current = id;
    setWorkspaceId(id);
    setData(null);
    setLoading(true);
    setError("");
    try {
      // Verify the authenticated user again before every workspace read.
      const verified = await resolveIdentity(instance);
      if (run !== generation.current) return;
      if (
        verified.principal.id !== profile.principal.id ||
        !verified.workspaces.some((w) => w.id === id)
      ) {
        setError("Your workspace access has changed. Please sign in again.");
        await instance.auth.signOut({ scope: "local" });
        return;
      }
      identityRef.current = verified;
      setIdentity(verified);
      const rows = await loadWorkspace(
        instance,
        id,
        profile.principal.id,
        humanActions,
      );
      if (run === generation.current) setData(rows);
    } catch (e) {
      if (run === generation.current) {
        setError(
          e instanceof Error
            ? e.message
            : "Data could not be loaded. Please retry.",
        );
        const session = await instance.auth.getUser();
        if (session.error || !session.data.user)
          await instance.auth.signOut({ scope: "local" });
      }
    } finally {
      if (run === generation.current) setLoading(false);
    }
  }
  async function signIn(email: string, password: string) {
    const instance = client.current;
    if (!instance) return;
    const run = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const result = await instance.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (result.error)
        throw new Error(
          "Sign-in failed. Check your email and password and try again.",
        );
      const profile = await resolveIdentity(instance);
      if (run !== generation.current) return;
      identityRef.current = profile;
      setIdentity(profile);
      const preferred =
        profile.workspaces.find(
          (w) => w.id === "9341c194-c4f6-45c4-b3b1-37a832a7fc68",
        ) ?? profile.workspaces[0];
      await readWorkspace(preferred.id, profile);
    } catch (e) {
      if (run === generation.current) {
        setError(
          e instanceof Error ? e.message : "Sign-in could not be completed.",
        );
        setLoading(false);
        await instance.auth.signOut({ scope: "local" });
      }
    }
  }
  async function signOut() {
    generation.current++;
    setData(null);
    setIdentity(null);
    setWorkspaceId("");
    setError("");
    identityRef.current = null;
    workspaceRef.current = "";
    await client.current?.auth.signOut({ scope: "local" });
  }
  async function selectWorkspace(id: string) {
    if (identityRef.current) await readWorkspace(id, identityRef.current);
  }
  async function reload() {
    if (identityRef.current && workspaceRef.current)
      await readWorkspace(workspaceRef.current, identityRef.current);
  }
  const act: HumanActionHandler = async (job, command, payload, requestId) => {
    const instance = client.current,
      profile = identityRef.current,
      target = workspaceRef.current;
    if (!humanActions || !instance || !profile || !target)
      throw new Error("Human actions are not enabled yet.");
    if (mutation.current)
      throw new Error("Another action is still being confirmed.");
    const run = generation.current;
    mutation.current = true;
    try {
      const verified = await resolveIdentity(instance);
      if (
        run !== generation.current ||
        workspaceRef.current !== target ||
        verified.principal.id !== profile.principal.id ||
        !verified.workspaces.some((w) => w.id === target)
      )
        throw new Error("Your workspace changed. Review the role again.");
      await runHumanAction(instance, target, job, command, payload, requestId);
      if (run === generation.current && workspaceRef.current === target)
        await reload();
    } finally {
      mutation.current = false;
    }
  };
  return (
    <Context.Provider
      value={{
        identity,
        data,
        workspaceId,
        loading,
        ready,
        error,
        humanActions,
        domainActions: !!interview,
        act,
        signIn,
        signOut,
        selectWorkspace,
        reload,
      }}
    >
      <InterviewContext.Provider value={identity ? interview : null}>
        {children}
      </InterviewContext.Provider>
    </Context.Provider>
  );
}
