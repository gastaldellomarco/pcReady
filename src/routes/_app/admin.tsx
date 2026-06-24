import { createFileRoute } from "@tanstack/react-router";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import i18n from "@/i18n";

export const Route = createFileRoute("/_app/admin")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
    // Audit filters
    auditActionType:
      typeof search.auditActionType === "string" ? search.auditActionType : undefined,
    auditUser: typeof search.auditUser === "string" ? search.auditUser : undefined,
    auditEntityType:
      typeof search.auditEntityType === "string" ? search.auditEntityType : undefined,
    auditOutcome: typeof search.auditOutcome === "string" ? search.auditOutcome : undefined,
    auditDateFrom: typeof search.auditDateFrom === "string" ? search.auditDateFrom : undefined,
    auditDateTo: typeof search.auditDateTo === "string" ? search.auditDateTo : undefined,
    auditSearch: typeof search.auditSearch === "string" ? search.auditSearch : undefined,
    auditPage: typeof search.auditPage === "string" ? Number(search.auditPage) : undefined,
    auditPreset: typeof search.auditPreset === "string" ? search.auditPreset : undefined,
    highlight: typeof search.highlight === "string" ? search.highlight : undefined,
  }),
  head: () => ({
    meta: [
      { title: i18n.t("admin:meta.title", "Admin Utenti - PCReady") },
      {
        name: "description",
        content: i18n.t("admin:meta.description", "Gestione utenti, ruoli e stato account."),
      },
    ],
  }),
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => <LoadingSkeleton />,
});
