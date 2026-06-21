import React from "react";
import { statusLabel, statusColor } from "./constants.js";

export const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400";

export const btnPrimary =
  "bg-slate-900 text-white rounded-lg px-4 py-2 font-medium hover:bg-slate-700 transition disabled:opacity-40";

export function Badge({ status }) {
  return (
    <span className={"text-xs font-semibold px-2.5 py-1 rounded-full border " + (statusColor[status] || "")}>
      {statusLabel[status] || status}
    </span>
  );
}

export function ResultBadge({ result }) {
  if (!result) return null;
  const cls =
    result === "Pass"
      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
      : "bg-rose-100 text-rose-800 border-rose-200";
  return <span className={"text-xs font-semibold px-2.5 py-1 rounded-full border " + cls}>{result}</span>;
}

export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export function Empty({ children }) {
  return (
    <div className="text-center text-slate-400 py-16 border-2 border-dashed border-slate-200 rounded-xl">
      {children}
    </div>
  );
}

export function Info({ label, value }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-slate-700 font-medium">{value}</div>
    </div>
  );
}

export function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
