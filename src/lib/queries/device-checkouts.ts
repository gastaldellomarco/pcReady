import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ── Types ──

export interface DeviceCheckout {
  id: string;
  device_id: string;
  ticket_id: string;
  technician_id: string;
  checkout_at: string;
  checkin_at: string | null;
  checkout_signature_id: string | null;
  checkin_signature_id: string | null;
  condition_notes: string | null;
  created_at: string;
  technician?: { full_name: string | null; initials: string | null } | null;
  device?: { model: string; serial: string | null } | null;
  ticket?: { ticket_code: string } | null;
}

// ── Queries ──

export async function fetchDeviceCheckouts(deviceId: string) {
  const { data, error } = await (supabase as any)
    .from("device_checkouts")
    .select(
      "*, technician:profiles!device_checkouts_technician_id_fkey(full_name, initials), device:devices(model, serial), ticket:tickets(ticket_code)",
    )
    .eq("device_id", deviceId)
    .order("checkout_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as DeviceCheckout[];
}

export async function fetchTicketCheckouts(ticketId: string) {
  const { data, error } = await (supabase as any)
    .from("device_checkouts")
    .select(
      "*, technician:profiles!device_checkouts_technician_id_fkey(full_name, initials), device:devices(model, serial), ticket:tickets(ticket_code)",
    )
    .eq("ticket_id", ticketId)
    .order("checkout_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as DeviceCheckout[];
}

export async function fetchActiveCheckout(deviceId: string) {
  const { data, error } = await (supabase as any)
    .from("device_checkouts")
    .select(
      "*, technician:profiles!device_checkouts_technician_id_fkey(full_name, initials), device:devices(model, serial), ticket:tickets(ticket_code)",
    )
    .eq("device_id", deviceId)
    .is("checkin_at", null)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as DeviceCheckout | null;
}

export function useDeviceCheckouts(deviceId: string | null | undefined) {
  return useQuery({
    queryKey: ["device-checkouts", deviceId],
    queryFn: () => fetchDeviceCheckouts(deviceId!),
    enabled: !!deviceId,
  });
}

export function useTicketCheckouts(ticketId: string | null | undefined) {
  return useQuery({
    queryKey: ["ticket-checkouts", ticketId],
    queryFn: () => fetchTicketCheckouts(ticketId!),
    enabled: !!ticketId,
  });
}

export function useActiveCheckout(deviceId: string | null | undefined) {
  return useQuery({
    queryKey: ["device-active-checkout", deviceId],
    queryFn: () => fetchActiveCheckout(deviceId!),
    enabled: !!deviceId,
  });
}

// ── Signature upload helper ──

/**
 * Upload a signature image (base64 data URL) to Supabase Storage.
 * Returns the storage path if successful.
 * NOTE: Does NOT insert into document_signatures — that table requires
 * client_id/contact_id which aren't available in the technician checkout flow.
 * The signature file is stored in "ticket-documents" bucket for audit purposes.
 */
async function uploadSignatureFile(params: {
  dataUrl: string;
  documentId: string;
  deviceId: string;
}): Promise<string> {
  const { dataUrl, documentId, deviceId } = params;

  const match = /^data:image\/png;base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("Formato firma non valido");

  const rawBase64 = match[1];
  const byteString = atob(rawBase64);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);

  const sanitizedId = documentId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const storagePath = `signatures/${deviceId}/${Date.now()}-${sanitizedId}.png`;

  const { error: uploadError } = await supabase.storage
    .from("ticket-documents")
    .upload(storagePath, new Blob([ab], { type: "image/png" }), {
      contentType: "image/png",
      upsert: false,
      cacheControl: "private, max-age=31536000",
    });
  if (uploadError) throw uploadError;

  return storagePath;
}

// ── Mutations ──

export interface CheckoutParams {
  deviceId: string;
  ticketId: string;
  technicianId: string;
  signatureDataUrl?: string;
  conditionNotes?: string;
}

export async function checkoutDevice(params: CheckoutParams) {
  const { deviceId, ticketId, technicianId, signatureDataUrl, conditionNotes } = params;

  // Upload signature if provided (file only, no document_signatures record)
  let sigPath: string | null = null;
  if (signatureDataUrl) {
    sigPath = await uploadSignatureFile({
      dataUrl: signatureDataUrl,
      documentId: `checkout-${ticketId}-${deviceId}`,
      deviceId,
    });
  }

  try {
    const { data, error } = await (supabase as any)
      .from("device_checkouts")
      .insert({
        device_id: deviceId,
        ticket_id: ticketId,
        technician_id: technicianId,
        condition_notes: conditionNotes || null,
      })
      .select("id")
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    // Cleanup orphaned signature file if DB insert failed
    if (sigPath) {
      await supabase.storage.from("ticket-documents").remove([sigPath]);
    }
    throw err;
  }
}

export interface CheckinParams {
  checkoutId: string;
  deviceId: string;
  ticketId: string;
  technicianId: string;
  signatureDataUrl?: string;
  conditionNotes?: string;
}

export async function checkinDevice(params: CheckinParams) {
  const { checkoutId, deviceId, ticketId, technicianId, signatureDataUrl, conditionNotes } = params;

  let sigPath: string | null = null;
  if (signatureDataUrl) {
    sigPath = await uploadSignatureFile({
      dataUrl: signatureDataUrl,
      documentId: `checkin-${ticketId}-${deviceId}`,
      deviceId,
    });
  }

  try {
    const updates: Record<string, any> = {
      checkin_at: new Date().toISOString(),
    };
    if (conditionNotes !== undefined) {
      updates.condition_notes = conditionNotes || null;
    }

    const { error } = await (supabase as any)
      .from("device_checkouts")
      .update(updates)
      .eq("id", checkoutId)
      .eq("technician_id", technicianId);

    if (error) throw error;
    return true;
  } catch (err) {
    // Cleanup orphaned signature file if DB update failed
    if (sigPath) {
      await supabase.storage.from("ticket-documents").remove([sigPath]);
    }
    throw err;
  }
}

// ── Hooks ──

export function useCheckoutDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: checkoutDevice,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["device-checkouts", vars.deviceId] });
      qc.invalidateQueries({ queryKey: ["ticket-checkouts", vars.ticketId] });
      qc.invalidateQueries({ queryKey: ["device-active-checkout", vars.deviceId] });
    },
  });
}

export function useCheckinDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: checkinDevice,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["device-checkouts", vars.deviceId] });
      qc.invalidateQueries({ queryKey: ["ticket-checkouts", vars.ticketId] });
      qc.invalidateQueries({ queryKey: ["device-active-checkout", vars.deviceId] });
    },
  });
}
