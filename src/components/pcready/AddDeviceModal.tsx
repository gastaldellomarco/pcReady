import { useState, type ReactNode } from "react";
import { Modal } from "./Modal";
import { CLIENTS, OS_OPTIONS } from "@/lib/pcready";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useTickets } from "@/lib/use-tickets";
import { toast } from "sonner";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function AddDeviceModal() {
  const { addDeviceOpen, closeAddDevice, triggerRefresh } = useTickets();
  const { user, canEdit } = useAuth();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    model: "",
    serial: "",
    client: CLIENTS[0],
    end_user: "",
    os: OS_OPTIONS[0],
    notes: "",
  });

  async function submit() {
    if (!canEdit) return toast.error("Permessi insufficienti");
    if (!f.model || !f.serial || !f.client) return toast.error("Compila i campi obbligatori");
    setBusy(true);
    try {
      const code = `DEV-${String(Math.floor(Date.now() / 1000) % 100000).padStart(5, "0")}`;
      const { data, error } = await supabase
        .from("tickets")
        .insert({
          ticket_code: code,
          client: f.client,
          model: f.model,
          serial: f.serial,
          requester: "Inventario",
          end_user: f.end_user || null,
          priority: "low",
          status: "ready",
          assignee_id: null,
          os: f.os,
          software: null,
          notes: f.notes || null,
          checklist: {},
          created_by: user!.id,
          template_id: null,
          checklist_structure: null,
        })
        .select("id, ticket_code")
        .single();
      if (error) throw error;
      await supabase.from("activity_log").insert({
        type: "user",
        message: `${data.ticket_code} aggiunto all'inventario`,
        ticket_id: data.id,
        actor_id: user!.id,
      });
      toast.success(`${data.ticket_code} aggiunto all'inventario`);
      setF({
        model: "",
        serial: "",
        client: CLIENTS[0],
        end_user: "",
        os: OS_OPTIONS[0],
        notes: "",
      });
      closeAddDevice();
      triggerRefresh();
    } catch (e: unknown) {
      toast.error(errorMessage(e, "Errore creazione dispositivo"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={addDeviceOpen}
      onClose={closeAddDevice}
      title="Aggiungi dispositivo"
      size="lg"
      footer={
        <>
          <button className="pc-btn pc-btn-ghost" onClick={closeAddDevice}>
            Annulla
          </button>
          <button className="pc-btn pc-btn-primary" disabled={busy} onClick={submit}>
            {busy ? "Creazione..." : "Aggiungi dispositivo"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-[14px]">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
          <Field label="Modello *">
            <input
              className="pc-input"
              value={f.model}
              onChange={(e) => setF({ ...f, model: e.target.value })}
              placeholder="Dell Latitude 5540"
            />
          </Field>
          <Field label="Seriale *">
            <input
              className="pc-input font-mono"
              value={f.serial}
              onChange={(e) => setF({ ...f, serial: e.target.value })}
              placeholder="ABCD1234"
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
          <Field label="Cliente *">
            <select
              className="pc-input"
              value={f.client}
              onChange={(e) => setF({ ...f, client: e.target.value })}
            >
              {CLIENTS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Utente finale">
            <input
              className="pc-input"
              value={f.end_user}
              onChange={(e) => setF({ ...f, end_user: e.target.value })}
            />
          </Field>
        </div>
        <Field label="OS">
          <select
            className="pc-input"
            value={f.os}
            onChange={(e) => setF({ ...f, os: e.target.value })}
          >
            {OS_OPTIONS.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </Field>
        <Field label="Note">
          <textarea
            className="pc-input min-h-[90px]"
            value={f.notes}
            onChange={(e) => setF({ ...f, notes: e.target.value })}
          />
        </Field>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="pc-label">{label}</label>
      {children}
    </div>
  );
}
