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
