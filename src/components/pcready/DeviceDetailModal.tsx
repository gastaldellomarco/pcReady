import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { supabase } from "@/integrations/supabase/client";
import { useDeviceDetail } from "@/lib/use-detail";
import { fmtDate, fmtDateTime } from "@/lib/pcready";
import { toast } from "sonner";

interface DeviceRow {
  id: string;
  serial: string | null;
  model: string;
  os: string | null;
  status: string;
  client?: { name: string } | null;
  assigned_to: string | null;
  updated_at: string;
}

interface AssignmentRow {
  id: string;
  ticket_id: string | null;
  assigned_at: string;
  unassigned_at: string | null;
  notes: string | null;
  ticket?: { ticket_code: string } | null;
}

export function DeviceDetailModal() {
  const { id, close } = useDeviceDetail();
  const [d, setD] = useState<DeviceRow | null>(null);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);

  useEffect(() => {
    if (!id) {
      setD(null);
      setAssignments([]);
      return;
    }

    supabase
      .from("devices")
      .select("*, client:clients(name)")
      .eq("id", id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) return toast.error(error.message);
        setD(data as DeviceRow | null);
      });

    supabase
      .from("ticket_device_assignments")
      .select(
        "id, ticket_id, assigned_at, unassigned_at, notes, ticket:tickets(ticket_code)",
      )
      .eq("device_id", id)
      .order("assigned_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) return toast.error(error.message);
        setAssignments((data ?? []) as AssignmentRow[]);
      });
  }, [id]);

  if (!id || !d) return null;

  return (
    <Modal open={true} onClose={close} size="lg" title={`${d.model} - ${d.serial || "-"}`}>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <div className="pc-label">Stato</div>
          <div className="text-[13px]">{d.status}</div>
        </div>
        <div>
          <div className="pc-label">Aggiornato</div>
          <div className="text-[13px]">{fmtDate(d.updated_at)}</div>
        </div>
        <div>
          <div className="pc-label">Cliente</div>
          <div className="text-[13px]">{d.client?.name || "-"}</div>
        </div>
        <div>
          <div className="pc-label">Utente asset</div>
          <div className="text-[13px]">{d.assigned_to || "-"}</div>
        </div>
        <div>
          <div className="pc-label">OS</div>
          <div className="text-[13px]">{d.os || "-"}</div>
        </div>
        <div>
          <div className="pc-label">ID</div>
          <div className="text-[13px] font-mono">{d.id}</div>
        </div>
      </div>

      {assignments.length > 0 && (
        <div className="mb-4 p-3 rounded-lg" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
          <div className="pc-label">Storico assegnazioni</div>
          <div className="flex flex-col gap-2 mt-2">
            {assignments.map((a) => (
              <div key={a.id} className="text-[13px] flex items-center gap-2">
                <div className="font-semibold">{a.ticket?.ticket_code || "-"}</div>
                <div className="font-mono text-text3">{fmtDateTime(a.assigned_at)}</div>
                <div className="ml-auto text-text3">{a.unassigned_at ? `chiuso ${fmtDateTime(a.unassigned_at)}` : "attivo"}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button className="pc-btn pc-btn-ghost" onClick={close}>
          Chiudi
        </button>
      </div>
    </Modal>
  );
}

export default DeviceDetailModal;
