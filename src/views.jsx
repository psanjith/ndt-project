import React, { useEffect, useState } from "react";
import { NDT_METHODS, STATUS } from "./constants.js";
import { Badge, ResultBadge, Field, Empty, Info, fmtDate, inputCls, btnPrimary } from "./ui.jsx";
import {
  useRequests,
  createRequest,
  claimRequest,
  assignInspector,
  startInspection,
  completeInspection,
  listMyInspectors,
  saveReport,
} from "./api.js";
import { ExaminationReport } from "./reportForm.jsx";

/* ===================== CLIENT ===================== */
export function ClientView({ profile }) {
  const { requests } = useRequests(profile);
  const [reportFor, setReportFor] = useState(null);
  const [form, setForm] = useState({ project: "", site: "", method: "MT", requestedDate: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.project || !form.site) return;
    setBusy(true);
    setErr(null);
    try {
      await createRequest(profile, form);
      setForm({ project: "", site: "", method: "MT", requestedDate: "", notes: "" });
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid md:grid-cols-5 gap-6">
      <div className="md:col-span-2">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-800 mb-4">Request an Inspection</h2>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Project"><input className={inputCls} value={form.project} onChange={set("project")} placeholder="Tower B – Weld joints" /></Field>
            <Field label="Site address"><input className={inputCls} value={form.site} onChange={set("site")} placeholder="1200 Harbor Rd, Unit 4" /></Field>
            <Field label="NDT method">
              <select className={inputCls} value={form.method} onChange={set("method")}>
                {NDT_METHODS.map((m) => <option key={m.code} value={m.code}>{m.label}</option>)}
              </select>
            </Field>
            <Field label="Requested date"><input type="date" className={inputCls} value={form.requestedDate} onChange={set("requestedDate")} /></Field>
            <Field label="Notes"><textarea className={inputCls} rows="2" value={form.notes} onChange={set("notes")} placeholder="Access details, scope, etc." /></Field>
            {err && <p className="text-sm text-rose-600">{err}</p>}
            <button disabled={busy} className={btnPrimary + " w-full"}>{busy ? "…" : "Submit request"}</button>
          </form>
        </div>
      </div>

      <div className="md:col-span-3 space-y-3">
        <h2 className="font-semibold text-slate-800">My Requests</h2>
        {requests.length === 0 && <Empty>No requests yet. Submit one to get started.</Empty>}
        {requests.map((r) => (
          <div key={r.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-slate-800">{r.project}</div>
                <div className="text-sm text-slate-500">{r.site}</div>
              </div>
              <div className="flex gap-2 items-center"><ResultBadge result={r.result} /><Badge status={r.status} /></div>
            </div>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <Info label="Method" value={r.method} />
              <Info label="Requested" value={fmtDate(r.requested_date)} />
              <Info label="Inspection Co." value={r.inspection_org_name || "—"} />
              <Info label="Scheduled" value={fmtDate(r.scheduled_date)} />
            </div>
            {r.result && r.inspector_notes && (
              <div className="mt-3 text-sm bg-slate-50 rounded-lg p-3 text-slate-600">
                <span className="font-medium text-slate-700">Inspector notes:</span> {r.inspector_notes}
              </div>
            )}
            {r.report && (
              <button onClick={() => setReportFor(r)} className="mt-3 text-sm font-medium text-slate-700 underline">
                View examination report
              </button>
            )}
          </div>
        ))}
      </div>

      {reportFor && (
        <ExaminationReport request={reportFor} readOnly onClose={() => setReportFor(null)} />
      )}
    </div>
  );
}

/* ===================== DISPATCHER ===================== */
export function DispatcherView({ profile }) {
  const { requests } = useRequests(profile);
  const open = requests.filter((r) => r.status === STATUS.OPEN);
  const mine = requests.filter((r) => r.inspection_org_id === profile.org_id);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-semibold text-slate-800 mb-3">Open Jobs (marketplace) <span className="text-slate-400">({open.length})</span></h2>
        {open.length === 0 && <Empty>No open jobs right now.</Empty>}
        <div className="grid md:grid-cols-2 gap-4">
          {open.map((r) => <OpenJobCard key={r.id} r={r} profile={profile} />)}
        </div>
      </section>

      <section>
        <h2 className="font-semibold text-slate-800 mb-3">My Company's Jobs <span className="text-slate-400">({mine.length})</span></h2>
        {mine.length === 0 && <Empty>You haven't claimed any jobs yet.</Empty>}
        <div className="grid md:grid-cols-2 gap-4">
          {mine.map((r) => <CompanyJobCard key={r.id} r={r} profile={profile} />)}
        </div>
      </section>
    </div>
  );
}

function OpenJobCard({ r, profile }) {
  const [busy, setBusy] = useState(false);
  const claim = async () => { setBusy(true); try { await claimRequest(profile, r.id); } finally { setBusy(false); } };
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-slate-800">{r.project}</div>
          <div className="text-sm text-slate-500">{r.client_org_name} · {r.site}</div>
        </div>
        <Badge status={r.status} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <Info label="Method" value={r.method} />
        <Info label="Requested" value={fmtDate(r.requested_date)} />
      </div>
      {r.notes && <p className="mt-2 text-sm text-slate-500 italic">"{r.notes}"</p>}
      <button onClick={claim} disabled={busy} className={btnPrimary + " w-full mt-4"}>{busy ? "…" : "Claim job"}</button>
    </div>
  );
}

function CompanyJobCard({ r, profile }) {
  const [inspectors, setInspectors] = useState([]);
  const [inspectorId, setInspectorId] = useState("");
  const [date, setDate] = useState(r.requested_date || "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (r.status === STATUS.CLAIMED) listMyInspectors(profile).then(setInspectors).catch(() => {});
  }, [r.status, profile]);

  const assign = async () => {
    const insp = inspectors.find((i) => i.id === inspectorId);
    if (!insp) return;
    setBusy(true);
    try { await assignInspector(r.id, insp, date); } finally { setBusy(false); }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-slate-800">{r.project}</div>
          <div className="text-sm text-slate-500">{r.client_org_name} · {r.site}</div>
        </div>
        <div className="flex gap-2 items-center"><ResultBadge result={r.result} /><Badge status={r.status} /></div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
        <Info label="Method" value={r.method} />
        <Info label="Inspector" value={r.inspector_name || "—"} />
        <Info label="Scheduled" value={fmtDate(r.scheduled_date)} />
      </div>

      {r.status === STATUS.CLAIMED && (
        <div className="mt-4 flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[140px]">
            <Field label="Assign inspector">
              <select className={inputCls} value={inspectorId} onChange={(e) => setInspectorId(e.target.value)}>
                <option value="">Select…</option>
                {inspectors.map((i) => <option key={i.id} value={i.id}>{i.full_name}</option>)}
              </select>
            </Field>
          </div>
          <div className="min-w-[140px]">
            <Field label="Schedule"><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          </div>
          <button onClick={assign} disabled={!inspectorId || busy} className={btnPrimary}>{busy ? "…" : "Assign"}</button>
        </div>
      )}
      {r.status === STATUS.CLAIMED && inspectors.length === 0 && (
        <p className="mt-2 text-xs text-amber-600">No inspectors in your company yet. Share your join code so an inspector can join.</p>
      )}
    </div>
  );
}

/* ===================== INSPECTOR ===================== */
export function InspectorView({ profile }) {
  const { requests } = useRequests(profile);
  const [reportFor, setReportFor] = useState(null);
  const todo = requests.filter((r) => r.status !== STATUS.COMPLETED);
  const done = requests.filter((r) => r.status === STATUS.COMPLETED);

  return (
    <div className="space-y-6">
      <section>
        <h2 className="font-semibold text-slate-800 mb-3">Assigned to me <span className="text-slate-400">({todo.length})</span></h2>
        {todo.length === 0 && <Empty>No active assignments.</Empty>}
        <div className="grid md:grid-cols-2 gap-4">
          {todo.map((r) => <InspectorCard key={r.id} r={r} />)}
        </div>
      </section>

      {done.length > 0 && (
        <section>
          <h2 className="font-semibold text-slate-800 mb-3">Completed <span className="text-slate-400">({done.length})</span></h2>
          <div className="grid md:grid-cols-2 gap-4">
            {done.map((r) => (
              <div key={r.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-slate-800">{r.project}</div>
                  <ResultBadge result={r.result} />
                </div>
                <div className="text-sm text-slate-500">{r.client_org_name} · {r.site}</div>
                {r.inspector_notes && <p className="mt-2 text-sm text-slate-600">{r.inspector_notes}</p>}
                <div className="mt-3 flex items-center gap-2">
                  <button onClick={() => setReportFor(r)} className={btnPrimary + " text-sm"}>
                    {r.report ? "Edit examination report" : "Fill examination report"}
                  </button>
                  {r.report && <span className="text-xs text-emerald-600 font-medium">✓ Report on file</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {reportFor && (
        <ExaminationReport
          request={reportFor}
          onSave={(report) => saveReport(reportFor.id, report)}
          onClose={() => setReportFor(null)}
        />
      )}
    </div>
  );
}

function InspectorCard({ r }) {
  const [notes, setNotes] = useState(r.inspector_notes || "");
  const [busy, setBusy] = useState(false);

  const start = async () => { setBusy(true); try { await startInspection(r.id); } finally { setBusy(false); } };
  const complete = async (result) => { setBusy(true); try { await completeInspection(r.id, result, notes); } finally { setBusy(false); } };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-slate-800">{r.project}</div>
          <div className="text-sm text-slate-500">{r.client_org_name} · {r.site}</div>
        </div>
        <Badge status={r.status} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <Info label="Method" value={r.method} />
        <Info label="Scheduled" value={fmtDate(r.scheduled_date)} />
      </div>
      {r.notes && <p className="mt-2 text-sm text-slate-500 italic">Client: "{r.notes}"</p>}

      {r.status === STATUS.ASSIGNED && (
        <button onClick={start} disabled={busy} className="mt-4 w-full bg-indigo-600 text-white rounded-lg py-2 font-medium hover:bg-indigo-500 transition disabled:opacity-40">Start inspection</button>
      )}

      {r.status === STATUS.IN_PROGRESS && (
        <div className="mt-4 space-y-3">
          <Field label="Inspection notes"><textarea className={inputCls} rows="2" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Findings…" /></Field>
          <div className="flex gap-2">
            <button onClick={() => complete("Pass")} disabled={busy} className="flex-1 bg-emerald-600 text-white rounded-lg py-2 font-medium hover:bg-emerald-500 transition disabled:opacity-40">Mark Pass</button>
            <button onClick={() => complete("Fail")} disabled={busy} className="flex-1 bg-rose-600 text-white rounded-lg py-2 font-medium hover:bg-rose-500 transition disabled:opacity-40">Mark Fail</button>
          </div>
        </div>
      )}
    </div>
  );
}
