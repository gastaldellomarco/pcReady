import { GitBranch, Link2, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { StatusBadge } from "@/components/pcready/StatusBadge";
import { useAuth } from "@/lib/auth-context";
import { openTicketDetail } from "@/lib/detail-navigation";
import {
  RELATION_LABELS,
  searchTicketsForRelation,
  type RelatedTicketLite,
  type TicketRelation,
  type TicketRelationType,
  useCreateTicketRelation,
  useDeleteTicketRelation,
  useTicketRelations,
} from "@/lib/queries/ticketRelations";
import type { TicketStatus } from "@/lib/pcready";

/**
 *
 */
export function TicketRelations({ ticketId }: { ticketId: string }) {
  const { t } = useTranslation("tickets");
  const { user, canEdit } = useAuth();
  const relationsQuery = useTicketRelations(ticketId);
  const createMut = useCreateTicketRelation(ticketId);
  const deleteMut = useDeleteTicketRelation(ticketId);
  const [relationType, setRelationType] = useState<TicketRelationType>("blocked_by");
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<RelatedTicketLite[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!search.trim()) {
      setOptions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    searchTicketsForRelation(search, ticketId)
      .then((rows) => {
        if (!cancelled) setOptions(rows);
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [search, ticketId]);

  async function addRelation(targetTicketId: string) {
    if (!user || !canEdit) return toast.error(t("toasts.insufficientPermissions", "Permessi insufficienti"));
    try {
      await createMut.mutateAsync({ targetTicketId, relationType, createdBy: user.id });
      setSearch("");
      setOptions([]);
      toast.success(t("relations.addSuccess", "Ticket collegato"));
    } catch (err: any) {
      toast.error(err?.message || t("relations.addError", "Errore collegamento ticket"));
    }
  }

  async function removeRelation(id: string) {
    if (!canEdit) return;
    try {
      await deleteMut.mutateAsync(id);
      toast.success(t("relations.removeSuccess", "Collegamento rimosso"));
    } catch (err: any) {
      toast.error(err?.message || t("relations.removeError", "Errore rimozione collegamento"));
    }
  }

  function relatedTicket(relation: TicketRelation) {
    return relation.source_ticket_id === ticketId ? relation.target : relation.source;
  }

  function relationLabel(relation: TicketRelation) {
    if (relation.source_ticket_id === ticketId) return RELATION_LABELS[relation.relation_type];
    if (relation.relation_type === "blocked_by") return t("relations.labelBlockedBy", "Blocca");
    if (relation.relation_type === "duplicate_of") return t("relations.labelDuplicateOf", "Ticket duplicato da");
    return t("relations.labelParentOf", "Ticket padre di");
  }

  const relations = (relationsQuery.data ?? []) as TicketRelation[];

  return (
    <section className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-[13px] font-bold">
            <GitBranch className="size-4 text-text3" /> {t("relations.title", "Ticket collegati")}
          </h3>
          <p className="text-[11px] text-text3">{t("relations.description", "Dipendenze, duplicati e subtask.")}</p>
        </div>
        <span className="rounded-full px-2 py-0.5 text-[11px] font-mono text-text3" style={{ background: "var(--surface2)" }}>
          {relations.length}
        </span>
      </div>

      {canEdit && (
        <div className="mb-3 grid gap-2 md:grid-cols-[180px_1fr]">
          <select className="pc-input" value={relationType} onChange={(event) => setRelationType(event.target.value as TicketRelationType)}>
            {Object.entries(RELATION_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text3" />
            <input className="pc-input w-full pl-8" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("relations.searchPlaceholder", "Cerca ticket per codice, titolo o cliente...")} />
            {search && (
              <div className="absolute left-0 right-0 z-20 mt-1 max-h-56 overflow-y-auto rounded-md border bg-background shadow-lg" style={{ borderColor: "var(--border)" }}>
                {loading && <div className="p-3 text-[12px] text-text3">{t("relations.searchLoading", "Ricerca...")}</div>}
                {!loading && options.length === 0 && <div className="p-3 text-[12px] text-text3">{t("relations.searchEmpty", "Nessun ticket trovato")}</div>}
                {options.map((ticket) => (
                  <button key={ticket.id} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[12px] hover:bg-surface2" onClick={() => addRelation(ticket.id)}>
                    <span className="min-w-0">
                      <span className="font-mono font-semibold text-accent">{ticket.ticket_code}</span>{" "}
                      <span className="font-semibold">{ticket.model || "Ticket"}</span>
                      <span className="ml-2 text-text3">{ticket.client}</span>
                    </span>
                    <Link2 className="size-3" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {relationsQuery.isLoading && <div className="text-[12px] text-text3">{t("relations.loadingText", "Caricamento collegamenti...")}</div>}
      {!relationsQuery.isLoading && relations.length === 0 && <div className="text-[12px] text-text3">{t("relations.emptyText", "Nessun ticket collegato")}</div>}
      <div className="space-y-2">
        {relations.map((relation) => {
          const ticket = relatedTicket(relation);
          if (!ticket) return null;
          return (
            <div key={relation.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5" style={{ borderColor: "var(--border)" }}>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "var(--surface2)" }}>{relationLabel(relation)}</span>
              <button className="font-mono text-[12px] font-semibold text-accent hover:underline" onClick={() => openTicketDetail(ticket.id)}>{ticket.ticket_code}</button>
              <span className="min-w-0 flex-1 truncate text-[12px] font-semibold">{ticket.model || "Ticket"}</span>
              <StatusBadge status={ticket.status as TicketStatus} />
              {canEdit && (
                <button className="pc-btn pc-btn-ghost pc-btn-sm text-red-600" onClick={() => removeRelation(relation.id)}>
                  <Trash2 className="size-3" /> {t("relations.remove", "Rimuovi")}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
