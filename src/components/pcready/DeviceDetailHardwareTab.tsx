import { Cpu, HardDrive, Monitor, Network, Save } from "lucide-react";
import { type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import type { DeviceRow, HardwareDraft } from "./deviceDetailUtils";

function HardwareInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="text-xs">
      <span className="pc-label">{label}</span>
      <input
        className="pc-input mt-1 w-full"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function HardwareCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="text-xs flex items-center gap-2">
      <input
        type="checkbox"
        className="mt-1 size-4"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="pc-label">{label}</span>
    </label>
  );
}

function HardwareSection({
  icon,
  title,
  rows,
}: {
  icon: ReactNode;
  title: string;
  rows: [string, unknown][];
}) {
  return (
    <div
      className="rounded-lg border p-3"
      style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
    >
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </div>
      <div className="grid gap-1 text-[12.5px]">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <span className="text-text3">{label}</span>
            <span className="text-right font-medium">
              {value == null || value === "" ? "—" : String(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DeviceDetailHardwareTab({
  device,
  draft,
  setDraft,
  editing,
  saving,
  canEdit,
  systemHealth,
  onEdit,
  onCancel,
  onSave,
}: {
  device: DeviceRow;
  draft: HardwareDraft;
  setDraft: Dispatch<SetStateAction<HardwareDraft>>;
  editing: boolean;
  saving: boolean;
  canEdit: boolean;
  systemHealth: { label: string; description: string; color: string; background: string };
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const { t } = useTranslation("tickets");
  const update = (key: keyof HardwareDraft, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  return (
    <div className="flex flex-col gap-4">
      <div
        className="rounded-lg border p-3"
        style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ background: systemHealth.background, color: systemHealth.color }}
          >
            <Cpu className="size-5" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold">
              {t("device.hardware.systemHealth", {
                label: systemHealth.label,
                defaultValue: "Stato sistema: {{label}}",
              })}
            </div>
            <div className="text-xs text-text3">{systemHealth.description}</div>
          </div>
          {canEdit && !editing ? (
            <button className="pc-btn pc-btn-primary pc-btn-sm" onClick={onEdit}>
              {t("device.editHardware", "Modifica hardware")}
            </button>
          ) : null}
        </div>
      </div>

      {editing ? (
        <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
          <div className="grid gap-3 md:grid-cols-3">
            <HardwareInput label="CPU" value={draft.cpu_name} onChange={(v) => update("cpu_name", v)} />
            <HardwareInput label="Frequenza GHz" type="number" value={draft.cpu_frequency_ghz} onChange={(v) => update("cpu_frequency_ghz", v)} />
            <HardwareInput label="Core" type="number" value={draft.cpu_cores} onChange={(v) => update("cpu_cores", v)} />
            <HardwareInput label="RAM GB" type="number" value={draft.ram_gb} onChange={(v) => update("ram_gb", v)} />
            <HardwareInput label="Tipo RAM" value={draft.ram_type} onChange={(v) => update("ram_type", v)} />
            <HardwareInput label="Freq. RAM MHz" type="number" value={draft.ram_frequency_mhz} onChange={(v) => update("ram_frequency_mhz", v)} />
            <HardwareInput label={t("device.hardware.storageType", "Storage tipo")} value={draft.storage_type} onChange={(v) => update("storage_type", v)} />
            <HardwareInput label="Storage GB" type="number" value={draft.storage_capacity_gb} onChange={(v) => update("storage_capacity_gb", v)} />
            <HardwareInput label="Drive" type="number" value={draft.storage_drive_count} onChange={(v) => update("storage_drive_count", v)} />
            <HardwareInput label="Sistema operativo" value={draft.os} onChange={(v) => update("os", v)} />
            <HardwareInput label="Versione OS" value={draft.os_version} onChange={(v) => update("os_version", v)} />
            <HardwareInput label="Architettura" value={draft.os_architecture} onChange={(v) => update("os_architecture", v)} />
            <HardwareInput label="Risoluzione" value={draft.screen_resolution} onChange={(v) => update("screen_resolution", v)} />
            <HardwareInput label="Dimensione schermo" type="number" value={draft.screen_size_inches} onChange={(v) => update("screen_size_inches", v)} />
            <HardwareInput label="Tipo schermo" value={draft.screen_type} onChange={(v) => update("screen_type", v)} />
            <HardwareInput label={t("device.hardware.wifi", "Wi‑Fi")} value={draft.wifi} onChange={(v) => update("wifi", v)} />
            <HardwareInput label="Ethernet" value={draft.ethernet} onChange={(v) => update("ethernet", v)} />
            <HardwareInput label="Bluetooth" value={draft.bluetooth} onChange={(v) => update("bluetooth", v)} />
            <HardwareInput label="IP" value={draft.ip_address} onChange={(v) => update("ip_address", v)} />
            <HardwareInput label="MAC address" value={draft.mac_address} onChange={(v) => update("mac_address", v)} />
            <HardwareInput label="Firmware" value={draft.firmware_version} onChange={(v) => update("firmware_version", v)} />
            <HardwareInput label="Numero porte" type="number" value={draft.port_count} onChange={(v) => update("port_count", v)} />
            <div>
              <HardwareCheckbox label="PoE supportato" checked={draft.poe_supported === "true"} onChange={(v) => update("poe_supported", v ? "true" : "false")} />
            </div>
            <HardwareInput label="VLAN" value={draft.vlan_config} onChange={(v) => update("vlan_config", v)} />
            <label className="text-xs">
              <span className="pc-label">Scadenza licenza</span>
              <DatePickerInput className="mt-1 w-full" value={draft.license_expiry} onChange={(v) => update("license_expiry", v)} />
            </label>
            <HardwareInput label="Rack position" value={draft.rack_position} onChange={(v) => update("rack_position", v)} />
            <HardwareInput label="Ruolo server" value={draft.server_role} onChange={(v) => update("server_role", v)} />
            <HardwareInput label="Modello toner" value={draft.toner_model} onChange={(v) => update("toner_model", v)} />
            <HardwareInput label="Contatore pagine" type="number" value={draft.page_count} onChange={(v) => update("page_count", v)} />
            <HardwareInput label="Tecnologia stampa" value={draft.print_technology} onChange={(v) => update("print_technology", v)} />
          </div>
          <div className="mt-3 flex gap-2">
            <button className="pc-btn pc-btn-primary pc-btn-sm" disabled={saving} onClick={onSave}>
              <Save className="size-3" />{" "}
              {saving ? t("device.saving", "Salvataggio...") : t("device.saveHardware", "Salva hardware")}
            </button>
            <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={onCancel}>
              {t("device.cancel", "Annulla")}
            </button>
          </div>
        </div>
      ) : (
        <HardwareViewMode device={device} />
      )}
    </div>
  );
}

function HardwareViewMode({ device }: { device: DeviceRow }) {
  const category = (device.category || "endpoint").toString();

  if (category === "printing") {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <HardwareSection icon={<Network className="size-4" />} title="Rete" rows={[["IP", device.ip_address], ["MAC", device.mac_address], ["Firmware", device.firmware_version]]} />
        <HardwareSection icon={<Monitor className="size-4" />} title="Stampa" rows={[["Tecnologia", device.print_technology], ["Toner", device.toner_model], ["Contatore", device.page_count]]} />
        <HardwareSection icon={<HardDrive className="size-4" />} title="Altro" rows={[["VLAN", device.vlan_config], ["Scadenza licenza", device.license_expiry], ["PoE", device.poe_supported ? "Sì" : "—"]]} />
      </div>
    );
  }
  if (category === "network") {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <HardwareSection icon={<Network className="size-4" />} title="Management" rows={[["IP", device.ip_address], ["MAC", device.mac_address], ["Firmware", device.firmware_version]]} />
        <HardwareSection icon={<Network className="size-4" />} title="Porte" rows={[["Numero porte", device.port_count], ["VLAN", device.vlan_config], ["PoE", device.poe_supported ? "Sì" : "—"]]} />
        <HardwareSection icon={<Monitor className="size-4" />} title="Licenza" rows={[["Scadenza licenza", device.license_expiry], ["Note firmware", device.firmware_version]]} />
      </div>
    );
  }
  if (category === "server_infra") {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <HardwareSection icon={<Network className="size-4" />} title="Rete" rows={[["IP", device.ip_address], ["MAC", device.mac_address]]} />
        <HardwareSection icon={<HardDrive className="size-4" />} title="Rack & ruolo" rows={[["Rack", device.rack_position], ["Ruolo", device.server_role]]} />
        <HardwareSection icon={<Cpu className="size-4" />} title="CPU" rows={[["Nome", device.cpu_name], ["Frequenza", device.cpu_frequency_ghz ? `${device.cpu_frequency_ghz} GHz` : null], ["Core", device.cpu_cores]]} />
        <HardwareSection icon={<Cpu className="size-4" />} title="RAM" rows={[["Totale", device.ram_gb ? `${device.ram_gb} GB` : null], ["Tipo", device.ram_type]]} />
        <HardwareSection icon={<HardDrive className="size-4" />} title="Storage" rows={[["Tipo", device.storage_type], ["Capacità", device.storage_capacity_gb ? `${device.storage_capacity_gb} GB` : null]]} />
      </div>
    );
  }
  if (category === "mobile") {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <HardwareSection icon={<Monitor className="size-4" />} title="Sistema operativo" rows={[["OS", device.os], ["Versione", device.os_version]]} />
        <HardwareSection icon={<Monitor className="size-4" />} title="Schermo" rows={[["Risoluzione", device.screen_resolution], ["Dimensione", device.screen_size_inches ? `${device.screen_size_inches}"` : null]]} />
        <HardwareSection icon={<Network className="size-4" />} title="Connettività" rows={[["Wi‑Fi", device.wifi], ["Bluetooth", device.bluetooth]]} />
      </div>
    );
  }
  if (category === "peripheral") {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <HardwareSection icon={<Monitor className="size-4" />} title="Specifiche" rows={[["Modello", device.model], ["IP", device.ip_address], ["MAC", device.mac_address]]} />
        <HardwareSection icon={<Network className="size-4" />} title="Connettività" rows={[["Ethernet", device.ethernet], ["Wi‑Fi", device.wifi], ["Bluetooth", device.bluetooth]]} />
      </div>
    );
  }

  // default: endpoint / generic
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <HardwareSection icon={<Cpu className="size-4" />} title="CPU" rows={[["Nome", device.cpu_name], ["Frequenza", device.cpu_frequency_ghz ? `${device.cpu_frequency_ghz} GHz` : null], ["Core", device.cpu_cores]]} />
      <HardwareSection icon={<Cpu className="size-4" />} title="RAM" rows={[["Totale", device.ram_gb ? `${device.ram_gb} GB` : null], ["Tipo", device.ram_type]]} />
      <HardwareSection icon={<HardDrive className="size-4" />} title="Storage" rows={[["Tipo", device.storage_type], ["Capacità", device.storage_capacity_gb ? `${device.storage_capacity_gb} GB` : null]]} />
      <HardwareSection icon={<Monitor className="size-4" />} title="Sistema operativo" rows={[["Nome", device.os], ["Versione", device.os_version], ["Architettura", device.os_architecture]]} />
      <HardwareSection icon={<Monitor className="size-4" />} title="Schermo" rows={[["Risoluzione", device.screen_resolution], ["Dimensione", device.screen_size_inches ? `${device.screen_size_inches}"` : null], ["Tipo", device.screen_type]]} />
      <HardwareSection icon={<Network className="size-4" />} title="Connettività" rows={[["Wi‑Fi", device.wifi], ["Ethernet", device.ethernet], ["Bluetooth", device.bluetooth]]} />
    </div>
  );
}
