"use client";
import { OfferContext } from "./offer-panel";
import { offerService, type OfferService } from "@/lib/offer";
import { InterviewContext } from "./interview-panel";
import { interviewService, type InterviewService } from "@/lib/interview";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createHqClient, type HqClient } from "@/lib/supabase/client";
import { resolveIdentity, loadWorkspace } from "@/lib/queries";
import type { Identity, WorkspaceData } from "@/lib/types";
import { runHumanAction, type HumanActionHandler } from "@/lib/human-actions";
import {
  loadOutreach,
  runOutreachAction,
  type OutreachHandler,
} from "@/lib/outreach";

import {
  requestIntake,
  uploadIntake,
  type IntakeHandler,
  type IntakeUploadHandler,
} from "@/lib/intake";
import {
  loadMaterialArtifact,
  type MaterialDeliveryHandler,
} from "@/lib/material-delivery";
type SessionState = {
  identity: Identity | null;
  data: WorkspaceData | null;
  workspaceId: string;
  loading: boolean;
  ready: boolean;
  error: string;
  humanActions: boolean;
  domainActions: boolean;
  outreach: boolean;
  actOutreach: OutreachHandler;
  act: HumanActionHandler;
  manualIntake: boolean;
  materialDelivery: boolean;
  intake: IntakeHandler;
  upload: IntakeUploadHandler;
  deliver: MaterialDeliveryHandler;
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
  const [offer, setOffer] = useState<OfferService | null>(null);
  const refresh = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    refresh.current = reload;
  });
  const [outreach, setOutreach] = useState(false);
  const mutation = useRef(false);
  const [manualIntake, setManualIntake] = useState(false),
    [materialDelivery, setMaterialDelivery] = useState(false);
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
        if (config.offer === true)
          setOffer(
            offerService(
              instance,
              () => workspaceRef.current,
              async () => {
                await refresh.current();
              },
            ),
          );
        setHumanActions(config.humanActions === true);
        setOutreach(config.outreach === true);
        setManualIntake(config.manualIntake === true);
        setMaterialDelivery(config.materialDelivery === true);
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
        materialDelivery,
      );
      if (run !== generation.current) return;
      if (outreach) rows.outreach = await loadOutreach(instance, id);
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
  const actOutreach: OutreachHandler = async (command, payload, requestId) => {
    const instance = client.current,
      profile = identityRef.current,
      target = workspaceRef.current;
    if (!outreach || !instance || !profile || !target)
      throw new Error("Outreach is not enabled yet.");
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
        throw new Error(
          "Your workspace changed. Review this relationship again.",
        );
      const result = await runOutreachAction(
        instance,
        target,
        command,
        payload,
        requestId,
      );
      if (run !== generation.current || workspaceRef.current !== target)
        throw new Error(
          "Your workspace changed. Review this relationship again.",
        );
      // Keep the role/stage and exact confirmation mounted during refresh.
      // Workspace changes/sign-out still invalidate this whole read generation.
      const rows = await loadWorkspace(
        instance,
        target,
        profile.principal.id,
        humanActions,
      );
      if (run !== generation.current || workspaceRef.current !== target)
        throw new Error(
          "Your workspace changed. Review this relationship again.",
        );
      rows.outreach = await loadOutreach(instance, target);
      if (run !== generation.current || workspaceRef.current !== target)
        throw new Error(
          "Your workspace changed. Review this relationship again.",
        );
      setData(rows);
      return result;
    } finally { mutation.current=false; }
  };
  async function verifiedContext() {
    const instance = client.current,
      profile = identityRef.current,
      target = workspaceRef.current,
      run = generation.current;
    if (!instance || !profile || !target)
      throw new Error("Sign in and select a workspace.");
    const verified = await resolveIdentity(instance);
    if (
      run !== generation.current ||
      target !== workspaceRef.current ||
      verified.principal.id !== profile.principal.id ||
      !verified.workspaces.some((w) => w.id === target)
    )
      throw new Error(
        "Your workspace changed. Start again in the current workspace.",
      );
    return { instance, profile, target, run };
  }
  const intake: IntakeHandler = async (input, request) => {
    if (!manualIntake) throw new Error("Job intake is not enabled yet.");
    if (mutation.current)
      throw new Error("Another action is still being confirmed.");
    mutation.current = true;
    try {
      const { instance, target, run } = await verifiedContext();
      await requestIntake(instance, target, input, request);
      if (run === generation.current && target === workspaceRef.current)
        await reload();
    } finally {
      mutation.current = false;
    }
  };
  const upload: IntakeUploadHandler = async (file, request) => {
    if (!manualIntake) throw new Error("Job intake is not enabled yet.");
    if (mutation.current)
      throw new Error("Another action is still being confirmed.");
    mutation.current = true;
    try {
      const { instance, profile, target, run } = await verifiedContext();
      const input = await uploadIntake(
        instance,
        file,
        target,
        profile.principal.id,
        request,
      );
      if (run !== generation.current || target !== workspaceRef.current)
        throw new Error(
          "Your workspace changed. Start again in the current workspace.",
        );
      return input;
    } finally {
      mutation.current = false;
    }
  };
  const deliver: MaterialDeliveryHandler = async (material, artifact) => {
    if (!materialDelivery) throw new Error("File delivery is not enabled yet.");
    const { instance, target, run } = await verifiedContext();
    if (material.workspace_id !== target || artifact.workspace_id !== target)
      throw new Error("This material belongs to a different workspace.");
    const blob = await loadMaterialArtifact(instance, material, artifact);
    if (run !== generation.current || target !== workspaceRef.current)
      throw new Error("Your workspace changed. Open the material again.");
    return blob;
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
        domainActions: !!interview || !!offer,
        outreach,
        actOutreach,
        act,
        manualIntake,
        materialDelivery,
        intake,
        upload,
        deliver,
        signIn,
        signOut,
        selectWorkspace,
        reload,
      }}
    >
      <InterviewContext.Provider value={identity ? interview : null}>
        <OfferContext.Provider value={identity ? offer : null}>
          {children}
        </OfferContext.Provider>
      </InterviewContext.Provider>
    </Context.Provider>
  );
}
