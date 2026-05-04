import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, User, FileText, RotateCcw, Eye, GitCompare } from "lucide-react";
import { getVersions, Version, restoreVersion } from "@/lib/versioning";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { VersionDiffViewer } from "./VersionDiffViewer";
import { RestoreVersionDialog } from "./RestoreVersionDialog";

interface VersionHistoryDrawerProps {
  entityType: string;
  entityId: string;
  open: boolean;
  onClose: () => void;
}

export function VersionHistoryDrawer({ entityType, entityId, open, onClose }: VersionHistoryDrawerProps) {
  const { profile } = useAuth();
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVersions, setSelectedVersions] = useState<Version[]>([]);
  const [viewingVersion, setViewingVersion] = useState<Version | null>(null);
  const [restoringVersion, setRestoringVersion] = useState<Version | null>(null);

  useEffect(() => {
    if (open && entityId) {
      console.log("Loading versions for:", entityType, entityId);
      loadVersions();
    }
  }, [open, entityId]);

  async function loadVersions() {
    setLoading(true);
    try {
      const data = await getVersions(entityType, entityId);
      console.log("Loaded versions:", data);
      setVersions(data);
    } catch (error) {
      console.error("Error loading versions:", error);
      toast.error("Errore caricamento versioni");
    } finally {
      setLoading(false);
    }
  }

  function toggleVersionSelection(version: Version) {
    setSelectedVersions(prev => {
      if (prev.find(v => v.id === version.id)) {
        return prev.filter(v => v.id !== version.id);
      } else if (prev.length < 2) {
        return [...prev, version];
      }
      return prev;
    });
  }

  function handleRestore(version: Version) {
    if (profile?.role !== "admin") {
      toast.error("Solo gli amministratori possono ripristinare versioni");
      return;
    }
    setRestoringVersion(version);
  }

  async function confirmRestore(note?: string) {
    if (!restoringVersion) return;
    try {
      await restoreVersion(entityType, entityId, restoringVersion, note);
      toast.success("Versione ripristinata");
      onClose();
      // Refresh parent data
      window.location.reload(); // Simple refresh, could be improved
    } catch (error) {
      toast.error("Errore ripristino versione");
    } finally {
      setRestoringVersion(null);
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent side="right" className="w-[600px] sm:w-[600px]">
          <SheetHeader>
            <SheetTitle>Storico Versioni</SheetTitle>
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
                  <Eye className="w-4 h-4 mr-2" />
                  Confronta Versioni
                </Button>
              </div>
            )}

            <div className="space-y-3 max-h-[70vh] overflow-y-auto">
              {loading ? (
                <div className="text-center py-8">Caricamento...</div>
              ) : versions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nessuna versione trovata
                </div>
              ) : (
                versions.map((version) => (
                  <div
                    key={version.id}
                    className="border rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">v{version.version_number}</Badge>
                        <Badge
                          variant={
                            version.operation === "create" ? "default" :
                            version.operation === "update" ? "secondary" :
                            version.operation === "restore" ? "destructive" : "outline"
                          }
                        >
                          {version.operation}
                        </Badge>
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedVersions.some(v => v.id === version.id)}
                        onChange={() => toggleVersionSelection(version)}
                        className="rounded"
                      />
                    </div>

                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="w-3 h-3" />
                        <span>{version.created_by || "Sistema"}</span>
                        <Clock className="w-3 h-3 ml-2" />
                        <span>{new Date(version.created_at).toLocaleString()}</span>
                      </div>
                      {version.change_note && (
                        <div className="flex items-start gap-2">
                          <FileText className="w-3 h-3 mt-0.5 text-muted-foreground" />
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
                        <Eye className="w-4 h-4 mr-2" />
                        Visualizza
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestore(version)}
                        disabled={profile?.role !== "admin"}
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Ripristina
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
          open={!!viewingVersion}
          onClose={() => setViewingVersion(null)}
        />
      )}

      {viewingVersion && selectedVersions.length === 1 && (
        <VersionDiffViewer
          version1={viewingVersion}
          version2={null}
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