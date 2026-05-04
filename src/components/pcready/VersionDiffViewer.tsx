import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Version, compareVersions } from "@/lib/versioning";
import { Clock, User } from "lucide-react";

interface VersionDiffViewerProps {
  version1: Version;
  version2: Version | null;
  open: boolean;
  onClose: () => void;
}

export function VersionDiffViewer({ version1, version2, open, onClose }: VersionDiffViewerProps) {
  const isComparison = !!version2;
  const diff = version2 ? compareVersions(version1, version2) : null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>
            {isComparison ? "Confronto Versioni" : "Dettagli Versione"} v{version1.version_number}
            {version2 && ` vs v${version2.version_number}`}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-6">
            {/* Version Headers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge>v{version1.version_number}</Badge>
                  <Badge variant={
                    version1.operation === "create" ? "default" :
                    version1.operation === "update" ? "secondary" :
                    version1.operation === "restore" ? "destructive" : "outline"
                  }>
                    {version1.operation}
                  </Badge>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <User className="w-3 h-3" />
                    <span>{version1.created_by || "Sistema"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(version1.created_at).toLocaleString()}</span>
                  </div>
                  {version1.change_note && (
                    <div className="mt-2 p-2 bg-muted rounded text-sm">
                      {version1.change_note}
                    </div>
                  )}
                </div>
              </div>

              {version2 && (
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge>v{version2.version_number}</Badge>
                    <Badge variant={
                      version2.operation === "create" ? "default" :
                      version2.operation === "update" ? "secondary" :
                      version2.operation === "restore" ? "destructive" : "outline"
                    }>
                      {version2.operation}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <User className="w-3 h-3" />
                      <span>{version2.created_by || "Sistema"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(version2.created_at).toLocaleString()}</span>
                    </div>
                    {version2.change_note && (
                      <div className="mt-2 p-2 bg-muted rounded text-sm">
                        {version2.change_note}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Diff Content */}
            {isComparison && diff ? (
              <div className="space-y-4">
                {/* Changed Fields */}
                {Object.keys(diff.changed).length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3">Campi Modificati</h3>
                    <div className="space-y-3">
                      {Object.entries(diff.changed).map(([key, change]) => (
                        <div key={key} className="border rounded-lg p-4">
                          <div className="font-medium mb-2 capitalize">{key.replace(/_/g, ' ')}</div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-sm text-muted-foreground mb-1">Precedente</div>
                              <div className="p-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded text-sm">
                                {typeof change.old === 'string' && change.old.includes('\n') ? (
                                  <pre className="whitespace-pre-wrap font-mono text-xs">{change.old}</pre>
                                ) : (
                                  String(change.old || '')
                                )}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground mb-1">Nuovo</div>
                              <div className="p-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded text-sm">
                                {typeof change.new === 'string' && change.new.includes('\n') ? (
                                  <pre className="whitespace-pre-wrap font-mono text-xs">{change.new}</pre>
                                ) : (
                                  String(change.new || '')
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Added Fields */}
                {Object.keys(diff.added).length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3 text-green-600">Campi Aggiunti</h3>
                    <div className="space-y-2">
                      {Object.entries(diff.added).map(([key, value]) => (
                        <div key={key} className="flex justify-between items-center p-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded">
                          <span className="font-medium capitalize">{key.replace(/_/g, ' ')}</span>
                          <span className="text-sm">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Removed Fields */}
                {Object.keys(diff.removed).length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3 text-red-600">Campi Rimossi</h3>
                    <div className="space-y-2">
                      {Object.entries(diff.removed).map(([key, value]) => (
                        <div key={key} className="flex justify-between items-center p-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded">
                          <span className="font-medium capitalize">{key.replace(/_/g, ' ')}</span>
                          <span className="text-sm">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Single Version View */
              <div>
                <h3 className="font-semibold mb-3">Dati Versione</h3>
                <div className="border rounded-lg p-4">
                  <pre className="whitespace-pre-wrap font-mono text-sm">
                    {JSON.stringify(version1.snapshot, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}