import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "./supabaseClient.js";
import { ROLES } from "./constants.js";
import { inputCls, btnPrimary, Field } from "./ui.jsx";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("*, organization:org_id (id, name, type, join_code)")
      .eq("id", userId)
      .maybeSingle();
    setProfile(data || null);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadProfile(data.session?.user?.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, sess) => {
      setSession(sess);
      await loadProfile(sess?.user?.id);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const value = {
    session,
    profile,
    loading,
    refreshProfile: () => loadProfile(session?.user?.id),
    signOut: () => supabase.auth.signOut(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/* ---------------- Login / Sign up ---------------- */

export function AuthPage() {
  const [mode, setMode] = useState("login"); // 'login' | 'signup'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) {
          setMsg("Account created. Check your email to confirm, then sign in.");
          setMode("login");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <h1 className="text-lg font-bold text-slate-800 mb-1">
        {mode === "login" ? "Sign in" : "Create your account"}
      </h1>
      <p className="text-sm text-slate-500 mb-5">NDT Inspection Portal</p>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <input type="email" required className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <input type="password" required minLength={6} className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {err && <p className="text-sm text-rose-600">{err}</p>}
        {msg && <p className="text-sm text-emerald-600">{msg}</p>}
        <button disabled={busy} className={btnPrimary + " w-full"}>
          {busy ? "…" : mode === "login" ? "Sign in" : "Sign up"}
        </button>
      </form>
      <p className="text-sm text-slate-500 mt-4 text-center">
        {mode === "login" ? "No account yet?" : "Already have an account?"}{" "}
        <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setErr(null); setMsg(null); }} className="text-slate-900 font-medium underline">
          {mode === "login" ? "Sign up" : "Sign in"}
        </button>
      </p>
    </Shell>
  );
}

/* ---------------- Onboarding (first login → create profile) ---------------- */

export function OnboardingPage() {
  const { session, refreshProfile, signOut } = useAuth();
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("client");
  const [mode, setMode] = useState("create"); // 'create' | 'join'
  const [orgName, setOrgName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const { error } = await supabase.rpc("setup_account", {
        p_full_name: fullName,
        p_role: role,
        p_mode: mode,
        p_org_name: mode === "create" ? orgName : null,
        p_join_code: mode === "join" ? joinCode : null,
      });
      if (error) throw error;
      await refreshProfile();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  const isClient = role === "client";
  const createLabel = isClient ? "Construction firm name" : "Inspection company name";

  return (
    <Shell>
      <h1 className="text-lg font-bold text-slate-800 mb-1">Set up your profile</h1>
      <p className="text-sm text-slate-500 mb-5">Signed in as {session?.user?.email}</p>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Your full name">
          <input required className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" />
        </Field>
        <Field label="Your role">
          <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="client">{ROLES.client.emoji} Client — request inspections</option>
            <option value="dispatcher">{ROLES.dispatcher.emoji} Dispatcher — assign inspectors</option>
            <option value="inspector">{ROLES.inspector.emoji} Inspector — perform inspections</option>
          </select>
        </Field>

        <div className="flex bg-slate-100 rounded-lg p-1 text-sm">
          <button type="button" onClick={() => setMode("create")} className={"flex-1 py-1.5 rounded-md font-medium " + (mode === "create" ? "bg-white shadow-sm" : "text-slate-500")}>
            Create {isClient ? "firm" : "company"}
          </button>
          <button type="button" onClick={() => setMode("join")} className={"flex-1 py-1.5 rounded-md font-medium " + (mode === "join" ? "bg-white shadow-sm" : "text-slate-500")}>
            Join with code
          </button>
        </div>

        {mode === "create" ? (
          <Field label={createLabel}>
            <input required className={inputCls} value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder={isClient ? "Acme Construction" : "Precision NDT Services"} />
          </Field>
        ) : (
          <Field label="Organization join code">
            <input required className={inputCls} value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="A1B2C3" />
          </Field>
        )}

        {err && <p className="text-sm text-rose-600">{err}</p>}
        <button disabled={busy} className={btnPrimary + " w-full"}>{busy ? "…" : "Continue"}</button>
      </form>
      <button onClick={signOut} className="text-sm text-slate-400 underline mt-4 block mx-auto">Sign out</button>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white grid place-items-center font-bold text-sm">N</div>
          <span className="font-semibold text-slate-700">NDT Portal</span>
        </div>
        {children}
      </div>
    </div>
  );
}
