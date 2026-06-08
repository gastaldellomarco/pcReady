import { Clock, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Version, compareVersions } from "@/lib/versioning";

interface VersionDiffViewerProps {
  version1: Version;
  version2: Version | null;
  authorNames?: Record<string, string>;
  open: boolean;
  onClose: () => void;
}

function formatFieldName(key: string, t: any) {
  const labels: Record<string, string> = {
    active: t("versionDiff.fieldLabels.active", "Attiva"),
    category: t("versionDiff.fieldLabels.category", "Categoria"),
    color: t("versionDiff.fieldLabels.color", "Colore"),
    content: t("versionDiff.fieldLabels.content", "Contenuto"),
    description: t("versionDiff.fieldLabels.description", "Descrizione"),
    flow_definition: t("versionDiff.fieldLabels.flow_definition", "Definizione workflow"),
    icon: t("versionDiff.fieldLabels.icon", "Icona"),
    is_default: t("versionDiff.fieldLabels.is_default", "Predefinito"),
    language: t("versionDiff.fieldLabels.language", "Linguaggio"),
    name: t("versionDiff.fieldLabels.name", "Nome"),
    structure: t("versionDiff.fieldLabels.structure", "Struttura"),
    type: t("versionDiff.fieldLabels.type", "Tipo"),
    summary: t("versionDiff.fieldLabels.summary", "Riepilogo"),
    version: t("versionDiff.fieldLabels.version", "Versione"),
  };
  return labels[key] || key.replace(/_/g, " ");
}

function formatValue(value: unknown, t: any) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean")
    return value ? t("versionDiff.yes", "Sì") : t("versionDiff.no", "No");
  if (typeof value === "string" || typeof value === "number") return String(value);
  return JSON.stringify(value, null, 2);
}

function CodeDiffBlock({ oldContent, newContent }: { oldContent: string; newContent: string }) {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");

  // Simple line-by-line comparison
  const maxLen = Math.max(oldLines.length, newLines.length);
  const left: { text: string; type: "removed" | "unchanged" }[] = [];
  const right: { text: string; type: "added" | "unchanged" }[] = [];

  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];

    if (oldLine === newLine) {
      left.push({ text: oldLine ?? "", type: "unchanged" });
      right.push({ text: newLine ?? "", type: "unchanged" });
    } else {
      if (oldLine !== undefined) {
        left.push({ text: oldLine, type: "removed" });
        right.push({ text: "", type: "unchanged" });
      } else {
        left.push({ text: "", type: "unchanged" });
      }
      if (newLine !== undefined) {
        right[right.length - 1] = { text: newLine, type: "added" };
      }
    }
  }

  return (
    <div className="grid grid-cols-2 gap-0 border rounded overflow-hidden">
      <div className="bg-red-50 dark:bg-red-950/20 font-mono text-xs leading-relaxed overflow-x-auto">
        {left.map((line, i) => (
          <div
            key={i}
            className={`px-2 py-0.5 border-b border-red-100 dark:border-red-900/30 ${
              line.type === "removed"
                ? "bg-red-100 dark:bg-red-900/40 text-red-900 dark:text-red-200"
                : "text-muted-foreground"
            }`}
          >
            <span className="inline-block w-8 text-right mr-2 text-muted-foreground select-none">
              {line.type === "removed" ? "-" : i + 1}
            </span>
            {line.text || "\u00A0"}
          </div>
        ))}
      </div>
      <div className="bg-green-50 dark:bg-green-950/20 font-mono text-xs leading-relaxed overflow-x-auto border-l">
        {right.map((line, i) => (
          <div
            key={i}
            className={`px-2 py-0.5 border-b border-green-100 dark:border-green-900/30 ${
              line.type === "added"
                ? "bg-green-100 dark:bg-green-900/40 text-green-900 dark:text-green-200"
                : "text-muted-foreground"
            }`}
          >
            <span className="inline-block w-8 text-right mr-2 text-muted-foreground select-none">
              {line.type === "added" ? "+" : i + 1}
            </span>
            {line.text || "\u00A0"}
          </div>
        ))}
      </div>
    </div>
  );
}

function ValueBlock({
  value,
  tone,
  t: tFn,
}: {
  value: unknown;
  tone: "old" | "new" | "neutral";
  t: any;
}) {
  const text = formatValue(value, tFn);
  const isLong = text.length > 120 || text.includes("\n");
  const className =
    tone === "old"
      ? "p-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded text-sm"
      : tone === "new"
        ? "p-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded text-sm"
        : "p-2 bg-muted rounded text-sm";

  return isLong ? (
    <pre className={`${className} whitespace-pre-wrap font-mono text-xs`}>{text}</pre>
  ) : (
    <div className={className}>{text}</div>
  );
}

/**
 *
 */
export function VersionDiffViewer({
  version1,
  version2,
  authorNames = {},
  open,
  onClose,
}: VersionDiffViewerProps) {
  const { t } = useTranslation("checklist");
  const isComparison = !!version2;
  const diff = version2 ? compareVersions(version1, version2) : null;
  const authorLabel = (id: string | null) =>
    id ? authorNames[id] || id : t("versionDiff.system", "Sistema");

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>
            {isComparison
              ? t("versionDiff.compareVersions", "Confronto Versioni")
              : t("versionDiff.versionDetails", "Dettagli Versione")}{" "}
            v{version1.version_number}
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
                  <Badge
                    variant={
                      version1.operation === "create"
                        ? "default"
                        : version1.operation === "update"
                          ? "secondary"
                          : version1.operation === "restore"
                            ? "destructive"
                            : "outline"
                    }
                  >
                    {version1.operation}
                  </Badge>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <User className="size-3" />
                    <span>{authorLabel(version1.created_by)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="size-3" />
                    <span>{new Date(version1.created_at).toLocaleString()}</span>
                  </div>
                  {version1.change_note && (
                    <div className="mt-2 p-2 bg-muted rounded text-sm">{version1.change_note}</div>
                  )}
                </div>
              </div>

              {version2 && (
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge>v{version2.version_number}</Badge>
                    <Badge
                      variant={
                        version2.operation === "create"
                          ? "default"
                          : version2.operation === "update"
                            ? "secondary"
                            : version2.operation === "restore"
                              ? "destructive"
                              : "outline"
                      }
                    >
                      {version2.operation}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <User className="size-3" />
                      <span>{authorLabel(version2.created_by)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="size-3" />
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
                    <h3 className="font-semibold mb-3">
                      {t("versionDiff.changedFields", "Campi Modificati")}
                    </h3>
                    <div className="space-y-3">
                      {Object.entries(diff.changed).map(([key, change]) => (
                        <div key={key} className="border rounded-lg p-4">
                          <div className="font-medium mb-2 capitalize">
                            {formatFieldName(key, t)}
                          </div>
                          {key === "content" && typeof change.old === "string" && typeof change.new === "string" ? (
                            <CodeDiffBlock oldContent={change.old as string} newContent={change.new as string} />
                          ) : (
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <div className="text-sm text-muted-foreground mb-1">
                                  {t("versionDiff.previous", "Precedente")}
                                </div>
                                <ValueBlock value={change.old} tone="old" t={t} />
                              </div>
                              <div>
                                <div className="text-sm text-muted-foreground mb-1">
                                  {t("versionDiff.new", "Nuovo")}
                                </div>
                                <ValueBlock value={change.new} tone="new" t={t} />
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Added Fields */}
                {Object.keys(diff.added).length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3 text-green-600">
                      {t("versionDiff.addedFields", "Campi Aggiunti")}
                    </h3>
                    <div className="space-y-2">
                      {Object.entries(diff.added).map(([key, value]) => (
                        <div
                          key={key}
                          className="flex justify-between items-center p-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded"
                        >
                          <span className="font-medium capitalize">{key.replace(/_/g, " ")}</span>
                          <span className="text-sm">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Removed Fields */}
                {Object.keys(diff.removed).length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3 text-red-600">
                      {t("versionDiff.removedFields", "Campi Rimossi")}
                    </h3>
                    <div className="space-y-2">
                      {Object.entries(diff.removed).map(([key, value]) => (
                        <div
                          key={key}
                          className="flex justify-between items-center p-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded"
                        >
                          <span className="font-medium capitalize">{key.replace(/_/g, " ")}</span>
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
                <h3 className="font-semibold mb-3">
                  {t("versionDiff.versionData", "Dati Versione")}
                </h3>
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
