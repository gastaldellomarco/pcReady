import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BILLING_TYPE_LABEL,
  BUNDLE_PRIORITY_LABEL,
  computeEndDate,
  type AssistanceBundle,
  type BundleBillingType,
  type BundleTicketPriority,
  type ClientBundleAssignment,
} from "@/lib/bundles";

type ClientOption = {
  id: string;
  name?: string | null;
  company_name?: string | null;
  email?: string | null;
};

type BundleFormState = {
  name: string;
  description: string;
  billing_type: BundleBillingType;
  fee: string;
  currency: string;
  included_hours: string;
  unlimited_hours: boolean;
  extra_hourly_rate: string;
  sla_response_hours: string;
  sla_resolution_hours: string;
  included_onsite_visits: string;
  unlimited_onsite_visits: boolean;
  remote_support: boolean;
  ticket_priority: BundleTicketPriority;
  auto_renew: boolean;
  active: boolean;
};

type AssignmentFormState = {
  client_id: string;
  bundle_id: string;
  start_date: string;
  end_date: string;
  auto_renew: boolean;
  renewal_mode: string;
  custom_fee: string;
  custom_included_hours: string;
  custom_extra_hourly_rate: string;
  custom_sla_response_hours: string;
  custom_sla_resolution_hours: string;
  custom_included_onsite_visits: string;
  notes: string;
};

const fieldClass =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50";
const labelClass = "space-y-1.5 text-sm font-medium text-text2";
const hintClass = "text-xs font-normal text-text3";
const checkboxClass = "h-4 w-4 rounded border-border text-accent focus:ring-accent";

function numberOrZero(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function numberOrNull(value: string) {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function clientLabel(client: ClientOption) {
  const displayName = client.company_name || client.name || client.email || client.id;
  return client.email ? `${displayName} · ${client.email}` : displayName;
}

function bundleInitialState(initial?: Partial<AssistanceBundle> | null): BundleFormState {
  return {
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    billing_type: initial?.billing_type ?? "monthly",
    fee: String(initial?.fee ?? 0),
    currency: initial?.currency ?? "EUR",
    included_hours: initial?.included_hours == null ? "" : String(initial.included_hours),
    unlimited_hours: initial?.included_hours == null,
    extra_hourly_rate: String(initial?.extra_hourly_rate ?? 0),
    sla_response_hours: String(initial?.sla_response_hours ?? 0),
    sla_resolution_hours: String(initial?.sla_resolution_hours ?? 0),
    included_onsite_visits:
      initial?.included_onsite_visits == null ? "" : String(initial.included_onsite_visits),
    unlimited_onsite_visits: initial?.included_onsite_visits == null,
    remote_support: initial?.remote_support ?? true,
    ticket_priority: initial?.ticket_priority ?? "med",
    auto_renew: initial?.auto_renew ?? true,
    active: initial?.active ?? true,
  };
}

function assignmentInitialState(
  initial?: Partial<ClientBundleAssignment> | null,
): AssignmentFormState {
  return {
    client_id: initial?.client_id ?? "",
    bundle_id: initial?.bundle_id ?? "",
    start_date: initial?.start_date ?? dateToday(),
    end_date: initial?.end_date ?? "",
    auto_renew: initial?.auto_renew ?? true,
    renewal_mode: initial?.renewal_mode ?? "automatic",
    custom_fee: initial?.custom_fee == null ? "" : String(initial.custom_fee),
    custom_included_hours:
      initial?.custom_included_hours == null ? "" : String(initial.custom_included_hours),
    custom_extra_hourly_rate:
      initial?.custom_extra_hourly_rate == null ? "" : String(initial.custom_extra_hourly_rate),
    custom_sla_response_hours:
      initial?.custom_sla_response_hours == null ? "" : String(initial.custom_sla_response_hours),
    custom_sla_resolution_hours:
      initial?.custom_sla_resolution_hours == null
        ? ""
        : String(initial.custom_sla_resolution_hours),
    custom_included_onsite_visits:
      initial?.custom_included_onsite_visits == null
        ? ""
        : String(initial.custom_included_onsite_visits),
    notes: initial?.notes ?? "",
  };
}

export function BundleForm({
  initial,
  onSubmit,
  onCancel,
  busy = false,
}: {
  initial?: Partial<AssistanceBundle> | null;
  onSubmit: (data: Partial<AssistanceBundle>) => void | Promise<void>;
  onCancel: () => void;
  busy?: boolean;
}) {
  const { t } = useTranslation("bundles");
  const [form, setForm] = useState<BundleFormState>(() => bundleInitialState(initial));

  useEffect(() => {
    setForm(bundleInitialState(initial));
  }, [initial]);

  function patch(update: Partial<BundleFormState>) {
    setForm((current) => ({ ...current, ...update }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit({
      name: form.name.trim(),
      description: form.description.trim() || null,
      billing_type: form.billing_type,
      fee: numberOrZero(form.fee),
      currency: form.currency.trim() || "EUR",
      included_hours: form.unlimited_hours ? null : numberOrNull(form.included_hours),
      extra_hourly_rate: numberOrZero(form.extra_hourly_rate),
      sla_response_hours: numberOrZero(form.sla_response_hours),
      sla_resolution_hours: numberOrZero(form.sla_resolution_hours),
      included_onsite_visits: form.unlimited_onsite_visits
        ? null
        : numberOrNull(form.included_onsite_visits),
      remote_support: form.remote_support,
      ticket_priority: form.ticket_priority,
      auto_renew: form.auto_renew,
      active: form.active,
    });
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className={labelClass}>
          {t("form.bundleName", "Nome bundle")}
          <input
            className={fieldClass}
            value={form.name}
            onChange={(event) => patch({ name: event.target.value })}
            required
            disabled={busy}
          />
        </label>
        <label className={labelClass}>
          {t("form.billingType", "Tipo fatturazione")}
          <select
            className={fieldClass}
            value={form.billing_type}
            onChange={(event) => patch({ billing_type: event.target.value as BundleBillingType })}
            disabled={busy}
          >
            {Object.entries(BILLING_TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-sm font-medium text-text2 md:col-span-2">
          {t("form.description", "Descrizione")}
          <textarea
            className={`${fieldClass} min-h-24`}
            value={form.description}
            onChange={(event) => patch({ description: event.target.value })}
            disabled={busy}
          />
        </label>
        <label className={labelClass}>
          {t("form.fee", "Canone")}
          <input
            className={fieldClass}
            type="number"
            min="0"
            step="0.01"
            value={form.fee}
            onChange={(event) => patch({ fee: event.target.value })}
            disabled={busy}
          />
        </label>
        <label className={labelClass}>
          {t("form.currency", "Valuta")}
          <input
            className={fieldClass}
            value={form.currency}
            onChange={(event) => patch({ currency: event.target.value.toUpperCase() })}
            maxLength={3}
            disabled={busy}
          />
        </label>
        <div className={labelClass}>
          {t("form.includedHours", "Ore incluse")}
          <input
            className={fieldClass}
            type="number"
            min="0"
            step="0.25"
            value={form.included_hours}
            onChange={(event) =>
              patch({ included_hours: event.target.value, unlimited_hours: false })
            }
            disabled={busy || form.unlimited_hours}
          />
          <label className="flex items-center gap-2 text-xs font-normal text-text3">
            <input
              className={checkboxClass}
              type="checkbox"
              checked={form.unlimited_hours}
              onChange={(event) => patch({ unlimited_hours: event.target.checked })}
              disabled={busy}
            />
            {t("form.unlimitedHours", "Ore illimitate")}
          </label>
        </div>
        <label className={labelClass}>
          {t("form.extraRate", "Tariffa extra oraria")}
          <input
            className={fieldClass}
            type="number"
            min="0"
            step="0.01"
            value={form.extra_hourly_rate}
            onChange={(event) => patch({ extra_hourly_rate: event.target.value })}
            disabled={busy}
          />
        </label>
        <label className={labelClass}>
          {t("form.slaResponse", "SLA risposta (ore)")}
          <input
            className={fieldClass}
            type="number"
            min="0"
            step="1"
            value={form.sla_response_hours}
            onChange={(event) => patch({ sla_response_hours: event.target.value })}
            disabled={busy}
          />
        </label>
        <label className={labelClass}>
          {t("form.slaResolution", "SLA risoluzione (ore)")}
          <input
            className={fieldClass}
            type="number"
            min="0"
            step="1"
            value={form.sla_resolution_hours}
            onChange={(event) => patch({ sla_resolution_hours: event.target.value })}
            disabled={busy}
          />
        </label>
        <div className={labelClass}>
          {t("form.onsiteVisits", "Visite on-site incluse")}
          <input
            className={fieldClass}
            type="number"
            min="0"
            step="1"
            value={form.included_onsite_visits}
            onChange={(event) =>
              patch({ included_onsite_visits: event.target.value, unlimited_onsite_visits: false })
            }
            disabled={busy || form.unlimited_onsite_visits}
          />
          <label className="flex items-center gap-2 text-xs font-normal text-text3">
            <input
              className={checkboxClass}
              type="checkbox"
              checked={form.unlimited_onsite_visits}
              onChange={(event) => patch({ unlimited_onsite_visits: event.target.checked })}
              disabled={busy}
            />
            {t("form.unlimitedVisits", "Visite illimitate")}
          </label>
        </div>
        <label className={labelClass}>
          {t("form.ticketPriority", "Priorità ticket")}
          <select
            className={fieldClass}
            value={form.ticket_priority}
            onChange={(event) =>
              patch({ ticket_priority: event.target.value as BundleTicketPriority })
            }
            disabled={busy}
          >
            {Object.entries(BUNDLE_PRIORITY_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 rounded-xl border border-border bg-surface2/40 p-4 md:grid-cols-3">
        <label className="flex items-center gap-2 text-sm text-text2">
          <input
            className={checkboxClass}
            type="checkbox"
            checked={form.remote_support}
            onChange={(event) => patch({ remote_support: event.target.checked })}
            disabled={busy}
          />
          {t("form.remoteSupport", "Supporto remoto")}
        </label>
        <label className="flex items-center gap-2 text-sm text-text2">
          <input
            className={checkboxClass}
            type="checkbox"
            checked={form.auto_renew}
            onChange={(event) => patch({ auto_renew: event.target.checked })}
            disabled={busy}
          />
          {t("form.autoRenew", "Rinnovo automatico")}
        </label>
        <label className="flex items-center gap-2 text-sm text-text2">
          <input
            className={checkboxClass}
            type="checkbox"
            checked={form.active}
            onChange={(event) => patch({ active: event.target.checked })}
            disabled={busy}
          />
          {t("form.bundleActive", "Bundle attivo")}
        </label>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-text2 hover:bg-surface2 disabled:opacity-50"
          onClick={onCancel}
          disabled={busy}
        >
          {t("form.cancel", "Annulla")}
        </button>
        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          disabled={busy}
        >
          {busy ? t("form.saving", "Salvataggio...") : t("form.save", "Salva")}
        </button>
      </div>
    </form>
  );
}

export function AssignmentForm({
  bundles,
  clients,
  initial,
  onSubmit,
  onCancel,
  busy = false,
}: {
  bundles: AssistanceBundle[];
  clients: ClientOption[];
  initial?: Partial<ClientBundleAssignment> | null;
  onSubmit: (data: Partial<ClientBundleAssignment>) => void | Promise<void>;
  onCancel: () => void;
  busy?: boolean;
}) {
  const { t } = useTranslation("bundles");
  const [form, setForm] = useState<AssignmentFormState>(() => assignmentInitialState(initial));
  const selectedBundle = useMemo(
    () => bundles.find((bundle) => bundle.id === form.bundle_id) ?? null,
    [bundles, form.bundle_id],
  );

  useEffect(() => {
    setForm(assignmentInitialState(initial));
  }, [initial]);

  useEffect(() => {
    if (!selectedBundle || !form.start_date || form.end_date) return;
    const endDate = computeEndDate(form.start_date, selectedBundle.billing_type);
    if (endDate) setForm((current) => ({ ...current, end_date: current.end_date || endDate }));
  }, [selectedBundle, form.start_date, form.end_date]);

  function patch(update: Partial<AssignmentFormState>) {
    setForm((current) => ({ ...current, ...update }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit({
      client_id: form.client_id,
      bundle_id: form.bundle_id,
      start_date: form.start_date,
      end_date: form.end_date || null,
      auto_renew: form.auto_renew,
      renewal_mode: form.renewal_mode.trim() || "automatic",
      custom_fee: numberOrNull(form.custom_fee),
      custom_included_hours: numberOrNull(form.custom_included_hours),
      custom_extra_hourly_rate: numberOrNull(form.custom_extra_hourly_rate),
      custom_sla_response_hours: numberOrNull(form.custom_sla_response_hours),
      custom_sla_resolution_hours: numberOrNull(form.custom_sla_resolution_hours),
      custom_included_onsite_visits: numberOrNull(form.custom_included_onsite_visits),
      notes: form.notes.trim() || null,
    });
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className={labelClass}>
          {t("assignment.client", "Cliente")}
          <select
            className={fieldClass}
            value={form.client_id}
            onChange={(event) => patch({ client_id: event.target.value })}
            required
            disabled={busy}
          >
            <option value="">{t("assignment.selectClient", "Seleziona cliente")}</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {clientLabel(client)}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          {t("assignment.bundle", "Bundle")}
          <select
            className={fieldClass}
            value={form.bundle_id}
            onChange={(event) => patch({ bundle_id: event.target.value, end_date: "" })}
            required
            disabled={busy}
          >
            <option value="">{t("assignment.selectBundle", "Seleziona bundle")}</option>
            {bundles.map((bundle) => (
              <option key={bundle.id} value={bundle.id}>
                {bundle.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          {t("assignment.startDate", "Data inizio")}
          <input
            className={fieldClass}
            type="date"
            value={form.start_date}
            onChange={(event) => patch({ start_date: event.target.value, end_date: "" })}
            required
            disabled={busy}
          />
        </label>
        <label className={labelClass}>
          {t("assignment.endDate", "Data fine")}
          <input
            className={fieldClass}
            type="date"
            value={form.end_date}
            onChange={(event) => patch({ end_date: event.target.value })}
            disabled={busy}
          />
        </label>
        <label className={labelClass}>
          {t("assignment.renewalMode", "Modalità rinnovo")}
          <select
            className={fieldClass}
            value={form.renewal_mode}
            onChange={(event) => patch({ renewal_mode: event.target.value })}
            disabled={busy}
          >
            <option value="automatic">{t("assignment.renewalAutomatic", "Automatico")}</option>
            <option value="manual">{t("assignment.renewalManual", "Manuale")}</option>
          </select>
        </label>
        <label className="flex items-center gap-2 pt-7 text-sm text-text2">
          <input
            className={checkboxClass}
            type="checkbox"
            checked={form.auto_renew}
            onChange={(event) => patch({ auto_renew: event.target.checked })}
            disabled={busy}
          />
          {t("assignment.autoRenew", "Rinnovo automatico")}
        </label>
      </div>

      <div className="rounded-xl border border-border bg-surface2/40 p-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-text2">{t("assignment.customOverrides", "Override personalizzati")}</h3>
          <p className={hintClass}>
            {t("assignment.customHint", "Lascia vuoto un campo per usare il valore configurato nel bundle.")}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <label className={labelClass}>
            {t("assignment.customFee", "Canone custom")}
            <input
              className={fieldClass}
              type="number"
              min="0"
              step="0.01"
              value={form.custom_fee}
              onChange={(event) => patch({ custom_fee: event.target.value })}
              disabled={busy}
            />
          </label>
          <label className={labelClass}>
            {t("assignment.customHours", "Ore incluse custom")}
            <input
              className={fieldClass}
              type="number"
              min="0"
              step="0.25"
              value={form.custom_included_hours}
              onChange={(event) => patch({ custom_included_hours: event.target.value })}
              disabled={busy}
            />
          </label>
          <label className={labelClass}>
            {t("assignment.customExtraRate", "Tariffa extra custom")}
            <input
              className={fieldClass}
              type="number"
              min="0"
              step="0.01"
              value={form.custom_extra_hourly_rate}
              onChange={(event) => patch({ custom_extra_hourly_rate: event.target.value })}
              disabled={busy}
            />
          </label>
          <label className={labelClass}>
            {t("assignment.customSlaResponse", "SLA risposta custom")}
            <input
              className={fieldClass}
              type="number"
              min="0"
              step="1"
              value={form.custom_sla_response_hours}
              onChange={(event) => patch({ custom_sla_response_hours: event.target.value })}
              disabled={busy}
            />
          </label>
          <label className={labelClass}>
            {t("assignment.customSlaResolution", "SLA risoluzione custom")}
            <input
              className={fieldClass}
              type="number"
              min="0"
              step="1"
              value={form.custom_sla_resolution_hours}
              onChange={(event) => patch({ custom_sla_resolution_hours: event.target.value })}
              disabled={busy}
            />
          </label>
          <label className={labelClass}>
            {t("assignment.customOnsite", "Visite on-site custom")}
            <input
              className={fieldClass}
              type="number"
              min="0"
              step="1"
              value={form.custom_included_onsite_visits}
              onChange={(event) => patch({ custom_included_onsite_visits: event.target.value })}
              disabled={busy}
            />
          </label>
        </div>
      </div>

      <label className="space-y-1.5 text-sm font-medium text-text2">
        {t("assignment.notes", "Note")}
        <textarea
          className={`${fieldClass} min-h-24`}
          value={form.notes}
          onChange={(event) => patch({ notes: event.target.value })}
          disabled={busy}
        />
      </label>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-text2 hover:bg-surface2 disabled:opacity-50"
          onClick={onCancel}
          disabled={busy}
        >
          {t("assignment.cancel", "Annulla")}
        </button>
        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          disabled={busy}
        >
          {busy ? t("assignment.saving", "Salvataggio...") : t("assignment.save", "Salva")}
        </button>
      </div>
    </form>
  );
}
