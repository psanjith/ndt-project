import React from "react";
import { supabaseConfigured } from "./supabaseClient.js";
import { AuthProvider, useAuth, AuthPage, OnboardingPage } from "./auth.jsx";
import { ClientView, DispatcherView, InspectorView } from "./views.jsx";
import { ROLES } from "./constants.js";

export default function App() {
  if (!supabaseConfigured) return <SetupNeeded />;
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}

function Gate() {
  const { session, profile, loading } = useAuth();
  if (loading) return <Centered>Loading…</Centered>;
  if (!session) return <AuthPage />;
  if (!profile) return <OnboardingPage />;
  return <Workspace />;
}

function Workspace() {
  const { profile, signOut } = useAuth();
  const role = ROLES[profile.role];
  const org = profile.organization;
  const isOwnerOfInspectionCo = org?.type === "inspection";

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-900 text-white grid place-items-center font-bold">N</div>
            <div>
              <div className="font-bold text-slate-800 leading-tight">NDT Inspection Portal</div>
              <div className="text-xs text-slate-400">{org?.name}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isOwnerOfInspectionCo && (
              <div className="hidden sm:block text-right">
                <div className="text-xs text-slate-400">Team join code</div>
                <div className="font-mono font-semibold text-slate-700 tracking-wider">{org.join_code}</div>
              </div>
            )}
            <div className="text-right">
              <div className="text-sm font-medium text-slate-700">{profile.full_name}</div>
              <div className="text-xs text-slate-400">{role.emoji} {role.label}</div>
            </div>
            <button onClick={signOut} className="text-sm text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg px-3 py-1.5">Sign out</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">{role.label} workspace</h1>
          <p className="text-sm text-slate-500">{role.sub}</p>
        </div>
        {profile.role === "client" && <ClientView profile={profile} />}
        {profile.role === "dispatcher" && <DispatcherView profile={profile} />}
        {profile.role === "inspector" && <InspectorView profile={profile} />}
      </main>
    </div>
  );
}

function Centered({ children }) {
  return <div className="min-h-screen grid place-items-center text-slate-500">{children}</div>;
}

function SetupNeeded() {
  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h1 className="text-lg font-bold text-slate-800 mb-2">Connect Supabase to continue</h1>
        <p className="text-sm text-slate-600 mb-4">
          The app needs a Supabase project. Copy <code className="bg-slate-100 px-1 rounded">.env.example</code> to{" "}
          <code className="bg-slate-100 px-1 rounded">.env</code>, paste your project URL and anon key, then restart the dev server.
        </p>
        <ol className="text-sm text-slate-600 list-decimal pl-5 space-y-1">
          <li>Create a free project at supabase.com</li>
          <li>Run <code className="bg-slate-100 px-1 rounded">supabase/schema.sql</code> in the SQL Editor</li>
          <li>Copy Project Settings → API values into <code className="bg-slate-100 px-1 rounded">.env</code></li>
          <li>Restart <code className="bg-slate-100 px-1 rounded">npm run dev</code></li>
        </ol>
      </div>
    </div>
  );
}
