import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useServerFn } from "@tanstack/react-start";
import { DeviceSchema, type DeviceInput } from "@/lib/schemas/devices";
import { Modal } from "./Modal";
import { OS_OPTIONS } from "@/lib/pcready";
import { getPublicAppSettings } from "@/lib/app-settings";
import { loadClientOptions } from "@/lib/queries/tickets";
import activityQueries from "@/lib/queries/activity";
import inventoryQueries from "@/lib/queries/inventory";
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
  const { addDeviceOpen, addDeviceInitialSerial, closeAddDevice } = useTickets();
  const { user, canEdit, session } = useAuth();
  const loadSettings = useServerFn(getPublicAppSettings);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [osOptions, setOsOptions] = useState<string[]>(OS_OPTIONS);
  const [brandOptions, setBrandOptions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const form = useForm<DeviceInput>({
    resolver: zodResolver(DeviceSchema),
    mode: "onChange",
    defaultValues: {
      brand: null,
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
    if (addDeviceInitialSerial)
      form.setValue("serial", addDeviceInitialSerial, { shouldValidate: true });
    loadClientOptions("").then((arr: any[]) => {
      setClients(arr || []);
      if (arr?.[0]?.id) form.setValue("client_id", form.getValues().client_id || arr[0].id);
    });
  }, [addDeviceOpen, addDeviceInitialSerial, form]);

  useEffect(() => {
    if (!addDeviceOpen || !session?.access_token) return;
    loadSettings({ data: { accessToken: session.access_token } })
      .then((settings) => {
        const nextOptions = settings.os_options.length ? settings.os_options : OS_OPTIONS;
        setBrandOptions(settings.device_brands);
        setOsOptions(nextOptions);
        if (!nextOptions.includes(form.getValues().os)) {
          form.setValue("os", nextOptions[0], { shouldValidate: true });
        }
      })
      .catch(() => {
        setBrandOptions([]);
        setOsOptions(OS_OPTIONS);
      });
  }, [addDeviceOpen, form, loadSettings, session?.access_token]);

  const createDeviceMut = (inventoryQueries as any).useCreateDevice();

  const submit = form.handleSubmit(async (values) => {
    if (!canEdit) return toast.error("Permessi insufficienti");
    setBusy(true);
    try {
      const client = clients.find((c) => c.id === values.client_id);
      if (!client) return toast.error("Seleziona un cliente");

      const deviceInsert: TablesInsert<"devices"> = {
        brand: (values.brand as string) || null,
        client_id: client.id,
        model: values.model,
        serial: values.serial,
        assigned_to: (values.end_user as string) || null,
        os: values.os,
        notes: (values.notes as string) || null,
        created_by: user!.id,
      };
      const data = await createDeviceMut.mutateAsync(deviceInsert as any);
      const insertActivity = activityQueries.insertActivity as any;
      await insertActivity({
        type: "user",
        message: `Dispositivo ${data.serial || values.model} aggiunto all'inventario`,
        actor_id: user!.id,
      });
      toast.success("Dispositivo aggiunto all'inventario");
      form.reset({
        brand: null,
        model: "",
        serial: "",
        client_id: client.id,
        end_user: null,
        os: osOptions[0] ?? OS_OPTIONS[0],
        notes: null,
      });
      closeAddDevice();
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
          <Field label="Brand">
            <select className="pc-input" {...form.register("brand")}>
              <option value="">— Nessun brand —</option>
              {brandOptions.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Modello *">
            <input
              className="pc-input"
              {...form.register("model")}
              placeholder="Dell Latitude 5540"
            />
            {form.formState.errors.model && (
              <p className="text-sm text-destructive mt-1">{form.formState.errors.model.message}</p>
            )}
          </Field>
          <Field label="Seriale *">
            <input
              className="pc-input font-mono"
              {...form.register("serial")}
              placeholder="ABCD1234"
            />
            {form.formState.errors.serial && (
              <p className="text-sm text-destructive mt-1">
                {form.formState.errors.serial.message}
              </p>
            )}
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
          <Field label="Cliente *">
            <select className="pc-input" {...form.register("client_id")}>
              {!(clients ?? []).length && <option value="">Nessun cliente disponibile</option>}
              {(Array.isArray(clients) ? clients : []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name || c.name}
                </option>
              ))}
            </select>
            {form.formState.errors.client_id && (
              <p className="text-sm text-destructive mt-1">
                {form.formState.errors.client_id.message}
              </p>
            )}
          </Field>
          <Field label="Utente finale">
            <input className="pc-input" {...form.register("end_user")} />
          </Field>
        </div>
        <Field label="OS">
          <select className="pc-input" {...form.register("os")}>
            {osOptions.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
          {form.formState.errors.os && (
            <p className="text-sm text-destructive mt-1">{form.formState.errors.os.message}</p>
          )}
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
