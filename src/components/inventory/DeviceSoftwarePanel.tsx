import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { fmtDate } from "@/lib/pcready";
import {
  useDeviceSoftware,
  useSoftwareCatalog,
  useUpsertDeviceSoftware,
  useDeleteDeviceSoftware,
  useUpsertSoftwareCatalog,
  useDeleteSoftwareCatalog,
  type DeviceSoftware,
  type SoftwareCatalogEntry,
} from "@/lib/queries/device-software";

/**
 * Compare two version strings numerically.
 * Returns -1 if a < b, 0 if equal, 1 if a > b.
 */
function compareVersions(a: string, b: string): number {
  const parse = (v: string) => v.split(".").map((n) => parseInt(n, 10) || 0);
  const aParts = parse(a);
  const bParts = parse(b);
  const maxLen = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < maxLen; i++) {
    const aVal = aParts[i] ?? 0;
    const bVal = bParts[i] ?? 0;
    if (aVal < bVal) return -1;
    if (aVal > bVal) return 1;
  }
  return 0;
}

function isObsolete(installed: string, latest: string | null | undefined): boolean {
  if (!latest) return false;
  return compareVersions(installed, latest) < 0;
}

/**
 * Panel for managing device software inventory.
 * Used as a tab in DeviceDetailModal.
 */
export function DeviceSoftwarePanel({
  deviceId,
  canEdit,
}: {
  deviceId: string;
  canEdit: boolean;
}) {
  const { t } = useTranslation("tickets");

  const softwareQuery = useDeviceSoftware(deviceId);
  const catalogQuery = useSoftwareCatalog();

  const software = useMemo(() => (softwareQuery.data ?? []) as DeviceSoftware[], [softwareQuery.data]);
  const catalog = useMemo(
    () => (catalogQuery.data ?? []) as SoftwareCatalogEntry[],
    [catalogQuery.data],
  );

  const upsertMut = useUpsertDeviceSoftware(deviceId);
  const deleteMut = useDeleteDeviceSoftware(deviceId);
  const upsertCatalogMut = useUpsertSoftwareCatalog();
  const deleteCatalogMut = useDeleteSoftwareCatalog();

  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [showCatalogManager, setShowCatalogManager] = useState(false);
  const [addBusy, setAddBusy] = useState(false);

  // Add form state
  const [addName, setAddName] = useState("");
  const [addVersion, setAddVersion] = useState("");
  const [addPublisher, setAddPublisher] = useState("");
  const [addInstallDate, setAddInstallDate] = useState("");

  // Catalog form state
  const [catalogName, setCatalogName] = useState("");
  const [catalogVersion, setCatalogVersion] = useState("");
  const [catalogPublisher, setCatalogPublisher] = useState("");
  const [catalogCategory, setCatalogCategory] = useState("");
  const [catalogBusy, setCatalogBusy] = useState(false);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return software;
    const q = searchTerm.toLowerCase();
    return software.filter(
      (s) =>
        s.software_name.toLowerCase().includes(q) ||
        (s.publisher ?? "").toLowerCase().includes(q) ||
        s.version.toLowerCase().includes(q),
    );
  }, [software, searchTerm]);

  const obsoleteCount = software.filter((s) => isObsolete(s.version, s.latest_version)).length;

  async function handleAdd() {
    if (!addName.trim()) {
      toast.error(t("device.software.emptyName", "Inserisci il nome del software"));
      return;
    }
    setAddBusy(true);
    try {
      await upsertMut.mutateAsync({
        softwareName: addName.trim(),
        version: addVersion.trim() || undefined,
        publisher: addPublisher.trim() || undefined,
        installDate: addInstallDate || undefined,
      });
      setAddName("");
      setAddVersion("");
      setAddPublisher("");
      setAddInstallDate("");
      setShowAddForm(false);
      toast.success(t("device.software.addSuccess", "Software aggiunto"));
    } catch (err: any) {
      toast.error(
        err?.message || t("device.software.addError", "Errore nell'aggiunta del software"),
      );
    } finally {
      setAddBusy(false);
    }
  }

  async function handleDelete(sw: DeviceSoftware) {
    try {
      await deleteMut.mutateAsync(sw.id);
      toast.success(t("device.software.deleteSuccess", "Software rimosso"));
    } catch (err: any) {
      toast.error(
        err?.message || t("device.software.deleteError", "Errore nella rimozione del software"),
      );
    }
  }

  async function handleAddToCatalog(sw: DeviceSoftware) {
    try {
      await upsertCatalogMut.mutateAsync({
        name: sw.software_name,
        latestVersion: sw.version,
        publisher: sw.publisher ?? undefined,
      });
      toast.success(t("device.software.catalogAddSuccess", "Versione aggiornata nel catalogo"));
    } catch (err: any) {
      toast.error(
        err?.message || t("device.software.catalogAddError", "Errore aggiornamento catalogo"),
      );
    }
  }

  async function handleCatalogUpsert() {
    if (!catalogName.trim() || !catalogVersion.trim()) {
      toast.error(
        t("device.software.catalogFieldsRequired", "Nome e versione sono obbligatori"),
      );
      return;
    }
    setCatalogBusy(true);
    try {
      await upsertCatalogMut.mutateAsync({
        name: catalogName.trim(),
        latestVersion: catalogVersion.trim(),
        publisher: catalogPublisher.trim() || undefined,
        category: catalogCategory.trim() || undefined,
      });
      setCatalogName("");
      setCatalogVersion("");
      setCatalogPublisher("");
      setCatalogCategory("");
      toast.success(t("device.software.catalogSaved", "Catalogo aggiornato"));
    } catch (err: any) {
      toast.error(
        err?.message || t("device.software.catalogSaveError", "Errore salvataggio catalogo"),
      );
    } finally {
      setCatalogBusy(false);
    }
  }

  async function handleCatalogDelete(entry: SoftwareCatalogEntry) {
    try {
      await deleteCatalogMut.mutateAsync(entry.id);
      toast.success(t("device.software.catalogDeleteSuccess", "Voce catalogo rimossa"));
    } catch (err: any) {
      toast.error(
        err?.message || t("device.software.catalogDeleteError", "Errore rimozione catalogo"),
      );
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header with stats */}
      <div
        className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
        style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
      >
        <div className="flex-1">
          <div className="text-sm font-semibold">
            {t("device.software.title", "Software installato")}
          </div>
          <div className="text-[11px] text-text3 flex flex-wrap gap-x-3 gap-y-1 mt-0.5">
            <span>
              {t("device.software.totalCount", {
                count: software.length,
                defaultValue: "{{count}} software rilevati",
              })}
            </span>
            {obsoleteCount > 0 && (
              <span className="font-semibold" style={{ color: "var(--warning)" }}>
                {t("device.software.obsoleteCount", {
                  count: obsoleteCount,
                  defaultValue: "{{count}} obsoleti",
                })}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            className="pc-btn pc-btn-ghost pc-btn-sm"
            onClick={() => void softwareQuery.refetch()}
            disabled={softwareQuery.isFetching}
          >
            <RefreshCw
              className={`size-3 ${softwareQuery.isFetching ? "animate-spin" : ""}`}
            />{" "}
            {t("device.software.refresh", "Aggiorna")}
          </button>
          {canEdit && (
            <>
              <button
                className="pc-btn pc-btn-ghost pc-btn-sm"
                onClick={() => setShowCatalogManager(!showCatalogManager)}
              >
                {t("device.software.manageCatalog", "Catalogo")}
              </button>
              <button
                className="pc-btn pc-btn-primary pc-btn-sm"
                onClick={() => setShowAddForm(true)}
              >
                <Plus className="size-3" />{" "}
                {t("device.software.addSoftware", "Aggiungi")}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search bar */}
      {software.length > 5 && (
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-text3" />
          <input
            className="pc-input w-full pl-8 text-[13px]"
            placeholder={t("device.software.searchPlaceholder", "Cerca software...")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      )}

      {/* Add form */}
      {showAddForm && (
        <div
          className="rounded-lg border p-3"
          style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
        >
          <div className="text-xs font-semibold mb-2">
            {t("device.software.addTitle", "Aggiungi software")}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs">
              <span className="pc-label">{t("device.software.name", "Nome software")}</span>
              <input
                className="pc-input mt-1 w-full"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder={t("device.software.namePlaceholder", "Es. Google Chrome")}
              />
            </label>
            <label className="text-xs">
              <span className="pc-label">{t("device.software.version", "Versione")}</span>
              <input
                className="pc-input mt-1 w-full"
                value={addVersion}
                onChange={(e) => setAddVersion(e.target.value)}
                placeholder="123.0.6312.107"
              />
            </label>
            <label className="text-xs">
              <span className="pc-label">{t("device.software.publisher", "Produttore")}</span>
              <input
                className="pc-input mt-1 w-full"
                value={addPublisher}
                onChange={(e) => setAddPublisher(e.target.value)}
                placeholder={t("device.software.publisherPlaceholder", "Es. Google LLC")}
              />
            </label>
            <label className="text-xs">
              <span className="pc-label">{t("device.software.installDate", "Data installazione")}</span>
              <input
                className="pc-input mt-1 w-full"
                type="date"
                value={addInstallDate}
                onChange={(e) => setAddInstallDate(e.target.value)}
              />
            </label>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              className="pc-btn pc-btn-primary pc-btn-sm"
              disabled={addBusy}
              onClick={() => void handleAdd()}
            >
              {addBusy
                ? t("device.software.saving", "Salvataggio...")
                : t("device.software.save", "Salva software")}
            </button>
            <button
              className="pc-btn pc-btn-ghost pc-btn-sm"
              onClick={() => setShowAddForm(false)}
            >
              {t("device.software.cancel", "Annulla")}
            </button>
          </div>
        </div>
      )}

      {/* Catalog Manager */}
      {showCatalogManager && (
        <div
          className="rounded-lg border p-3"
          style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs font-semibold">
              {t("device.software.catalogTitle", "Catalogo versioni software")}
            </div>
            <button
              className="pc-btn-icon"
              onClick={() => setShowCatalogManager(false)}
            >
              <span className="text-text3 text-xs">✕</span>
            </button>
          </div>

          {/* Add to catalog form */}
          <div className="grid gap-2 sm:grid-cols-2 mb-3">
            <input
              className="pc-input text-xs"
              placeholder={t("device.software.name", "Nome software")}
              value={catalogName}
              onChange={(e) => setCatalogName(e.target.value)}
            />
            <input
              className="pc-input text-xs"
              placeholder={t("device.software.version", "Ultima versione")}
              value={catalogVersion}
              onChange={(e) => setCatalogVersion(e.target.value)}
            />
            <input
              className="pc-input text-xs"
              placeholder={t("device.software.publisher", "Produttore")}
              value={catalogPublisher}
              onChange={(e) => setCatalogPublisher(e.target.value)}
            />
            <input
              className="pc-input text-xs"
              placeholder={t("device.software.category", "Categoria")}
              value={catalogCategory}
              onChange={(e) => setCatalogCategory(e.target.value)}
            />
          </div>
          <button
            className="pc-btn pc-btn-primary pc-btn-sm"
            disabled={catalogBusy}
            onClick={() => void handleCatalogUpsert()}
          >
            <Plus className="size-3" />{" "}
            {catalogBusy
              ? t("device.software.saving", "Salvataggio...")
              : t("device.software.catalogAddEntry", "Aggiungi al catalogo")}
          </button>

          {/* Catalog entries list */}
          {catalog.length > 0 && (
            <div className="mt-3 flex flex-col gap-1.5 max-h-[200px] overflow-y-auto">
              {catalog.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-2 rounded-md border bg-background p-2 text-xs"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{entry.name}</div>
                    <div className="text-text3">
                      v{entry.latest_version}
                      {entry.publisher ? ` · ${entry.publisher}` : ""}
                      {entry.category ? ` · ${entry.category}` : ""}
                    </div>
                  </div>
                  {canEdit && (
                    <button
                      className="pc-btn pc-btn-ghost pc-btn-sm text-destructive shrink-0"
                      onClick={() => void handleCatalogDelete(entry)}
                    >
                      <Trash2 className="size-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Software table */}
      {filtered.length > 0 ? (
        <div
          className="rounded-lg border overflow-hidden"
          style={{ borderColor: "var(--border)" }}
        >
          <table className="w-full text-[12px]">
            <thead>
              <tr style={{ background: "var(--surface2)" }}>
                <th
                  className="border-b px-3 py-2 text-left text-[10px] font-bold uppercase text-text3"
                  style={{ borderColor: "var(--border)" }}
                >
                  {t("device.software.name", "Software")}
                </th>
                <th
                  className="border-b px-3 py-2 text-left text-[10px] font-bold uppercase text-text3"
                  style={{ borderColor: "var(--border)" }}
                >
                  {t("device.software.version", "Versione")}
                </th>
                <th
                  className="border-b px-3 py-2 text-left text-[10px] font-bold uppercase text-text3 hidden sm:table-cell"
                  style={{ borderColor: "var(--border)" }}
                >
                  {t("device.software.publisher", "Produttore")}
                </th>
                <th
                  className="border-b px-3 py-2 text-left text-[10px] font-bold uppercase text-text3 hidden md:table-cell"
                  style={{ borderColor: "var(--border)" }}
                >
                  {t("device.software.installDate", "Installato")}
                </th>
                <th
                  className="border-b px-3 py-2 text-left text-[10px] font-bold uppercase text-text3"
                  style={{ borderColor: "var(--border)" }}
                >
                  {t("device.software.status", "Stato")}
                </th>
                {canEdit && (
                  <th
                    className="border-b px-3 py-2 text-right text-[10px] font-bold uppercase text-text3 w-10"
                    style={{ borderColor: "var(--border)" }}
                  >
                    &nbsp;
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((sw) => {
                const obsolete = isObsolete(sw.version, sw.latest_version);
                return (
                  <tr
                    key={sw.id}
                    className="border-b hover:bg-background/60"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <td className="px-3 py-2.5">
                      <div className="font-semibold">{sw.software_name}</div>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[11px]">
                      <span>{sw.version}</span>
                      {obsolete && sw.latest_version && (
                        <span className="text-text3 ml-1">
                          → {sw.latest_version}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-text2 hidden sm:table-cell">
                      {sw.publisher || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-text2 hidden md:table-cell">
                      {sw.install_date ? fmtDate(sw.install_date) : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      {obsolete ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                          style={{
                            color: "var(--warning)",
                            background: "var(--warning-light, #fef3c7)",
                            borderColor: "var(--warning)",
                          }}
                        >
                          <AlertTriangle className="size-2.5" />
                          {t("device.software.obsolete", "Obsoleto")}
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-semibold"
                          style={{ color: "var(--success)" }}
                        >
                          <CheckCircle2 className="size-2.5" />
                          {t("device.software.updated", "Aggiornato")}
                        </span>
                      )}
                    </td>
                    {canEdit && (
                      <td className="px-2 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {sw.latest_version && sw.version !== sw.latest_version && (
                            <button
                              className="pc-btn pc-btn-ghost pc-btn-sm"
                              title={t(
                                "device.software.markAsLatest",
                                "Segna questa versione come ultima disponibile",
                              )}
                              onClick={() => void handleAddToCatalog(sw)}
                            >
                              <ExternalLink className="size-3" />
                            </button>
                          )}
                          <button
                            className="pc-btn pc-btn-ghost pc-btn-sm text-destructive"
                            onClick={() => void handleDelete(sw)}
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="py-8 text-center text-text3 text-[13px]">
          {softwareQuery.isLoading
            ? t("device.software.loading", "Caricamento software...")
            : searchTerm
              ? t("device.software.noSearchResults", "Nessun software corrisponde alla ricerca")
              : t("device.software.empty", "Nessun software registrato per questo dispositivo")}
        </div>
      )}
    </div>
  );
}
