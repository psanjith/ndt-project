import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Field, inputCls, btnPrimary } from "./ui.jsx";
import { uploadReportPhoto, getSignedUrls, removeReportPhoto } from "./api.js";

const today = () => new Date().toISOString().slice(0, 10);

// Make a compressed JPEG data URL from a local file (no network/CORS needed).
// Embedded in the report so photos render reliably on screen and in print.
function fileToThumbDataUrl(file, maxDim = 1400, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    img.src = url;
  });
}

function blankItem() {
  return {
    lineEquipId: "",
    weldId: "",
    welderId: "",
    isoDwg: "",
    lineClass: "",
    weldType: "",
    dia: "",
    thk: "",
    comments: "",
    result: "Accept",
  };
}

function buildInitial(request) {
  if (request.report) return request.report;
  return {
    reportNo: "",
    date: today(),
    project: {
      client: request.client_org_name || "",
      projectNo: "",
      site: request.site || "",
      procedure: "",
      projectName: request.project || "",
      code: "",
      contact: "",
      contractorPo: "",
      clientRequestNo: "",
      clientSpec: "",
      subSystem: "",
      lineNo: "",
    },
    description: "",
    equipment: {
      examMethod: "Continuous",
      particleType: "Visible Wet",
      powerSupply: "AC",
      testEquipType: "Yoke",
      testEquipSN: "",
      testModelNumber: "",
      lightingEquip: "",
      lightingEquipSN: "",
      equipCalCheck: "Daily",
      lightMeter: "",
      lightMeterSN: "",
      lightingCalCheck: "Daily",
      particleBrand: "",
      particleProduct: "",
      lightMeterCalDue: "",
      particleBatchNo: "",
      contrastPaint: "",
      liftingPowerVerified: "Yes",
      barWeight: "",
      contrastPaintBatchNo: "",
    },
    examined: { material: "", surfaceCondition: "", surfaceTemp: "", location: "" },
    items: [{ ...blankItem(), result: request.result === "Fail" ? "Reject" : "Accept" }],
    notes: {
      summary: "No rejectable indications were found at the time of inspection.",
      cwp: "",
      heatNumber: "",
      area: "",
      liftBlockSerial: "",
    },
    audit: { technician: request.inspector_name || "", certification: "", qaRep: "", datePrinted: today() },
    photos: [],
  };
}

export function ExaminationReport({ request, readOnly = false, onSave, onClose }) {
  const [r, setR] = useState(() => buildInitial(request));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [uploading, setUploading] = useState(false);
  // Signed URLs are only a fallback for older photos saved without an embedded
  // thumbnail. New photos carry their own data URL (ph.thumb), so they render
  // and print without any network fetch.
  const [photoUrls, setPhotoUrls] = useState({});
  const photoKey = (r.photos || []).filter((p) => !p.thumb).map((p) => p.path).join("|");

  useEffect(() => {
    let cancelled = false;
    const paths = photoKey ? photoKey.split("|") : [];
    if (paths.length === 0) {
      setPhotoUrls({});
      return;
    }
    getSignedUrls(paths).then((m) => !cancelled && setPhotoUrls(m)).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [photoKey]);

  const addPhotos = async (files) => {
    setUploading(true);
    setErr(null);
    try {
      for (const file of files) {
        const thumb = await fileToThumbDataUrl(file).catch(() => null);
        const path = await uploadReportPhoto(request.id, file);
        setR((p) => ({ ...p, photos: [...(p.photos || []), { path, caption: "", thumb }] }));
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setUploading(false);
    }
  };

  const setCaption = (i, caption) =>
    setR((p) => {
      const photos = [...(p.photos || [])];
      photos[i] = { ...photos[i], caption };
      return { ...p, photos };
    });

  const removePhoto = async (i) => {
    const ph = (r.photos || [])[i];
    setR((p) => ({ ...p, photos: (p.photos || []).filter((_, idx) => idx !== i) }));
    if (ph?.path) {
      try {
        await removeReportPhoto(ph.path);
      } catch {
        /* leave orphan file; not fatal */
      }
    }
  };

  const top = (key) => (e) => setR((p) => ({ ...p, [key]: e.target.value }));
  const sec = (section, key) => (e) =>
    setR((p) => ({ ...p, [section]: { ...p[section], [key]: e.target.value } }));

  const setItem = (i, key, val) =>
    setR((p) => {
      const items = [...p.items];
      items[i] = { ...items[i], [key]: val };
      return { ...p, items };
    });
  const addItem = () => setR((p) => ({ ...p, items: [...p.items, blankItem()] }));
  const removeItem = (i) => setR((p) => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }));

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await onSave(r);
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const ro = readOnly;

  return (
    <div className="fixed inset-0 bg-black/40 overflow-y-auto z-50">
      <div className="max-w-4xl mx-auto my-6 bg-white rounded-xl shadow-xl">
        {/* Sticky header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 rounded-t-xl px-6 py-4 flex items-center justify-between z-10">
          <div>
            <div className="font-bold text-slate-800 text-lg">Magnetic Particle Examination Report</div>
            <div className="text-xs text-slate-400">{request.inspection_org_name || "Inspection Company"}</div>
          </div>
          <div className="flex items-center gap-2">
            {!ro && (
              <button onClick={save} disabled={busy} className={btnPrimary}>
                {busy ? "Saving…" : "Save report"}
              </button>
            )}
            <button onClick={() => window.print()} className="text-sm text-slate-700 hover:bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-medium">
              Print / Save as PDF
            </button>
            <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg px-3 py-2">
              Close
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-6">
          {err && <p className="text-sm text-rose-600">{err}</p>}

          <Grid cols="3">
            <RField label="Report No." value={r.reportNo} onChange={top("reportNo")} ro={ro} placeholder="100-02945-MT-0090" />
            <RField label="Date" type="date" value={r.date} onChange={top("date")} ro={ro} />
          </Grid>

          <Section title="Project Information">
            <Grid cols="3">
              <RField label="Client" value={r.project.client} onChange={sec("project", "client")} ro={ro} />
              <RField label="Project No." value={r.project.projectNo} onChange={sec("project", "projectNo")} ro={ro} />
              <RField label="Site" value={r.project.site} onChange={sec("project", "site")} ro={ro} />
              <RField label="Project Name" value={r.project.projectName} onChange={sec("project", "projectName")} ro={ro} />
              <RField label="Procedure" value={r.project.procedure} onChange={sec("project", "procedure")} ro={ro} />
              <RField label="Code" value={r.project.code} onChange={sec("project", "code")} ro={ro} placeholder="ASME B31.3" />
              <RField label="Contact" value={r.project.contact} onChange={sec("project", "contact")} ro={ro} />
              <RField label="Contractor PO No." value={r.project.contractorPo} onChange={sec("project", "contractorPo")} ro={ro} />
              <RField label="Client Request No." value={r.project.clientRequestNo} onChange={sec("project", "clientRequestNo")} ro={ro} />
              <RField label="Client Spec." value={r.project.clientSpec} onChange={sec("project", "clientSpec")} ro={ro} />
              <RField label="Sub-System" value={r.project.subSystem} onChange={sec("project", "subSystem")} ro={ro} />
              <RField label="Line No." value={r.project.lineNo} onChange={sec("project", "lineNo")} ro={ro} />
            </Grid>
            <div className="mt-3">
              <RField label="Description" value={r.description} onChange={top("description")} ro={ro} textarea />
            </div>
          </Section>

          <Section title="Examination Equipment & Parameters">
            <Grid cols="3">
              <RField label="Examination Method" value={r.equipment.examMethod} onChange={sec("equipment", "examMethod")} ro={ro} options={["Continuous", "Residual"]} />
              <RField label="Particle Type" value={r.equipment.particleType} onChange={sec("equipment", "particleType")} ro={ro} options={["Visible Wet", "Visible Dry", "Fluorescent Wet"]} />
              <RField label="Power Supply" value={r.equipment.powerSupply} onChange={sec("equipment", "powerSupply")} ro={ro} options={["AC", "DC", "HWDC"]} />
              <RField label="Testing Equip. Type" value={r.equipment.testEquipType} onChange={sec("equipment", "testEquipType")} ro={ro} options={["Yoke", "Prods", "Coil", "Central Conductor"]} />
              <RField label="Testing Equip. S/N" value={r.equipment.testEquipSN} onChange={sec("equipment", "testEquipSN")} ro={ro} />
              <RField label="Testing Model / Equip. No." value={r.equipment.testModelNumber} onChange={sec("equipment", "testModelNumber")} ro={ro} placeholder="Magnaflux Y-2" />
              <RField label="Lighting Equip." value={r.equipment.lightingEquip} onChange={sec("equipment", "lightingEquip")} ro={ro} />
              <RField label="Lighting Equip. S/N" value={r.equipment.lightingEquipSN} onChange={sec("equipment", "lightingEquipSN")} ro={ro} />
              <RField label="Equip. Cal. Check" value={r.equipment.equipCalCheck} onChange={sec("equipment", "equipCalCheck")} ro={ro} options={["Daily", "Weekly", "Monthly"]} />
              <RField label="Light Meter" value={r.equipment.lightMeter} onChange={sec("equipment", "lightMeter")} ro={ro} />
              <RField label="Light Meter S/N" value={r.equipment.lightMeterSN} onChange={sec("equipment", "lightMeterSN")} ro={ro} />
              <RField label="Lighting Cal. Check" value={r.equipment.lightingCalCheck} onChange={sec("equipment", "lightingCalCheck")} ro={ro} options={["Daily", "Weekly", "Monthly"]} />
              <RField label="MPI Particle Brand" value={r.equipment.particleBrand} onChange={sec("equipment", "particleBrand")} ro={ro} />
              <RField label="Particle Product" value={r.equipment.particleProduct} onChange={sec("equipment", "particleProduct")} ro={ro} />
              <RField label="Light Meter Cal. Due Date" type="date" value={r.equipment.lightMeterCalDue} onChange={sec("equipment", "lightMeterCalDue")} ro={ro} />
              <RField label="Particle Batch No." value={r.equipment.particleBatchNo} onChange={sec("equipment", "particleBatchNo")} ro={ro} />
              <RField label="Contrast Paint" value={r.equipment.contrastPaint} onChange={sec("equipment", "contrastPaint")} ro={ro} />
              <RField label="Contrast Paint Batch No." value={r.equipment.contrastPaintBatchNo} onChange={sec("equipment", "contrastPaintBatchNo")} ro={ro} />
              <RField label="Lifting Power Verified?" value={r.equipment.liftingPowerVerified} onChange={sec("equipment", "liftingPowerVerified")} ro={ro} options={["Yes", "No", "N/A"]} />
              <RField label="Bar Weight" value={r.equipment.barWeight} onChange={sec("equipment", "barWeight")} ro={ro} placeholder="10 lbs" />
            </Grid>
          </Section>

          <Section title="Examined Items Details">
            <Grid cols="4">
              <RField label="Material" value={r.examined.material} onChange={sec("examined", "material")} ro={ro} />
              <RField label="Surface Condition" value={r.examined.surfaceCondition} onChange={sec("examined", "surfaceCondition")} ro={ro} placeholder="Buffed" />
              <RField label="Surface Temp." value={r.examined.surfaceTemp} onChange={sec("examined", "surfaceTemp")} ro={ro} placeholder="16 °C" />
              <RField label="Location" value={r.examined.location} onChange={sec("examined", "location")} ro={ro} />
            </Grid>
          </Section>

          <Section title="Examination Details & Results">
            <div className="space-y-3">
              {r.items.map((it, i) => (
                <div key={i} className="border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-400">Item {i + 1}</span>
                    {!ro && r.items.length > 1 && (
                      <button onClick={() => removeItem(i)} className="text-xs text-rose-600 hover:underline">Remove</button>
                    )}
                  </div>
                  <Grid cols="4">
                    <RField label="Line / Equip. ID" value={it.lineEquipId} onChange={(e) => setItem(i, "lineEquipId", e.target.value)} ro={ro} />
                    <RField label="Weld ID" value={it.weldId} onChange={(e) => setItem(i, "weldId", e.target.value)} ro={ro} />
                    <RField label="Welder ID" value={it.welderId} onChange={(e) => setItem(i, "welderId", e.target.value)} ro={ro} />
                    <RField label="ISO DWG" value={it.isoDwg} onChange={(e) => setItem(i, "isoDwg", e.target.value)} ro={ro} />
                    <RField label="Line Class" value={it.lineClass} onChange={(e) => setItem(i, "lineClass", e.target.value)} ro={ro} />
                    <RField label="Weld Type" value={it.weldType} onChange={(e) => setItem(i, "weldType", e.target.value)} ro={ro} />
                    <RField label="Dia." value={it.dia} onChange={(e) => setItem(i, "dia", e.target.value)} ro={ro} placeholder='12"' />
                    <RField label="Thk." value={it.thk} onChange={(e) => setItem(i, "thk", e.target.value)} ro={ro} placeholder="12.7mm" />
                    <RField label="Comments" value={it.comments} onChange={(e) => setItem(i, "comments", e.target.value)} ro={ro} />
                    <RField label="Accept / Reject" value={it.result} onChange={(e) => setItem(i, "result", e.target.value)} ro={ro} options={["Accept", "Reject"]} />
                  </Grid>
                </div>
              ))}
              {!ro && (
                <button onClick={addItem} className="text-sm font-medium text-slate-700 border border-dashed border-slate-300 rounded-lg w-full py-2 hover:bg-slate-50">
                  + Add item / weld
                </button>
              )}
            </div>
            <div className="mt-3">
              <RField label="Summary / remarks" value={r.notes.summary} onChange={sec("notes", "summary")} ro={ro} textarea />
            </div>
            <Grid cols="4">
              <RField label="CWP" value={r.notes.cwp} onChange={sec("notes", "cwp")} ro={ro} />
              <RField label="Heat Number" value={r.notes.heatNumber} onChange={sec("notes", "heatNumber")} ro={ro} />
              <RField label="Area" value={r.notes.area} onChange={sec("notes", "area")} ro={ro} />
              <RField label="Lift Block Serial No." value={r.notes.liftBlockSerial} onChange={sec("notes", "liftBlockSerial")} ro={ro} />
            </Grid>
          </Section>

          <Section title="Audit Information">
            <Grid cols="2">
              <RField label="Technician (print)" value={r.audit.technician} onChange={sec("audit", "technician")} ro={ro} />
              <RField label="QA Representative" value={r.audit.qaRep} onChange={sec("audit", "qaRep")} ro={ro} />
              <RField label="Certification Type, Level & Reg. No." value={r.audit.certification} onChange={sec("audit", "certification")} ro={ro} textarea />
              <RField label="Date Printed" type="date" value={r.audit.datePrinted} onChange={sec("audit", "datePrinted")} ro={ro} />
            </Grid>
          </Section>

          <Section title="Photos">
            {!ro && (
              <label className="inline-block">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    addPhotos(Array.from(e.target.files));
                    e.target.value = "";
                  }}
                />
                <span className="text-sm font-medium text-slate-700 border border-dashed border-slate-300 rounded-lg px-4 py-2 hover:bg-slate-50 cursor-pointer inline-block">
                  {uploading ? "Uploading…" : "+ Add photos"}
                </span>
              </label>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
              {(r.photos || []).map((ph, i) => (
                <div key={ph.path} className="border border-slate-200 rounded-lg p-2">
                  {(ph.thumb || photoUrls[ph.path]) ? (
                    <img src={ph.thumb || photoUrls[ph.path]} alt="" className="w-full h-32 object-cover rounded" />
                  ) : (
                    <div className="w-full h-32 bg-slate-100 rounded grid place-items-center text-xs text-slate-400">Loading…</div>
                  )}
                  <input
                    className={inputCls + " mt-2 text-xs"}
                    placeholder="Caption"
                    value={ph.caption || ""}
                    onChange={(e) => setCaption(i, e.target.value)}
                    readOnly={ro}
                  />
                  {!ro && (
                    <button onClick={() => removePhoto(i)} className="text-xs text-rose-600 hover:underline mt-1">
                      Remove
                    </button>
                  )}
                </div>
              ))}
              {(r.photos || []).length === 0 && <p className="text-sm text-slate-400">No photos added.</p>}
            </div>
            {!ro && (r.photos || []).length > 0 && (
              <p className="text-xs text-slate-400 mt-2">Remember to <b>Save report</b> so photos are stored with this report.</p>
            )}
          </Section>
        </div>

        {/* Rendered into <body> so it paginates correctly; hidden on screen,
            shown only when printing (see .print-only in index.css). */}
        {createPortal(
          <div className="print-only">
            <ReportDocument request={request} report={r} photoUrls={photoUrls} />
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}

/* ---------- small helpers ---------- */
function Grid({ cols = "3", children }) {
  const map = { "2": "sm:grid-cols-2", "3": "sm:grid-cols-2 lg:grid-cols-3", "4": "sm:grid-cols-2 lg:grid-cols-4" };
  return <div className={"grid gap-3 " + (map[cols] || map["3"])}>{children}</div>;
}

function Section({ title, children }) {
  return (
    <div className="border-t border-slate-200 pt-5">
      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function RField({ label, value, onChange, ro, type = "text", placeholder, options, textarea }) {
  return (
    <Field label={label}>
      {options ? (
        <select className={inputCls} value={value || ""} onChange={onChange} disabled={ro}>
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      ) : textarea ? (
        <textarea className={inputCls} rows="2" value={value || ""} onChange={onChange} readOnly={ro} placeholder={placeholder} />
      ) : (
        <input type={type} className={inputCls} value={value || ""} onChange={onChange} readOnly={ro} placeholder={placeholder} />
      )}
    </Field>
  );
}

/* ===================== Printable document layout =====================
   Clean, form-like sheet rendered only when printing (see .print-only in
   index.css). Use the browser print dialog's "Save as PDF" to export. */

function DCell({ label, value, span }) {
  return (
    <div className="border border-slate-400 px-2 py-1" style={{ gridColumn: span ? `span ${span}` : undefined }}>
      <div className="text-[8px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-[11px] text-slate-900 break-words">{value || "—"}</div>
    </div>
  );
}

function DBand({ title }) {
  return (
    <div className="bg-slate-200 border border-slate-400 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-800 mt-3">
      {title}
    </div>
  );
}

export function ReportDocument({ request, report, photoUrls = {} }) {
  const r = report;
  const th = "border border-slate-400 px-1 py-1 text-left bg-slate-100 font-semibold";
  const td = "border border-slate-400 px-1 py-1 align-top";

  return (
    <div className="text-slate-900 p-1" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      {/* Header */}
      <div className="flex items-end justify-between border-b-4 border-slate-800 pb-2">
        <div>
          <div className="text-lg font-extrabold leading-tight">{request.inspection_org_name || "Inspection Company"}</div>
          <div className="text-sm font-semibold text-slate-700">Magnetic Particle Examination Report</div>
        </div>
        <div className="text-[10px] text-right leading-snug">
          <div><span className="font-bold">Report No.:</span> {r.reportNo || "—"}</div>
          <div><span className="font-bold">Date:</span> {r.date || "—"}</div>
        </div>
      </div>

      <DBand title="Project Information" />
      <div className="grid grid-cols-3">
        <DCell label="Client" value={r.project.client} />
        <DCell label="Project No." value={r.project.projectNo} />
        <DCell label="Site" value={r.project.site} />
        <DCell label="Project Name" value={r.project.projectName} />
        <DCell label="Procedure" value={r.project.procedure} />
        <DCell label="Code" value={r.project.code} />
        <DCell label="Contact" value={r.project.contact} />
        <DCell label="Contractor PO No." value={r.project.contractorPo} />
        <DCell label="Client Request No." value={r.project.clientRequestNo} />
        <DCell label="Client Spec." value={r.project.clientSpec} />
        <DCell label="Sub-System" value={r.project.subSystem} />
        <DCell label="Line No." value={r.project.lineNo} />
        <DCell label="Description" value={r.description} span={3} />
      </div>

      <DBand title="Examination Equipment & Parameters" />
      <div className="grid grid-cols-3">
        <DCell label="Examination Method" value={r.equipment.examMethod} />
        <DCell label="Particle Type" value={r.equipment.particleType} />
        <DCell label="Power Supply" value={r.equipment.powerSupply} />
        <DCell label="Testing Equip. Type" value={r.equipment.testEquipType} />
        <DCell label="Testing Equip. S/N" value={r.equipment.testEquipSN} />
        <DCell label="Testing Model / Equip. No." value={r.equipment.testModelNumber} />
        <DCell label="Lighting Equip." value={r.equipment.lightingEquip} />
        <DCell label="Lighting Equip. S/N" value={r.equipment.lightingEquipSN} />
        <DCell label="Equip. Cal. Check" value={r.equipment.equipCalCheck} />
        <DCell label="Light Meter" value={r.equipment.lightMeter} />
        <DCell label="Light Meter S/N" value={r.equipment.lightMeterSN} />
        <DCell label="Lighting Cal. Check" value={r.equipment.lightingCalCheck} />
        <DCell label="MPI Particle Brand" value={r.equipment.particleBrand} />
        <DCell label="Particle Product" value={r.equipment.particleProduct} />
        <DCell label="Light Meter Cal. Due" value={r.equipment.lightMeterCalDue} />
        <DCell label="Particle Batch No." value={r.equipment.particleBatchNo} />
        <DCell label="Contrast Paint" value={r.equipment.contrastPaint} />
        <DCell label="Contrast Paint Batch No." value={r.equipment.contrastPaintBatchNo} />
        <DCell label="Lifting Power Verified?" value={r.equipment.liftingPowerVerified} />
        <DCell label="Bar Weight" value={r.equipment.barWeight} />
      </div>

      <DBand title="Examined Items Details" />
      <div className="grid grid-cols-4">
        <DCell label="Material" value={r.examined.material} />
        <DCell label="Surface Condition" value={r.examined.surfaceCondition} />
        <DCell label="Surface Temp." value={r.examined.surfaceTemp} />
        <DCell label="Location" value={r.examined.location} />
      </div>

      <DBand title="Examination Details & Results" />
      <table className="w-full border-collapse text-[9px]">
        <thead>
          <tr>
            <th className={th}>Line / Equip. ID</th>
            <th className={th}>Weld ID</th>
            <th className={th}>Welder ID</th>
            <th className={th}>ISO DWG</th>
            <th className={th}>Line Class</th>
            <th className={th}>Weld Type</th>
            <th className={th}>Dia.</th>
            <th className={th}>Thk.</th>
            <th className={th}>Comments</th>
            <th className={th}>Accept / Reject</th>
          </tr>
        </thead>
        <tbody>
          {r.items.map((it, i) => (
            <tr key={i}>
              <td className={td}>{it.lineEquipId}</td>
              <td className={td}>{it.weldId}</td>
              <td className={td}>{it.welderId}</td>
              <td className={td}>{it.isoDwg}</td>
              <td className={td}>{it.lineClass}</td>
              <td className={td}>{it.weldType}</td>
              <td className={td}>{it.dia}</td>
              <td className={td}>{it.thk}</td>
              <td className={td}>{it.comments}</td>
              <td className={td + " font-semibold"}>{it.result}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border border-slate-400 border-t-0 px-2 py-1 text-[10px]">{r.notes.summary}</div>
      <div className="grid grid-cols-4">
        <DCell label="CWP" value={r.notes.cwp} />
        <DCell label="Heat Number" value={r.notes.heatNumber} />
        <DCell label="Area" value={r.notes.area} />
        <DCell label="Lift Block Serial No." value={r.notes.liftBlockSerial} />
      </div>

      <DBand title="Audit Information" />
      <div className="grid grid-cols-2">
        <DCell label="Technician (print)" value={r.audit.technician} />
        <DCell label="QA Representative" value={r.audit.qaRep} />
        <DCell label="Certification Type, Level & Reg. No." value={r.audit.certification} span={2} />
        <div className="border border-slate-400 px-2 py-3">
          <div className="text-[8px] uppercase tracking-wide text-slate-500">Inspector Signature</div>
          <div className="h-8" />
        </div>
        <div className="border border-slate-400 px-2 py-3">
          <div className="text-[8px] uppercase tracking-wide text-slate-500">Client Signature</div>
          <div className="h-8" />
        </div>
        <DCell label="Date Printed" value={r.audit.datePrinted} span={2} />
      </div>

      {(r.photos || []).length > 0 && (
        <>
          <DBand title="Photos" />
          <div className="grid grid-cols-2 gap-2 mt-1">
            {r.photos.map((ph, i) => {
              const src = ph.thumb || photoUrls[ph.path];
              return (
                <div key={i} className="border border-slate-400 p-1">
                  {src && <img src={src} alt="" className="w-full object-contain" style={{ maxHeight: "7cm" }} />}
                  {ph.caption && <div className="text-[9px] mt-1 text-slate-700">{ph.caption}</div>}
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="text-[8px] text-slate-500 mt-2">
        Examination results are an interpretation only and not always an exact representation of the component or
        associated anomalies under inspection.
      </div>
    </div>
  );
}
