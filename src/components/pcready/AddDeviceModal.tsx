import { useEffect, useState, type ReactNode } from "react";
import { Modal } from "./Modal";
import { OS_OPTIONS } from "@/lib/pcready";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth-context";
import { useTickets } from "@/lib/use-tickets";
import { toast } from "sonner";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

interface ClientOption {
  id: string;
  name: string;
  company_name: string | null;
}

export function AddDeviceModal() {
  const { addDeviceOpen, closeAddDevice, triggerRefresh } = useTickets();
  const { user, canEdit } = useAuth();
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    model: "",
    serial: "",
    client_id: "",
    end_user: "",
    os: OS_OPTIONS[0],
    notes: "",
  });

  useEffect(() => {
    if (!addDeviceOpen) return;
    supabase
      .from("clients")
      .select("id, name, company_name")
      .order("name")
      .then(({ data }) => {
        const arr = (data ?? []) as ClientOption[];
        setClients(arr);
        setF((cur) => ({ ...cur, client_id: cur.client_id || arr[0]?.id || "" }));
      });
  }, [addDeviceOpen]);

  async function submit() {
    if (!canEdit) return toast.error("Permessi insufficienti");
    if (!f.model || !f.serial || !f.client_id) return toast.error("Compila i campi obbligatori");
    setBusy(true);
    try {
      const client = clients.find((c) => c.id === f.client_id);
      if (!client) return toast.error("Seleziona un cliente");

      const deviceInsert: TablesInsert<"devices"> = {
        client_id: client.id,
        model: f.model,
        serial: f.serial,
        assigned_to: f.end_user || null,
        os: f.os,
        notes: f.notes || null,
        created_by: user!.id,
      };
      const { data, error } = await supabase
        .from("devices")
        .insert(deviceInsert)
        .select("id, serial")
        .single();
      if (error) throw error;
      await supabase.from("activity_log").insert({
        type: "user",
        message: `Dispositivo ${data.serial || f.model} aggiunto all'inventario`,
        actor_id: user!.id,
      });
      toast.success("Dispositivo aggiunto all'inventario");
      setF({
        model: "",
        serial: "",
        client_id: client.id,
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
              value={f.client_id}
              onChange={(e) => setF({ ...f, client_id: e.target.value })}
            >
              {!clients.length && <option value="">Nessun cliente disponibile</option>}
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name || c.name}
                </option>
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
