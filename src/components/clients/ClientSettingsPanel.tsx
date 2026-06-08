import { useQueryClient } from "@tanstack/react-query";
import { Bell, Clock, Plus, Save, Tags } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Field } from "@/components/ui/form-field";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage } from "@/lib/errors";
import queries from "@/lib/queries/clients";
/**
 *
 */
export function ClientSettingsPanel({
  clientId,
  canEdit,
  userId,
  overview,
}: {
  clientId: string;
  canEdit: boolean;
  userId: string | null;
  overview: import("@/lib/queries/clients").ClientOverview | null | undefined;
}) {
  const { t } = useTranslation("clients");
  const qc = useQueryClient();
  const tagsQuery = (queries as any).useClientTags();
  const assignmentsQuery = (queries as any).useClientTagAssignments([clientId]);
  const alertsQuery = (queries as any).useClientContractAlerts(clientId);
  const allTags = (tagsQuery.data ?? []) as import("@/lib/queries/clients").ClientTag[];
  const assigned =
    ((assignmentsQuery.data ?? {}) as Record<string, import("@/lib/queries/clients").ClientTag[]>)[
      clientId
    ] ?? [];
  const assignedIds = new Set(assigned.map((tag) => tag.id));
  const bundle = overview?.activeBundle;
  const alert = ((alertsQuery.data ?? []) as any[])[0];
  const [newTag, setNewTag] = useState("");
  const [responseHours, setResponseHours] = useState("");
  const [resolutionHours, setResolutionHours] = useState("");
  const [daysBefore, setDaysBefore] = useState(30);
  const [channel, setChannel] = useState<"in_app" | "email">("in_app");
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setResponseHours(
      bundle?.effective_sla_response_hours != null
        ? String(bundle.effective_sla_response_hours)
        : "",
    );
    setResolutionHours(
      bundle?.effective_sla_resolution_hours != null
        ? String(bundle.effective_sla_resolution_hours)
        : "",
    );
  }, [bundle?.id, bundle?.effective_sla_response_hours, bundle?.effective_sla_resolution_hours]);

  useEffect(() => {
    if (!alert) return;
    setDaysBefore(alert.days_before ?? 30);
    setChannel(alert.channel ?? "in_app");
    setEnabled(Boolean(alert.enabled));
  }, [alert?.id, alert?.days_before, alert?.channel, alert?.enabled]);

  async function toggleTag(tag: import("@/lib/queries/clients").ClientTag) {
    if (!canEdit) return;
    setBusy(true);
    try {
      await (queries as any).toggleClientTag(clientId, tag.id, !assignedIds.has(tag.id), userId);
      void qc.invalidateQueries({ queryKey: ["clients", "tag-assignments"] });
      toast.success(t("tags.updated", "Tag aggiornati"));
    } catch (error) {
      toast.error(errorMessage(error, t("tags.updateError", "Errore aggiornamento tag")));
    } finally {
      setBusy(false);
    }
  }

  async function addTag() {
    if (!canEdit || !newTag.trim()) return;
    setBusy(true);
    try {
      const tag = await (queries as any).createClientTag(newTag);
      await (queries as any).toggleClientTag(clientId, tag.id, true, userId);
      setNewTag("");
      void qc.invalidateQueries({ queryKey: ["clients", "tags"] });
      void qc.invalidateQueries({ queryKey: ["clients", "tag-assignments"] });
      toast.success(t("tags.created", "Tag assegnato"));
    } catch (error) {
      toast.error(errorMessage(error, t("tags.createError", "Errore creazione tag")));
    } finally {
      setBusy(false);
    }
  }

  async function saveSla() {
    if (!canEdit || !bundle?.id) return;
    setBusy(true);
    try {
      const { error } = await (supabase as any)
        .from("client_bundle_assignments")
        .update({
          custom_sla_response_hours: responseHours ? Number(responseHours) : null,
          custom_sla_resolution_hours: resolutionHours ? Number(resolutionHours) : null,
        })
        .eq("id", bundle.id);
      if (error) throw error;
      void qc.invalidateQueries({ queryKey: ["clients", clientId, "overview"] });
      toast.success(t("sla.saved", "SLA cliente aggiornato"));
    } catch (error) {
      toast.error(errorMessage(error, t("sla.saveError", "Errore aggiornamento SLA")));
    } finally {
      setBusy(false);
    }
  }

  async function saveAlert() {
    if (!canEdit) return;
    setBusy(true);
    try {
      await (queries as any).upsertClientContractAlert({
        clientId,
        bundleAssignmentId: bundle?.id ?? null,
        daysBefore,
        channel,
        enabled,
        userId,
      });
      void qc.invalidateQueries({ queryKey: ["clients", clientId, "contract-alerts"] });
      toast.success(t("alerts.saved", "Alert scadenza aggiornato"));
    } catch (error) {
      toast.error(errorMessage(error, t("alerts.saveError", "Errore salvataggio alert")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pc-card-body space-y-4">
      <div className="rounded-md border p-4" style={{ borderColor: "var(--border)" }}>
        <div className="mb-3 flex items-center gap-2 text-sm font-bold">
          <Tags className="size-4" /> {t("tags.title", "Segmentazione cliente")}
        </div>
        <div className="flex flex-wrap gap-2">
          {allTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              className="rounded-full border px-3 py-1 text-xs font-bold"
              style={{
                borderColor: assignedIds.has(tag.id)
                  ? tag.color || "var(--accent)"
                  : "var(--border)",
                background: assignedIds.has(tag.id) ? "var(--accent2)" : "var(--surface2)",
                color: assignedIds.has(tag.id) ? tag.color || "var(--accent)" : "var(--text3)",
              }}
              disabled={!canEdit || busy}
              onClick={() => void toggleTag(tag)}
            >
              {tag.name}
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            className="pc-input"
            value={newTag}
            disabled={!canEdit || busy}
            placeholder={t("tags.newPlaceholder", "Nuovo tag, es. VIP")}
            onChange={(event) => setNewTag(event.target.value)}
          />
          <button
            className="pc-btn pc-btn-primary pc-btn-sm"
            type="button"
            disabled={!canEdit || busy || !newTag.trim()}
            onClick={() => void addTag()}
          >
            <Plus className="size-3" /> {t("tags.add", "Aggiungi")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-md border p-4" style={{ borderColor: "var(--border)" }}>
          <div className="mb-3 flex items-center gap-2 text-sm font-bold">
            <Clock className="size-4" /> {t("sla.title", "SLA personalizzato")}
          </div>
          {bundle ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label={t("sla.responseHours", "Risposta entro ore")}>
                <input
                  className="pc-input"
                  type="number"
                  min={0}
                  step={0.5}
                  value={responseHours}
                  disabled={!canEdit || busy}
                  onChange={(event) => setResponseHours(event.target.value)}
                />
              </Field>
              <Field label={t("sla.resolutionHours", "Risoluzione entro ore")}>
                <input
                  className="pc-input"
                  type="number"
                  min={0}
                  step={0.5}
                  value={resolutionHours}
                  disabled={!canEdit || busy}
                  onChange={(event) => setResolutionHours(event.target.value)}
                />
              </Field>
              <button
                className="pc-btn pc-btn-primary pc-btn-sm md:col-span-2"
                type="button"
                disabled={!canEdit || busy}
                onClick={() => void saveSla()}
              >
                <Save className="size-3" /> {t("sla.save", "Salva override SLA")}
              </button>
            </div>
          ) : (
            <div className="text-sm text-text3">
              {t("sla.noBundle", "Serve un bundle attivo per configurare uno SLA cliente.")}
            </div>
          )}
        </div>

        <div className="rounded-md border p-4" style={{ borderColor: "var(--border)" }}>
          <div className="mb-3 flex items-center gap-2 text-sm font-bold">
            <Bell className="size-4" /> {t("alerts.title", "Notifica scadenza contratto")}
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label={t("alerts.daysBefore", "Giorni prima")}>
              <input
                className="pc-input"
                type="number"
                min={1}
                value={daysBefore}
                disabled={!canEdit || busy}
                onChange={(event) => setDaysBefore(Number(event.target.value || 30))}
              />
            </Field>
            <Field label={t("alerts.channel", "Canale")}>
              <select
                className="pc-input"
                value={channel}
                disabled={!canEdit || busy}
                onChange={(event) => setChannel(event.target.value as any)}
                aria-label={t("alerts.channelLabel", "Canale notifica")}
              >
                <option value="in_app">{t("alerts.inApp", "In-app")}</option>
                <option value="email">{t("alerts.email", "Email")}</option>
              </select>
            </Field>
            <label className="flex items-center gap-2 text-sm text-text2 md:col-span-2">
              <input
                type="checkbox"
                checked={enabled}
                disabled={!canEdit || busy}
                onChange={(event) => setEnabled(event.target.checked)}
              />
              {t("alerts.enabled", "Alert attivo")}
            </label>
            <button
              className="pc-btn pc-btn-primary pc-btn-sm md:col-span-2"
              type="button"
              disabled={!canEdit || busy}
              onClick={() => void saveAlert()}
            >
              <Save className="size-3" /> {t("alerts.save", "Salva alert")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
