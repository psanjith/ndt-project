import React, { useEffect, useState } from "react";
import { STATUS } from "./constants.js";
import { Badge, ResultBadge, Field, Empty, Info, fmtDate, fmtDateTime, toLocalInput, fromLocalInput, inputCls, btnPrimary } from "./ui.jsx";
import {
  useRequests,
  claimRequest,
  assignInspector,
  startInspection,
  completeInspection,
  listMyInspectors,
  saveReport,
  updateEta,
  setQuote,
  generateWorkOrderNo,
  saveWorkOrderNo,
} from "./api.js";
import { ExaminationReport } from "./reportForm.jsx";
import { WorkOrderForm } from "./workOrder.jsx";

const methodsText = (r) => (r.methods && r.methods.length ? r.methods.join(", ") : r.method || "—");
const money = (n) => (n == null ? "—" : "$" + Number(n).toFixed(2));

/* ===================== CLIENT (read-only) ===================== */
export function ClientView({ profile }) {
  const { requests } = useRequests(profile);
  const [reportFor, setReportFor] = useState(null);

  return (
    <div className="space-y-6 max-w-3xl">
      <WorkOrderForm profile={profile} />

      <h2 className="font-semibold text-slate-800">My Work Orders</h2>
      {requests.length === 0 && (
        <Empty>No work orders yet. Submit one above to request an inspection.</Empty>
      )}
      {requests.map((r) => (
        <div key={r.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold text-slate-800">{r.items_for_inspection || r.project}</div>
              <div className="text-sm text-slate-500">{r.work_order_no || ""}</div>
            </div>
            <div className="flex gap-2 items-center"><ResultBadge result={r.result} /><Badge status={r.status} /></div>
          </div>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            <Info label="Method(s)" value={methodsText(r)} />
            <Info label="Inspection Co." value={r.inspection_org_name || "—"} />
            <Info label="Scheduled" value={fmtDate(r.scheduled_date)} />
            <Info label="Quote" value={money(r.quote_amount)} />
          </div>
          {r.eta && r.status !== "completed" && (
            <div className="mt-3 text-sm bg-blue-50 text-blue-800 rounded-lg px-3 py-2 border border-blue-100">
              🚚 Inspector expected on site: <span className="font-semibold">{fmtDateTime(r.eta)}</span>
            </div>
          )}
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

      {reportFor && <ExaminationReport request={reportFor} readOnly onClose={() => setReportFor(null)} />}
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
        <h2 className="font-semibold text-slate-800 mb-3">Incoming Work Orders <span className="text-slate-400">({open.length})</span></h2>
        {open.length === 0 && <Empty>No open work orders right now.</Empty>}
        <div className="grid md:grid-cols-2 gap-4">
          {open.map((r) => <OpenJobCard key={r.id} r={r} profile={profile} />)}
        </div>
      </section>

      <section>
        <h2 className="font-semibold text-slate-800 mb-3">My Company's Work Orders <span className="text-slate-400">({mine.length})</span></h2>
        {mine.length === 0 && <Empty>Claim an incoming work order to start managing it.</Empty>}
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
          <div className="font-semibold text-slate-800">{r.items_for_inspection || r.project}</div>
          <div className="text-sm text-slate-500">{r.client_name || r.client_org_name}</div>
        </div>
        <Badge status={r.status} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <Info label="Method(s)" value={methodsText(r)} />
        <Info label="Required" value={r.required_datetime ? fmtDateTime(r.required_datetime) : fmtDate(r.requested_date)} />
      </div>
      {r.client_address && <p className="mt-2 text-sm text-slate-500">📍 {r.client_address}</p>}
      {r.directions && <p className="mt-1 text-sm text-slate-500">🧭 {r.directions}</p>}
      {r.special_instructions && <p className="mt-1 text-sm text-slate-500 italic">"{r.special_instructions}"</p>}
      <button onClick={claim} disabled={busy} className={btnPrimary + " w-full mt-4"}>{busy ? "…" : "Claim work order"}</button>
    </div>
  );
}

function CompanyJobCard({ r, profile }) {
  const [inspectors, setInspectors] = useState([]);
  const [inspectorId, setInspectorId] = useState("");
  const [date, setDate] = useState(r.requested_date || "");
  const [eta, setEta] = useState(toLocalInput(r.eta));
  const [quote, setQuoteVal] = useState(r.quote_amount ?? "");
  const [companyCode, setCompanyCode] = useState(r.company_code || "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (r.status === STATUS.CLAIMED) listMyInspectors(profile).then(setInspectors).catch(() => {});
  }, [r.status, profile]);

  const saveQuoteAmt = async () => { setBusy(true); try { await setQuote(r.id, quote); } finally { setBusy(false); } };
  const genWorkOrderNo = async () => {
    if (!companyCode.trim()) return;
    setBusy(true);
    try {
      const no = await generateWorkOrderNo(companyCode);
      await saveWorkOrderNo(r.id, no, companyCode);
    } finally {
      setBusy(false);
    }
  };
  const canManage = [STATUS.CLAIMED, STATUS.ASSIGNED, STATUS.IN_PROGRESS].includes(r.status);

  const assign = async () => {
    const insp = inspectors.find((i) => i.id === inspectorId);
    if (!insp) return;
    setBusy(true);
    try { await assignInspector(r.id, insp, date, fromLocalInput(eta)); } finally { setBusy(false); }
  };

  const saveEta = async () => {
    setBusy(true);
    try { await updateEta(r.id, fromLocalInput(eta)); } finally { setBusy(false); }
  };

  const canEditEta = r.status === STATUS.ASSIGNED || r.status === STATUS.IN_PROGRESS;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-slate-800">{r.items_for_inspection || r.project}</div>
          <div className="text-sm text-slate-500">{r.client_name || r.client_org_name}{r.work_order_no ? " · " + r.work_order_no : ""}</div>
        </div>
        <div className="flex gap-2 items-center"><ResultBadge result={r.result} /><Badge status={r.status} /></div>
      </div>
      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
        <Info label="Method(s)" value={methodsText(r)} />
        <Info label="Inspector" value={r.inspector_name || "—"} />
        <Info label="Scheduled" value={fmtDate(r.scheduled_date)} />
        <Info label="Arrival ETA" value={fmtDateTime(r.eta)} />
      </div>
      {r.quote_amount != null && (
        <div className="mt-2 text-sm text-slate-600">Quote: <span className="font-semibold">{money(r.quote_amount)}</span></div>
      )}

      {canManage && (
        <div className="mt-3 border-t border-slate-100 pt-3 space-y-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="min-w-[130px]">
              <Field label="Quote ($)"><input type="number" step="0.01" min="0" className={inputCls} value={quote} onChange={(e) => setQuoteVal(e.target.value)} placeholder="0.00" /></Field>
            </div>
            <button onClick={saveQuoteAmt} disabled={busy} className={btnPrimary}>Save quote</button>
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            {r.work_order_no ? (
              <div className="text-sm">
                <div className="text-xs uppercase tracking-wide text-slate-400">Work Order #</div>
                <div className="font-mono font-semibold text-slate-800">{r.work_order_no}</div>
              </div>
            ) : (
              <>
                <div className="min-w-[130px]">
                  <Field label="Company code"><input className={inputCls} value={companyCode} onChange={(e) => setCompanyCode(e.target.value)} placeholder="ACME" /></Field>
                </div>
                <button onClick={genWorkOrderNo} disabled={busy || !companyCode.trim()} className={btnPrimary}>Generate Work Order #</button>
              </>
            )}
          </div>
        </div>
      )}

      {r.status === STATUS.CLAIMED && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[140px]">
              <Field label="Assign inspector">
                <select className={inputCls} value={inspectorId} onChange={(e) => setInspectorId(e.target.value)}>
                  <option value="">Select…</option>
                  {inspectors.map((i) => <option key={i.id} value={i.id}>{i.full_name}</option>)}
                </select>
              </Field>
            </div>
            <div className="min-w-[130px]">
              <Field label="Schedule"><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[180px]">
              <Field label="Est. arrival on site (shared with client)">
                <input type="datetime-local" className={inputCls} value={eta} onChange={(e) => setEta(e.target.value)} />
              </Field>
            </div>
            <button onClick={assign} disabled={!inspectorId || busy} className={btnPrimary}>{busy ? "…" : "Assign"}</button>
          </div>
          {inspectors.length === 0 && (
            <p className="text-xs text-amber-600">No inspectors in your company yet. Share your join code so an inspector can join.</p>
          )}
        </div>
      )}

      {canEditEta && (
        <div className="mt-4 flex flex-wrap gap-2 items-end border-t border-slate-100 pt-3">
          <div className="flex-1 min-w-[180px]">
            <Field label="Update arrival estimate (shared with client)">
              <input type="datetime-local" className={inputCls} value={eta} onChange={(e) => setEta(e.target.value)} />
            </Field>
          </div>
          <button onClick={saveEta} disabled={busy} className={btnPrimary}>{busy ? "…" : "Update ETA"}</button>
        </div>
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
                  <div className="font-semibold text-slate-800">{r.items_for_inspection || r.project}</div>
                  <ResultBadge result={r.result} />
                </div>
                <div className="text-sm text-slate-500">{r.client_name || r.client_org_name}{r.work_order_no ? " · " + r.work_order_no : ""}</div>
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
          <div className="font-semibold text-slate-800">{r.items_for_inspection || r.project}</div>
          <div className="text-sm text-slate-500">{r.client_name || r.client_org_name}{r.work_order_no ? " · " + r.work_order_no : ""}</div>
        </div>
        <Badge status={r.status} />
      </div>
      <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
        <Info label="Method(s)" value={methodsText(r)} />
        <Info label="Scheduled" value={fmtDate(r.scheduled_date)} />
        <Info label="Arrival ETA" value={fmtDateTime(r.eta)} />
      </div>
      {r.client_address && <p className="mt-2 text-sm text-slate-500">📍 {r.client_address}</p>}
      {r.directions && <p className="mt-1 text-sm text-slate-500">🧭 {r.directions}</p>}
      {r.special_instructions && <p className="mt-1 text-sm text-slate-500 italic">Note: "{r.special_instructions}"</p>}

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
