import React, { useState } from "react";
import { NDT_METHODS } from "./constants.js";
import { Field, inputCls, btnPrimary, fromLocalInput } from "./ui.jsx";
import { createWorkOrder } from "./api.js";

const todayDate = () => new Date().toISOString().slice(0, 10);

const blankForm = (profile) => ({
  clientName: profile?.organization?.name || "",
  clientAddress: "",
  clientContact: profile?.full_name || "",
  clientPhone: "",
  clientEmail: profile?.email || "",
  dateOfRequest: todayDate(),
  requiredDateTime: "",
  items: "",
  directions: "",
  special: "",
  methods: [],
});

export function WorkOrderForm({ profile, onCreated }) {
  const [f, setF] = useState(() => blankForm(profile));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [open, setOpen] = useState(true);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const toggleMethod = (code) =>
    setF((p) => ({
      ...p,
      methods: p.methods.includes(code) ? p.methods.filter((m) => m !== code) : [...p.methods, code],
    }));

  const submit = async (e) => {
    e.preventDefault();
    if (!f.clientName.trim() || !f.items.trim()) {
      setErr("Client and Items for Inspection are required.");
      return;
    }
    if (f.methods.length === 0) {
      setErr("Select at least one method of inspection.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await createWorkOrder(profile, { ...f, requiredDateTime: fromLocalInput(f.requiredDateTime) });
      setF(blankForm(profile));
      onCreated?.();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-5 py-4 text-left">
        <span className="font-semibold text-slate-800">New Work Order</span>
        <span className="text-slate-400 text-sm">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <form onSubmit={submit} className="px-5 pb-5 space-y-5 border-t border-slate-100 pt-4">
          {/* Client Info */}
          <fieldset>
            <legend className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-3">Client Info</legend>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Client"><input className={inputCls} value={f.clientName} onChange={set("clientName")} placeholder="Acme Construction" /></Field>
              <Field label="Address"><input className={inputCls} value={f.clientAddress} onChange={set("clientAddress")} /></Field>
              <Field label="Contact"><input className={inputCls} value={f.clientContact} onChange={set("clientContact")} /></Field>
              <Field label="Phone"><input className={inputCls} value={f.clientPhone} onChange={set("clientPhone")} /></Field>
              <Field label="Email"><input type="email" className={inputCls} value={f.clientEmail} onChange={set("clientEmail")} /></Field>
            </div>
          </fieldset>

          {/* Job Info */}
          <fieldset>
            <legend className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-3">Job Info</legend>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Date of Request"><input type="date" className={inputCls} value={f.dateOfRequest} onChange={set("dateOfRequest")} /></Field>
              <Field label="Required Date and Time"><input type="datetime-local" className={inputCls} value={f.requiredDateTime} onChange={set("requiredDateTime")} /></Field>
            </div>
            <div className="mt-3 space-y-3">
              <Field label="Items for Inspection"><textarea className={inputCls} rows="2" value={f.items} onChange={set("items")} placeholder="e.g. Tower B weld joints, bend areas…" /></Field>
              <Field label="Directions to site"><textarea className={inputCls} rows="2" value={f.directions} onChange={set("directions")} /></Field>
              <Field label="Special Instructions"><textarea className={inputCls} rows="2" value={f.special} onChange={set("special")} /></Field>
            </div>

            <div className="mt-3">
              <span className="text-sm font-medium text-slate-700">Method(s) of Inspection</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {NDT_METHODS.map((m) => {
                  const active = f.methods.includes(m.code);
                  return (
                    <button
                      type="button"
                      key={m.code}
                      onClick={() => toggleMethod(m.code)}
                      title={m.label}
                      className={
                        "px-3 py-1.5 rounded-lg text-sm font-medium border transition " +
                        (active ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50")
                      }
                    >
                      {m.code}
                    </button>
                  );
                })}
              </div>
            </div>
          </fieldset>

          {err && <p className="text-sm text-rose-600">{err}</p>}
          <button disabled={busy} className={btnPrimary + " w-full"}>{busy ? "Submitting…" : "Submit Work Order"}</button>
        </form>
      )}
    </div>
  );
}
