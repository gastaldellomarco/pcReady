import { zodResolver } from "@hookform/resolvers/zod";
import { useServerFn } from "@tanstack/react-start";
import { Barcode, ScanLine } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useForm, Controller, type UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { BarcodeScanner } from "@/components/inventory/BarcodeScanner";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { Field } from "@/components/ui/form-field";
import { useTickets } from "@/hooks/use-tickets";
import { getClientAppSettings, getPublicAppSettings } from "@/lib/app-settings";
import { useAuth } from "@/lib/auth-context";
import {
  DEFAULT_DEVICE_CATEGORY,
  DEFAULT_DEVICE_TYPE,
  DEVICE_CATEGORIES,
  DEVICE_CATEGORY_LABELS,
  getDeviceTypes,
  type DeviceCategory,
} from "@/lib/device-taxonomy";
import { errorMessage } from "@/lib/errors";
import { OS_OPTIONS } from "@/lib/pcready";
import { insertActivity } from "@/lib/queries/activity";
import inventoryQueries from "@/lib/queries/inventory";
import { loadClientOptions } from "@/lib/queries/tickets";
import { DeviceSchema, type DeviceFormInput, type DeviceInput } from "@/lib/schemas/devices";
import { Modal } from "./Modal";
import type { TablesInsert } from "@/integrations/supabase/types";


function normalizeOptions(values: unknown): string[] {
  return Array.isArray(values) ? values.map((value) => String(value).trim()).filter(Boolean) : [];
}

interface ClientOption {
  id: string;
  name: string;
  company_name: string | null;
}

type BarcodeTarget = "asset_tag" | "serial";

/**
 *
 */
export function AddDeviceModal() {
  const { addDeviceOpen, addDeviceInitialSerial, addDeviceClient, closeAddDevice } = useTickets();
  const { user, canEdit, session } = useAuth();
  const { t } = useTranslation("tickets");
  const loadSettings = useServerFn(getPublicAppSettings);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [osOptions, setOsOptions] = useState<string[]>(OS_OPTIONS);
  const [brandOptions, setBrandOptions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [barcodeTarget, setBarcodeTarget] = useState<BarcodeTarget | null>(null);
  const form = useForm<DeviceFormInput, unknown, DeviceInput>({
    resolver: zodResolver(DeviceSchema),
    mode: "onChange",
    defaultValues: {
      category: DEFAULT_DEVICE_CATEGORY,
      device_type: DEFAULT_DEVICE_TYPE,
      asset_tag: "",
      brand: null,
      model: "",
      serial: "",
      client_id: "",
      end_user: null,
      os: OS_OPTIONS[0],
      cpu_name: "",
      ram_gb: "",
      storage_capacity_gb: "",
      storage_type: "",
      ip_address: "",
      mac_address: "",
      location: "",
      firmware_version: "",
      port_count: "",
      poe_supported: false,
      toner_model: "",
      page_count: "",
      print_technology: "",
      license_expiry: "",
      vlan_config: "",
      rack_position: "",
      server_role: "",
      purchase_cost: "",
      notes: null,
    },
  });
  const selectedCategory = form.watch("category") as DeviceCategory;
  const selectedTypes = getDeviceTypes(selectedCategory);

  useEffect(() => {
    const currentType = form.getValues().device_type ?? DEFAULT_DEVICE_TYPE;
    if (!selectedTypes.includes(currentType)) {
      form.setValue("device_type", selectedTypes[0] ?? DEFAULT_DEVICE_TYPE, {
        shouldValidate: true,
      });
    }
  }, [form, selectedTypes]);

  useEffect(() => {
    if (!addDeviceOpen) return;
    if (addDeviceInitialSerial) {
      if (/^[A-Z]{2,5}-\d{4,}$/i.test(addDeviceInitialSerial)) {
        form.setValue("asset_tag", addDeviceInitialSerial.toUpperCase(), { shouldValidate: true });
      } else {
        form.setValue("serial", addDeviceInitialSerial, { shouldValidate: true });
      }
    }

    if (addDeviceClient?.id) {
      setClients([
        {
          id: addDeviceClient.id,
          name: addDeviceClient.name,
          company_name: addDeviceClient.name,
        },
      ]);
      form.setValue("client_id", addDeviceClient.id, { shouldValidate: true });
      return;
    }

    loadClientOptions("").then((arr: any[]) => {
      setClients(arr || []);
      if (arr?.[0]?.id) form.setValue("client_id", form.getValues().client_id || arr[0].id);
    });
  }, [addDeviceOpen, addDeviceInitialSerial, addDeviceClient, form]);

  const applySettingsOptions = useCallback(
    (settings: { os_options?: unknown; device_brands?: unknown }) => {
      const nextOsOptions = normalizeOptions(settings.os_options);
      const nextBrandOptions = normalizeOptions(settings.device_brands);
      const resolvedOsOptions = nextOsOptions.length ? nextOsOptions : OS_OPTIONS;

      setOsOptions(resolvedOsOptions);
      setBrandOptions(nextBrandOptions);

      const currentOs = form.getValues().os;
      if (currentOs && !resolvedOsOptions.includes(currentOs)) {
        form.setValue("os", resolvedOsOptions[0], { shouldValidate: true });
      }
    },
    [form],
  );

  useEffect(() => {
    if (!addDeviceOpen || !session?.access_token) return;
    applySettingsOptions(getClientAppSettings());
    loadSettings({ data: { accessToken: session.access_token } })
      .then((settings) => applySettingsOptions(settings))
      .catch(() => applySettingsOptions(getClientAppSettings()));
  }, [addDeviceOpen, applySettingsOptions, loadSettings, session?.access_token]);

  const createDeviceMut = (inventoryQueries as any).useCreateDevice();

  function focusBarcodeTarget(target: BarcodeTarget) {
    form.setFocus(target);
    toast.info(
      barcodeTarget === "asset_tag"
        ? t("addDevice.toasts.assetTagReady", "Campo asset tag pronto per scanner barcode USB/Bluetooth")
        : t("addDevice.toasts.serialReady", "Campo seriale pronto per scanner barcode USB/Bluetooth"),
    );
  }

  function applyBarcodeValue(value: string) {
    if (!barcodeTarget) return;
    const next = value.trim();
    if (!next) return;
    form.setValue(barcodeTarget, barcodeTarget === "asset_tag" ? next.toUpperCase() : next, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    form.setFocus(barcodeTarget);
    setBarcodeTarget(null);
    toast.success(
      barcodeTarget === "asset_tag" ? t("addDevice.toasts.assetTagBarcode", "Asset tag compilato da barcode") : t("addDevice.toasts.serialBarcode", "Seriale compilato da barcode"),
    );
  }

  const submit = form.handleSubmit(async (values) => {
    if (!canEdit) return toast.error(t("addDevice.toasts.insufficientPermissions", "Permessi insufficienti"));
    setBusy(true);
    try {
      if (!(clients && clients.length) && !addDeviceClient) {
        toast.error(t("addDevice.toasts.noClientAvailable", "Nessun cliente disponibile — crea o seleziona un cliente prima di aggiungere dispositivi"));
        return;
      }
      const client = clients.find((c) => c.id === values.client_id) || addDeviceClient;
      if (!client) {
        toast.error(t("addDevice.toasts.selectClient", "Seleziona un cliente"));
        return;
      }

      const deviceInsert: TablesInsert<"devices"> = {
        category: values.category,
        device_type: values.device_type,
        asset_tag: values.asset_tag || "",
        brand: (values.brand as string) || null,
        client_id: client.id,
        model: values.model,
        serial: values.serial || null,
        assigned_to: (values.end_user as string) || null,
        os: values.os || null,
        cpu_name: values.cpu_name || null,
        ram_gb: values.ram_gb ?? null,
        storage_capacity_gb: values.storage_capacity_gb ?? null,
        storage_type: values.storage_type || null,
        ip_address: values.ip_address || null,
        mac_address: values.mac_address || null,
        location: values.location || null,
        firmware_version: values.firmware_version || null,
        port_count: values.port_count ?? null,
        poe_supported: values.poe_supported ?? false,
        toner_model: values.toner_model || null,
        page_count: values.page_count ?? null,
        print_technology: values.print_technology || null,
        license_expiry: values.license_expiry || null,
        vlan_config: values.vlan_config || null,
        rack_position: values.rack_position || null,
        server_role: values.server_role || null,
        purchase_cost: values.purchase_cost ?? null,
        notes: (values.notes as string) || null,
        created_by: user!.id,
      };
      const data = await createDeviceMut.mutateAsync(deviceInsert as any);
      await insertActivity({
        type: "user",
        message: t("addDevice.activityAdded", { tag: data.asset_tag || data.serial || values.model, defaultValue: "Dispositivo {{tag}} aggiunto all'inventario" }),
        actor_id: user!.id,
      });
      toast.success(t("addDevice.toasts.addedToInventory", "Dispositivo aggiunto all'inventario"));
      form.reset({
        category: DEFAULT_DEVICE_CATEGORY,
        device_type: DEFAULT_DEVICE_TYPE,
        asset_tag: "",
        brand: null,
        model: "",
        serial: "",
        client_id: client.id,
        end_user: null,
        os: osOptions[0] ?? OS_OPTIONS[0],
        poe_supported: false,
        purchase_cost: null,
        notes: null,
      });
      closeAddDevice();
    } catch (e: unknown) {
      const msg = errorMessage(e, t("addDevice.toasts.createError", "Errore creazione dispositivo"));
      // show more visible error for debugging
      toast.error(msg);
      console.error("AddDevice error:", e);
    } finally {
      setBusy(false);
    }
  });

  async function onAddClick() {
    // trigger validation run and focus first invalid field if any
    // Log current values to help debug cases where fields look filled but validation fails
    console.debug("AddDevice attempted values:", form.getValues());
    const ok = await form.trigger();
    if (!ok) {
      // compute first error and show its message if available
      // also log a serialized copy of errors + values to ensure copy/paste-friendly output
      try {
        const errorsMap = Object.fromEntries(
          Object.entries(form.formState.errors).map(([k, v]) => [
            k,
            {
              message: (v as any)?.message ?? null,
              type: (v as any)?.type ?? null,
              ref: (v as any)?.ref ? ((v as any).ref.name || String((v as any).ref)) : null,
            },
          ]),
        );
        console.error("AddDevice validation failed keys:", Object.keys(form.formState.errors));
        console.error("AddDevice validation failed (errors):\n" + JSON.stringify(errorsMap, null, 2));
        console.error("AddDevice values:\n" + JSON.stringify(form.getValues(), null, 2));
      } catch (e) {
        console.error("AddDevice validation failed (unable to serialize)", e, form.formState.errors, form.getValues());
      }

      const entries = Object.entries(form.formState.errors);
      const first = entries[0];
      if (first) {
        const [field, err] = first as [string, any];
        if (field) form.setFocus(field as any);
        const message = err?.message || t("addDevice.toasts.validationRequired", "Compila i campi obbligatori prima di procedere");
        toast.error(message);
      } else {
        toast.error(t("addDevice.toasts.validationRequired", "Compila i campi obbligatori prima di procedere"));
      }
      return;
    }
    // call submit handler (will run final validation and submit)
    void submit();
  }

  return (
    <Modal
      open={addDeviceOpen}
      onClose={closeAddDevice}
      title={t("addDevice.title", "Aggiungi dispositivo")}
      size="lg"
      footer={
        <>
          <button className="pc-btn pc-btn-ghost" onClick={closeAddDevice}>
            {t("addDevice.cancel", "Annulla")}
          </button>
          <button className="pc-btn pc-btn-primary" disabled={busy} onClick={onAddClick}>
            {busy ? t("addDevice.adding", "Creazione...") : t("addDevice.addDevice", "Aggiungi dispositivo")}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-[14px]">
        <div
          className="rounded-md border px-3 py-2 text-[12.5px]"
          style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
        >
          <div className="flex items-start gap-2">
            <Barcode className="mt-0.5 size-4 shrink-0 text-accent" />
            <div>
              <div className="font-semibold text-text">{t("addDevice.barcodeTitle", "Barcode 1D per inserimento rapido")}</div>
              <div className="text-text3">
                {t("addDevice.barcodeDescription", "Funzione diversa dal QR code inventario: usa scanner USB/Bluetooth o camera per compilare asset tag interno e seriale produttore.")}
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
          <Field label={t("addDevice.fieldCategory", "Categoria *")}>
            <select className="pc-input" {...form.register("category")}>
              {DEVICE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {DEVICE_CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("addDevice.fieldType", "Tipo *")}>
            <select className="pc-input" {...form.register("device_type")}>
              {selectedTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            {form.formState.errors.device_type && (
              <p className="text-sm text-destructive mt-1">
                {form.formState.errors.device_type.message}
              </p>
            )}
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
          <Field label={t("addDevice.fieldAssetTag", "Asset tag interno")}>
            <div className="flex gap-2">
              <input
                className="pc-input min-w-0 font-mono"
                {...form.register("asset_tag")}
                placeholder="Auto: PCR-000001"
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
              />
              <button
                type="button"
                className="pc-btn pc-btn-ghost pc-btn-sm shrink-0"
                onClick={() => focusBarcodeTarget("asset_tag")}
                title="Focus rapido per scanner hardware"
              >
                <ScanLine className="h-3.5 w-3.5" />
                USB
              </button>
              <button
                type="button"
                className="pc-btn pc-btn-ghost pc-btn-sm shrink-0"
                onClick={() => setBarcodeTarget("asset_tag")}
                title="Scansiona barcode 1D con camera"
              >
                <Barcode className="h-3.5 w-3.5" />
              </button>
            </div>
          </Field>
          <Field label={t("addDevice.fieldBrand", "Brand")}>
            <select className="pc-input" {...form.register("brand")}>
              <option value="">{t("addDevice.noBrand", "— Nessun brand —")}</option>
              {brandOptions.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("addDevice.fieldModel", "Modello *")}>
            <input
              className="pc-input"
              {...form.register("model")}
              placeholder="Dell Latitude 5540"
            />
            {form.formState.errors.model && (
              <p className="text-sm text-destructive mt-1">{form.formState.errors.model.message}</p>
            )}
          </Field>
          <Field label={t("addDevice.fieldSerial", "Seriale produttore")}>
            <div className="flex gap-2">
              <input
                className="pc-input min-w-0 font-mono"
                {...form.register("serial")}
                placeholder="Opzionale"
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
              />
              <button
                type="button"
                className="pc-btn pc-btn-ghost pc-btn-sm shrink-0"
                onClick={() => focusBarcodeTarget("serial")}
                title="Focus rapido per scanner hardware"
              >
                <ScanLine className="h-3.5 w-3.5" />
                USB
              </button>
              <button
                type="button"
                className="pc-btn pc-btn-ghost pc-btn-sm shrink-0"
                onClick={() => setBarcodeTarget("serial")}
                title="Scansiona barcode 1D con camera"
              >
                <Barcode className="h-3.5 w-3.5" />
              </button>
            </div>
            {form.formState.errors.serial && (
              <p className="text-sm text-destructive mt-1">
                {form.formState.errors.serial.message}
              </p>
            )}
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
          <Field label={t("addDevice.fieldClient", "Cliente *")}>
            {addDeviceClient?.lockClient ? (
              <div
                className="flex min-h-10 items-center rounded-md border px-3 text-sm font-semibold"
                style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
              >
                {t("addDevice.clientLocked", { name: addDeviceClient.name, defaultValue: "Cliente: {{name}}" })}
                <input type="hidden" {...form.register("client_id")} />
              </div>
            ) : (
              <select className="pc-input" {...form.register("client_id")}>
                {!(clients ?? []).length && <option value="">{t("addDevice.noClientAvailable", "Nessun cliente disponibile")}</option>}
                {(Array.isArray(clients) ? clients : []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name || c.name}
                  </option>
                ))}
              </select>
            )}
            {form.formState.errors.client_id && (
              <p className="text-sm text-destructive mt-1">
                {form.formState.errors.client_id.message}
              </p>
            )}
          </Field>
          <Field label={t("addDevice.fieldEndUser", "Utente finale")}>
            <input className="pc-input" {...form.register("end_user")} />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
          <Field label={t("addDevice.fieldOs", "OS")}>
            <select className="pc-input" {...form.register("os")}>
              <option value="">{t("addDevice.notApplicable", "— Non applicabile —")}</option>
              {osOptions.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
            {form.formState.errors.os && (
              <p className="text-sm text-destructive mt-1">{form.formState.errors.os.message}</p>
            )}
          </Field>
          <Field label={t("addDevice.fieldPurchaseCost", "Costo acquisto")}>
            <input
              className="pc-input"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              {...form.register("purchase_cost")}
              placeholder="0,00"
            />
            {form.formState.errors.purchase_cost && (
              <p className="text-sm text-destructive mt-1">
                {form.formState.errors.purchase_cost.message}
              </p>
            )}
          </Field>
        </div>
        <DynamicDeviceFields category={selectedCategory} form={form} />
        <Field label={t("addDevice.fieldNotes", "Note")}>
          <textarea className="pc-input min-h-[90px]" {...form.register("notes")} />
        </Field>
      </div>
      <BarcodeScanner
        open={barcodeTarget !== null}
        onClose={() => setBarcodeTarget(null)}
        onDetected={applyBarcodeValue}
        mode="barcode-1d"
        targetLabel={barcodeTarget === "asset_tag" ? t("addDevice.fieldAssetTag", "asset tag interno") : t("addDevice.fieldSerial", "seriale produttore")}
      />
      {/* Temporary debug panel: shows validation errors and current values for easier troubleshooting */}
      {Object.keys(form.formState.errors).length > 0 && (
        <div className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <div className="font-semibold mb-2">Debug: form errors & values</div>
          <pre className="whitespace-pre-wrap max-h-48 overflow-auto">{JSON.stringify({
            errors: Object.fromEntries(
              Object.entries(form.formState.errors).map(([k, v]) => [
                k,
                { message: (v as any)?.message ?? null, type: (v as any)?.type ?? null },
              ]),
            ),
            values: form.getValues(),
          }, null, 2)}</pre>
        </div>
      )}
    </Modal>
  );
}

function DynamicDeviceFields({
  category,
  form,
}: {
  category: DeviceCategory;
  form: UseFormReturn<DeviceFormInput, unknown, DeviceInput>;
}) {
  const { t } = useTranslation("tickets");
  if (category === "printing") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
        <Field label={t("addDevice.fieldIp", "IP")}>
          <input
            className="pc-input font-mono"
            {...form.register("ip_address")}
            placeholder="192.168.1.50"
          />
        </Field>
        <Field label={t("addDevice.fieldTechnology", "Tecnologia")}>
          <input
            className="pc-input"
            {...form.register("print_technology")}
            placeholder="Laser, inkjet..."
          />
        </Field>
        <Field label={t("addDevice.fieldTonerModel", "Modello toner")}>
          <input className="pc-input" {...form.register("toner_model")} />
        </Field>
        <Field label={t("addDevice.fieldPageCount", "Contatore pagine")}>
          <input className="pc-input" type="number" min="0" {...form.register("page_count")} />
        </Field>
      </div>
    );
  }

  if (category === "network") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
        <Field label="IP management">
          <input
            className="pc-input font-mono"
            {...form.register("ip_address")}
            placeholder="192.168.1.1"
          />
        </Field>
        <Field label={t("addDevice.fieldMacAddress", "MAC address")}>
          <input
            className="pc-input font-mono"
            {...form.register("mac_address")}
            placeholder="00:11:22:33:44:55"
          />
        </Field>
        <Field label={t("addDevice.fieldFirmware", "Firmware")}>
          <input className="pc-input" {...form.register("firmware_version")} />
        </Field>
        <Field label={t("addDevice.fieldPortCount", "Numero porte")}>
          <input className="pc-input" type="number" min="0" {...form.register("port_count")} />
        </Field>
        <Field label={t("addDevice.fieldVlan", "VLAN")}>
          <input className="pc-input" {...form.register("vlan_config")} placeholder="10, 20, 30" />
        </Field>
        <Field label={t("addDevice.fieldLicenseExpiry", "Scadenza licenza")}>
          <Controller
            name="license_expiry"
            control={form.control}
            render={({ field }) => (
              <DatePickerInput
                value={field.value ?? ""}
                onChange={field.onChange}
              />
            )}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...form.register("poe_supported")} />
          {t("addDevice.fieldPoe", "PoE supportato")}
        </label>
      </div>
    );
  }

  if (category === "server_infra") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
        <Field label={t("addDevice.fieldIp", "IP")}>
          <input className="pc-input font-mono" {...form.register("ip_address")} />
        </Field>
        <Field label={t("addDevice.fieldRackPosition", "Rack position")}>
          <input
            className="pc-input"
            {...form.register("rack_position")}
            placeholder="Rack A / U12"
          />
        </Field>
        <Field label={t("addDevice.fieldCpu", "CPU")}>
          <input className="pc-input" {...form.register("cpu_name")} />
        </Field>
      <Field label={t("addDevice.fieldRamGb", "RAM GB")}>
          <input className="pc-input" type="number" min="0" {...form.register("ram_gb")} />
        </Field>
        <Field label={t("addDevice.fieldStorageGb", "Storage GB")}>
          <input
            className="pc-input"
            type="number"
            min="0"
            {...form.register("storage_capacity_gb")}
          />
        </Field>
        <Field label={t("addDevice.fieldServerRole", "Ruolo server")}>
          <input
            className="pc-input"
            {...form.register("server_role")}
            placeholder="AD, backup, file server..."
          />
        </Field>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
      <Field label={t("addDevice.fieldCpu", "CPU")}>
        <input className="pc-input" {...form.register("cpu_name")} />
      </Field>
      <Field label={t("addDevice.fieldRamGb", "RAM GB")}>
        <input className="pc-input" type="number" min="0" {...form.register("ram_gb")} />
      </Field>
      <Field label={t("addDevice.fieldStorageGb", "Disco GB")}>
        <input
          className="pc-input"
          type="number"
          min="0"
          {...form.register("storage_capacity_gb")}
        />
      </Field>
      <Field label={t("addDevice.fieldStorageType", "Tipo disco")}>
        <input
          className="pc-input"
          {...form.register("storage_type")}
          placeholder="SSD, NVMe, HDD"
        />
      </Field>
    </div>
  );
}

