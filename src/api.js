import { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabaseClient.js";
import { STATUS } from "./constants.js";

/**
 * Live list of requests the current user is allowed to see.
 * RLS on the server decides which rows come back — we just fetch all and
 * subscribe to changes.
 */
export function useRequests(profile) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const { data, error } = await supabase
      .from("inspection_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setRequests(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!profile) return;
    fetchAll();
    const channel = supabase
      .channel("requests-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "inspection_requests" }, fetchAll)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [profile, fetchAll]);

  return { requests, loading, refetch: fetchAll };
}

export async function createRequest(profile, form) {
  const { error } = await supabase.from("inspection_requests").insert({
    client_org_id: profile.org_id,
    client_org_name: profile.organization?.name || "Client",
    created_by: profile.id,
    project: form.project,
    site: form.site,
    method: form.method,
    requested_date: form.requestedDate || null,
    notes: form.notes || null,
    status: STATUS.OPEN,
  });
  if (error) throw error;
}

/** Client creates a work order (the inspection request). Goes out as 'open'. */
export async function createWorkOrder(profile, f) {
  const methods = f.methods || [];
  const { error } = await supabase.from("inspection_requests").insert({
    client_org_id: profile.org_id,
    client_org_name: profile.organization?.name || f.clientName || "Client",
    created_by: profile.id,
    // client info
    client_name: f.clientName || null,
    client_address: f.clientAddress || null,
    client_contact: f.clientContact || null,
    client_phone: f.clientPhone || null,
    client_email: f.clientEmail || null,
    // job info
    date_of_request: f.dateOfRequest || null,
    required_datetime: f.requiredDateTime || null,
    items_for_inspection: f.items || null,
    directions: f.directions || null,
    special_instructions: f.special || null,
    methods,
    // reused fields so existing display + report code keeps working
    project: f.items || "Inspection",
    site: f.clientAddress || "",
    method: methods[0] || null,
    requested_date: f.dateOfRequest || null,
    notes: f.special || null,
    status: STATUS.OPEN,
  });
  if (error) throw error;
}

/** Dispatcher: save a quote amount on a work order. */
export async function setQuote(id, amount) {
  const { error } = await supabase
    .from("inspection_requests")
    .update({ quote_amount: amount === "" || amount == null ? null : Number(amount) })
    .eq("id", id);
  if (error) throw error;
}

/** Dispatcher: generate the next work order number for a company code. */
export async function generateWorkOrderNo(companyCode) {
  const { data, error } = await supabase.rpc("next_work_order_no", { p_company_code: companyCode });
  if (error) throw error;
  return data;
}

/** Dispatcher: persist a generated work order number on a work order. */
export async function saveWorkOrderNo(id, no, companyCode) {
  const { error } = await supabase
    .from("inspection_requests")
    .update({ work_order_no: no, company_code: (companyCode || "").toUpperCase() })
    .eq("id", id);
  if (error) throw error;
}

export async function claimRequest(profile, id) {
  const { error } = await supabase
    .from("inspection_requests")
    .update({
      status: STATUS.CLAIMED,
      inspection_org_id: profile.org_id,
      inspection_org_name: profile.organization?.name || "Inspection Co.",
    })
    .eq("id", id);
  if (error) throw error;
}

export async function assignInspector(id, inspector, scheduledDate, eta) {
  const { error } = await supabase
    .from("inspection_requests")
    .update({
      status: STATUS.ASSIGNED,
      inspector_id: inspector.id,
      inspector_name: inspector.full_name,
      scheduled_date: scheduledDate || null,
      eta: eta || null,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function updateEta(id, eta) {
  const { error } = await supabase
    .from("inspection_requests")
    .update({ eta: eta || null })
    .eq("id", id);
  if (error) throw error;
}

export async function startInspection(id) {
  const { error } = await supabase
    .from("inspection_requests")
    .update({ status: STATUS.IN_PROGRESS })
    .eq("id", id);
  if (error) throw error;
}

export async function completeInspection(id, result, notes) {
  const { error } = await supabase
    .from("inspection_requests")
    .update({ status: STATUS.COMPLETED, result, inspector_notes: notes })
    .eq("id", id);
  if (error) throw error;
}

export async function saveReport(id, report) {
  const { error } = await supabase
    .from("inspection_requests")
    .update({ report })
    .eq("id", id);
  if (error) throw error;
}

/* ---------- Report photos (Supabase Storage) ---------- */
const PHOTO_BUCKET = "report-photos";

export async function uploadReportPhoto(requestId, file) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${requestId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw error;
  return path;
}

/** Returns a { path: signedUrl } map for displaying private photos. */
export async function getSignedUrls(paths) {
  if (!paths || paths.length === 0) return {};
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 3600);
  if (error) throw error;
  const map = {};
  (data || []).forEach((d) => {
    if (d.signedUrl) map[d.path] = d.signedUrl;
  });
  return map;
}

export async function removeReportPhoto(path) {
  const { error } = await supabase.storage.from(PHOTO_BUCKET).remove([path]);
  if (error) throw error;
}

/** Downloads photos and returns a { path: base64DataUrl } map for printing. */
export async function getPhotoDataUrls(paths) {
  const out = {};
  await Promise.all(
    (paths || []).map(async (path) => {
      try {
        const { data, error } = await supabase.storage.from(PHOTO_BUCKET).download(path);
        if (error || !data) return;
        out[path] = await new Promise((resolve) => {
          const fr = new FileReader();
          fr.onload = () => resolve(fr.result);
          fr.onerror = () => resolve(null);
          fr.readAsDataURL(data);
        });
      } catch {
        /* skip */
      }
    })
  );
  return out;
}

/** Inspectors in the dispatcher's own company (RLS allows same-org reads). */
export async function listMyInspectors(profile) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("org_id", profile.org_id)
    .eq("role", "inspector");
  if (error) throw error;
  return data || [];
}
