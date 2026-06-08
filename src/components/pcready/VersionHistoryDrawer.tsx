import { Clock, User, FileText, RotateCcw, Eye, GitCompare } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getVersions, Version, restoreVersion } from "@/lib/versioning";
import { RestoreVersionDialog } from "./RestoreVersionDialog";
import { VersionDiffViewer } from "./VersionDiffViewer";

interface VersionHistoryDrawerProps {
  entityType: string;
  entityId: string;
  open: boolean;
  onClose: () => void;
  onRestored?: () => void;
}

/**
 *
 */
export function VersionHistoryDrawer({
  entityType,
  entityId,
  open,
  onClose,
  onRestored,
}: VersionHistoryDrawerProps) {
  const { t } = useTranslation("checklist");
  const { profile } = useAuth();
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVersions, setSelectedVersions] = useState<Version[]>([]);
  const [viewingVersion, setViewingVersion] = useState<Version | null>(null);
  const [restoringVersion, setRestoringVersion] = useState<Version | null>(null);
  const [authors, setAuthors] = useState<Record<string, string>>({});

  const formatAuthor = useCallback(
    (authorId: string | null) => {
      if (!authorId) return t("versionHistory.system", "Sistema");
      return authors[authorId] || authorId;
    },
    [authors, t],
  );

  const loadVersions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getVersions(entityType, entityId);
      setVersions(data);
      const userIds = Array.from(
        new Set(data.map((version) => version.created_by).filter(Boolean)),
      ) as string[];
      if (userIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);
        setAuthors(
          Object.fromEntries(
            (profiles ?? []).map((profile) => [profile.id, profile.full_name || profile.id]),
          ),
        );
      } else {
        setAuthors({});
      }
    } catch (error) {
      console.error("Error loading versions:", error);
      toast.error(t("versionHistory.loadError", "Errore caricamento versioni"));
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType, t]);

  useEffect(() => {
    if (open && entityId) {
      loadVersions();
    }
  }, [open, entityId, loadVersions]);

  function toggleVersionSelection(version: Version) {
    setSelectedVersions((prev) => {
      if (prev.find((v) => v.id === version.id)) {
        return prev.filter((v) => v.id !== version.id);
      } else if (prev.length < 2) {
        return [...prev, version];
      }
      return prev;
    });
  }

  function handleRestore(version: Version) {
    if (profile?.role !== "admin") {
      toast.error(
        t("versionHistory.adminOnly", "Solo gli amministratori possono ripristinare versioni"),
      );
      return;
    }
    setRestoringVersion(version);
  }

  async function confirmRestore(note?: string) {
    if (!restoringVersion) return;
    try {
      await restoreVersion(entityType, entityId, restoringVersion, note);
      toast.success(t("versionHistory.restoreSuccess", "Versione ripristinata"));
      onClose();
      onRestored?.();
    } catch (_error) {
      toast.error(t("versionHistory.restoreError", "Errore ripristino versione"));
    } finally {
      setRestoringVersion(null);
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent side="right" className="w-[600px] sm:w-[600px]">
          <SheetHeader>
            <SheetTitle>{t("versionHistory.title", "Storico Versioni")}</SheetTitle>
          </SheetHeader>

          <div className="flex flex-col gap-4 mt-4">
            {selectedVersions.length === 2 && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewingVersion(selectedVersions[0])}
                  className="flex-1"
                >
                  <GitCompare className="size-4 mr-2" />
                  {t("versionHistory.compareVersions", "Confronta Versioni")}
                </Button>
              </div>
            )}

            <div className="space-y-3 max-h-[70vh] overflow-y-auto">
              {loading ? (
                <div className="text-center py-8">
                  {t("versionHistory.loading", "Caricamento...")}
                </div>
              ) : versions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {t("versionHistory.noVersions", "Nessuna versione trovata")}
                </div>
              ) : (
                versions.map((version) => (
                  <div key={version.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">v{version.version_number}</Badge>
                        <Badge
                          variant={
                            version.operation === "create"
                              ? "default"
                              : version.operation === "update"
                                ? "secondary"
                                : version.operation === "restore"
                                  ? "destructive"
                                  : "outline"
                          }
                        >
                          {version.operation}
                        </Badge>
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedVersions.some((v) => v.id === version.id)}
                        onChange={() => toggleVersionSelection(version)}
                        className="rounded"
                        aria-label={t("versionHistory.selectVersion", "Seleziona versione {{n}}", {
                          n: version.version_number,
                        })}
                      />
                    </div>

                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="size-3" />
                        <span>{formatAuthor(version.created_by)}</span>
                        <Clock className="size-3 ml-2" />
                        <span>{new Date(version.created_at).toLocaleString()}</span>
                      </div>
                      {version.change_note && (
                        <div className="flex items-start gap-2">
                          <FileText className="size-3 mt-0.5 text-muted-foreground" />
                          <span className="text-sm">{version.change_note}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setViewingVersion(version)}
                      >
                        <Eye className="size-4 mr-2" />
                        {t("versionHistory.view", "Visualizza")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestore(version)}
                        disabled={profile?.role !== "admin"}
                      >
                        <RotateCcw className="size-4 mr-2" />
                        {t("versionHistory.restore", "Ripristina")}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {viewingVersion && selectedVersions.length === 2 && (
        <VersionDiffViewer
          version1={selectedVersions[0]}
          version2={selectedVersions[1]}
          authorNames={authors}
          open={!!viewingVersion}
          onClose={() => setViewingVersion(null)}
        />
      )}

      {viewingVersion && selectedVersions.length !== 2 && (
        <VersionDiffViewer
          version1={viewingVersion}
          version2={null}
          authorNames={authors}
          open={!!viewingVersion}
          onClose={() => setViewingVersion(null)}
        />
      )}

      {restoringVersion && (
        <RestoreVersionDialog
          version={restoringVersion}
          open={!!restoringVersion}
          onClose={() => setRestoringVersion(null)}
          onConfirm={confirmRestore}
        />
      )}
    </>
  );
}
