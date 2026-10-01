"use client";
import { useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useSession } from "./session";
import { HqShell } from "./hq-shell";

export function WorkspaceScreen({ selectedId }: { selectedId?: string }) {
  const session = useSession();
  const [email, setEmail] = useState("diana@marencoai.com");
  const [password, setPassword] = useState("");
  if (!session.identity)
    return (
      <main className="login-page">
        <section className="login-card">
          <div className="brand-mark">HQ</div>
          <p className="eyebrow">YOUR CANDIDATE COCKPIT</p>
          <h1>Job Hunt HQ</h1>
          <p className="muted">Turn opportunities into outcomes.</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const entered = password;
              setPassword("");
              void session.signIn(email, entered);
            }}
          >
            <label>
              Email
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button
              className="button primary"
              disabled={!session.ready || session.loading}
            >
              {session.loading ? "Signing in…" : "Sign in"}
              <ArrowRight size={17} />
            </button>
          </form>
          {session.error && (
            <p role="alert" className="error">
              {session.error}
            </p>
          )}
          <p className="login-note">
            <ShieldCheck size={18} />{" "}
            {session.humanActions
              ? "Candidate workspace."
              : "Read-only preview."}{" "}
            Your session stays in browser memory; reloading signs you out.
          </p>
        </section>
      </main>
    );
  return (
    <HqShell
      identity={session.identity}
      data={session.data}
      workspaceId={session.workspaceId}
      selectedId={selectedId}
      loading={session.loading}
      error={session.error}
      onWorkspace={(id) => void session.selectWorkspace(id)}
      onReload={() => void session.reload()}
      onSignOut={() => void session.signOut()}
      onAction={session.humanActions ? session.act : undefined}
    />
  );
}
