import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DeviceSchema, type DeviceInput } from "@/lib/schemas/devices";
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
  const form = useForm<DeviceInput>({
    resolver: zodResolver(DeviceSchema),
    mode: "onChange",
    defaultValues: {
      model: "",
      serial: "",
      client_id: "",
      end_user: null,
      os: OS_OPTIONS[0],
      notes: null,
    },
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
        if (arr[0]?.id) form.setValue("client_id", form.getValues().client_id || arr[0].id);
      });
  }, [addDeviceOpen]);
  const submit = form.handleSubmit(async (values) => {
    if (!canEdit) return toast.error("Permessi insufficienti");
    setBusy(true);
    try {
      const client = clients.find((c) => c.id === values.client_id);
      if (!client) return toast.error("Seleziona un cliente");

      const deviceInsert: TablesInsert<"devices"> = {
        client_id: client.id,
        model: values.model,
        serial: values.serial,
        assigned_to: (values.end_user as string) || null,
        os: values.os,
        notes: (values.notes as string) || null,
        created_by: user!.id,
      };
      const { data, error } = await supabase.from("devices").insert(deviceInsert).select("id, serial").single();
      if (error) throw error;
      await supabase.from("activity_log").insert({
        type: "user",
        message: `Dispositivo ${data.serial || values.model} aggiunto all'inventario`,
        actor_id: user!.id,
      });
      toast.success("Dispositivo aggiunto all'inventario");
      form.reset({ model: "", serial: "", client_id: client.id, end_user: null, os: OS_OPTIONS[0], notes: null });
      closeAddDevice();
      triggerRefresh();
    } catch (e: unknown) {
      toast.error(errorMessage(e, "Errore creazione dispositivo"));
    } finally {
      setBusy(false);
    }
  });

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
            <input className="pc-input" {...form.register("model")} placeholder="Dell Latitude 5540" />
            {form.formState.errors.model && <p className="text-sm text-destructive mt-1">{form.formState.errors.model.message}</p>}
          </Field>
          <Field label="Seriale *">
            <input className="pc-input font-mono" {...form.register("serial")} placeholder="ABCD1234" />
            {form.formState.errors.serial && <p className="text-sm text-destructive mt-1">{form.formState.errors.serial.message}</p>}
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
          <Field label="Cliente *">
            <select className="pc-input" {...form.register("client_id")}>
              {!clients.length && <option value="">Nessun cliente disponibile</option>}
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name || c.name}
                </option>
              ))}
            </select>
            {form.formState.errors.client_id && <p className="text-sm text-destructive mt-1">{form.formState.errors.client_id.message}</p>}
          </Field>
          <Field label="Utente finale">
            <input className="pc-input" {...form.register("end_user")} />
          </Field>
        </div>
        <Field label="OS">
          <select className="pc-input" {...form.register("os")}>
            {OS_OPTIONS.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
          {form.formState.errors.os && <p className="text-sm text-destructive mt-1">{form.formState.errors.os.message}</p>}
        </Field>
        <Field label="Note">
          <textarea className="pc-input min-h-[90px]" {...form.register("notes")} />
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
