import { CheckCircle2, Trash2 } from "lucide-react";
import type { TFunction } from "i18next";
import type { MaintenanceSchedule } from "@/lib/maintenance";

export type MaintenanceScheduleRowActionsProps = {
  /**
   * Output gate: enables the "Segna completata" mark-done action.
   * Independent from `isAdmin` — typically driven by `useAuth().canEdit`
   * or a `canEdit` panel prop.
   */
  canEdit: boolean;
  /**
   * Destructive gate: enables the Trash2 button + the
   * `DestructiveConfirmDialog` confirmation flow in the parent panel.
   * Independent from `canEdit`. The component is purely a renderer —
   * server-side RLS is the source of truth; the UI gate is a UX
   * safeguard.
   */
  isAdmin: boolean;
  /**
   * Id of the schedule currently being marked completed by the
   * parent. When this matches `schedule.id`, the mark-done button is
   * disabled and shows "Aggiornamento…". `null` means no row is busy.
   */
  completingId: string | null;
  /** The schedule this row represents. */
  schedule: MaintenanceSchedule;
  /** i18n translator. Passed down from the parent page; not pulled from `useTranslation` here. */
  t: TFunction;
  /** Fires when the user clicks "Segna completata". Parent handles the mutation. */
  onMarkCompleted: (schedule: MaintenanceSchedule) => void;
  /** Fires when the user clicks the destructive Trash2 button. Parent opens the confirm dialog. */
  onRequestDelete: (schedule: MaintenanceSchedule) => void;
};

/**
 * Per-row "Azioni" cell extracted from `MaintenanceSchedulePanel`.
 *
 * Permission model — do NOT conflate:
 * - `canEdit` gates the "Segna completata" mark-done button.
 * - `isAdmin` gates the destructive Trash2 + (parent) `DestructiveConfirmDialog` flow.
 *
 * When both gates are false the component renders a `<span>—</span>`
 * placeholder so the column stays aligned with neighbouring tables.
 *
 * The component is purely a renderer. Click handlers bubble to the
 * parent panel; server-side RLS in `useDeleteMaintenanceSchedule` is
 * the source of truth for destructive authorisation — UI gates exist
 * to fail fast, never to bypass the backend.
 */
export function MaintenanceScheduleRowActions({
  canEdit,
  isAdmin,
  completingId,
  schedule,
  t,
  onMarkCompleted,
  onRequestDelete,
}: MaintenanceScheduleRowActionsProps) {
  if (!canEdit && !isAdmin) {
    return <span>—</span>;
  }
  const isCompleting = completingId === schedule.id;
  return (
    <div className="flex items-center gap-1">
      {canEdit ? (
        <button
          className="pc-btn pc-btn-ghost pc-btn-sm"
          disabled={isCompleting}
          onClick={() => onMarkCompleted(schedule)}
        >
          <CheckCircle2 className="size-3" />
          {isCompleting
            ? t("maintenance.updating", "Aggiornamento...")
            : t("maintenance.markCompleted", "Segna completata")}
        </button>
      ) : null}
      {isAdmin ? (
        <button
          type="button"
          aria-label={t(
            "maintenance.deleteAriaLabel",
            "Elimina manutenzione {{title}}",
            { title: schedule.title },
          )}
          title={t("maintenance.deleteTitle", "Elimina manutenzione")}
          className="pc-btn pc-btn-ghost pc-btn-sm text-destructive hover:bg-destructive/10"
          onClick={() => onRequestDelete(schedule)}
        >
          <Trash2 className="size-3" />
        </button>
      ) : null}
    </div>
  );
}
