import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { type KanbanColumnColors, type WipLimits } from "@/lib/app-settings";
import { KANBAN_STATUSES } from "@/lib/kanban/constants";
import { STATUS_META } from "@/lib/pcready";

/** Strips alpha channel from a hex color string (returns the 6-char hex prefix) */
function normalizeColor(value: string) {
  const match = value.match(/^#[0-9a-fA-F]{6}/);
  return match ? match[0] : "#ffffff";
}

/**
 *
 */
export interface WipConfigDialogProps {
  open: boolean;
  wipDraft: WipLimits;
  colorDraft: KanbanColumnColors;
  saving: boolean;
  onClose: () => void;
  onWipDraftChange: React.Dispatch<React.SetStateAction<WipLimits>>;
  onColorDraftChange: React.Dispatch<React.SetStateAction<KanbanColumnColors>>;
  onSave: () => void;
  onReset: () => void;
}

/**
 *
 */
export function WipConfigDialog({
  open,
  wipDraft,
  colorDraft,
  saving,
  onClose,
  onWipDraftChange,
  onColorDraftChange,
  onSave,
  onReset,
}: WipConfigDialogProps) {
  const { t } = useTranslation(["kanban", "tickets"]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[600] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl border bg-surface p-5 shadow-lg"
        style={{ borderColor: "var(--border)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-bold">{t("wipConfig.title", "Configura Kanban")}</h3>
            <p className="text-[12px] text-text3">
              {t("wipConfig.desc", "Limiti WIP e colori sfondo colonne. 0 = nessun limite.")}
            </p>
          </div>
          <button className="pc-btn-icon touch-target" onClick={onClose}>
            <X className="h-3 w-3" />
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {KANBAN_STATUSES.map((status) => (
            <div
              key={status}
              className="rounded-lg border p-3"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="mb-2 flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: STATUS_META[status].color }}
                />
                <span className="text-[12px] font-bold uppercase tracking-wide">
                  {t("tickets:status." + status, STATUS_META[status].label)}
                </span>
              </div>
              <label className="mb-2 block text-[11px] font-semibold text-text2">
                {t("wipConfig.wipLimitLabel", "Limite WIP")}
                <input
                  type="number"
                  min={0}
                  max={999}
                  className="pc-input mt-1 w-full"
                  value={wipDraft[status] ?? 0}
                  onChange={(event) =>
                    onWipDraftChange((current) => ({
                      ...current,
                      [status]: Number(event.target.value || 0),
                    }))
                  }
                />
              </label>
              <label className="block text-[11px] font-semibold text-text2">
                {t("wipConfig.bgColorLabel", "Colore sfondo")}
                <div className="mt-1 flex gap-2">
                  <input
                    type="color"
                    className="h-9 w-12 rounded border border-border bg-transparent"
                    value={normalizeColor(colorDraft[status] || STATUS_META[status].color)}
                    onChange={(event) =>
                      onColorDraftChange((current) => ({
                        ...current,
                        [status]: `${event.target.value}18`,
                      }))
                    }
                  />
                  <input
                    className="pc-input flex-1"
                    value={colorDraft[status] || ""}
                    onChange={(event) =>
                      onColorDraftChange((current) => ({ ...current, [status]: event.target.value }))
                    }
                    placeholder="#1B4FD818"
                  />
                </div>
              </label>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" className="pc-btn pc-btn-ghost" onClick={onReset}>
            {t("wipConfig.reset", "Reset default")}
          </button>
          <button type="button" className="pc-btn pc-btn-ghost" onClick={onClose}>
            {t("wipConfig.cancel", "Annulla")}
          </button>
          <button
            type="button"
            className="pc-btn pc-btn-primary"
            disabled={saving}
            onClick={onSave}
          >
            {saving ? t("wipConfig.saving", "Salvataggio...") : t("wipConfig.save", "Salva")}
          </button>
        </div>
      </div>
    </div>
  );
}
