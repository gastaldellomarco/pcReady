import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Eye, FileArchive, FileImage, FileText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ListSkeleton, PageEmptyState, PageFetchError } from "@/components/page-states";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import { listPortalDocuments } from "@/lib/portal-tickets";

export const Route = createFileRoute("/portal/documents/")({
  component: PortalDocumentsPage,
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => <LoadingSkeleton variant="portal" />,
});

type PortalDocument = {
  id: string;
  type: "attachment" | "completion_report";
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
  ticket_id: string | null;
  ticket_code: string | null;
  ticket_title: string | null;
  status: string | null;
  view_url: string | null;
  download_url: string | null;
};

function PortalDocumentsPage() {
  const loadDocuments = useServerFn(listPortalDocuments);
  const [documents, setDocuments] = useState<PortalDocument[]>([]);
  const [session, setSession] = useState<any>(null);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);
  const [query, setQuery] = useState("");

  const load = useCallback(() => {
    const token = localStorage.getItem("pcready_portal_token") || "";
    if (!token) {
      window.location.href = "/portal";
      return;
    }
    setLoading(true);
    setError("");
    loadDocuments({ data: { token } })
      .then((result) => {
        setSession(result.session);
        setDocuments((result.documents as PortalDocument[]) || []);
        setDiagnostics(result.diagnostics || null);
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : "Errore durante il caricamento dei documenti";
        setError(message || "Impossibile caricare i documenti disponibili");
      })
      .finally(() => setLoading(false));
  }, [loadDocuments]);

  useEffect(() => {
    load();
  }, [load, retryKey]);

  const filteredDocuments = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return documents;
    return documents.filter((document) =>
      [document.file_name, document.ticket_code, document.ticket_title, document.mime_type]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [documents, query]);

  if (error) {
    return (
      <PageFetchError
        variant="portal"
        message={error}
        onRetry={() => setRetryKey((current) => current + 1)}
      />
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="h-8 w-52 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-96 max-w-full animate-pulse rounded-md bg-muted" />
        </div>
        <ListSkeleton rows={5} variant="portal" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Documenti</h1>
          <p className="text-sm text-muted-foreground">
            {session?.clientName
              ? `Documenti, allegati e report disponibili per ${session.clientName}.`
              : "Documenti, allegati e report disponibili per il tuo account."}
          </p>
        </div>
        <Button variant="outline" onClick={() => setRetryKey((current) => current + 1)}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Aggiorna
        </Button>
      </div>

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Archivio documenti</CardTitle>
            <CardDescription>
              {documents.length
                ? `${documents.length} documenti trovati${diagnostics ? ` (${diagnostics.attachments} allegati, ${diagnostics.completionReports} report)` : ""}.`
                : "Nessun documento disponibile."}
            </CardDescription>
          </div>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cerca documento o ticket..."
            className="sm:max-w-xs"
          />
        </CardHeader>
        <CardContent>
          {!documents.length ? (
            <PageEmptyState
              variant="portal"
              title="Nessun documento disponibile"
              description="Non risultano ancora allegati o report associati ai ticket della tua azienda. Quando un documento sarà pubblicato, lo vedrai qui."
            />
          ) : !filteredDocuments.length ? (
            <PageEmptyState
              variant="portal"
              title="Nessun risultato"
              description="La ricerca non corrisponde a nessun documento disponibile."
            />
          ) : (
            <div className="space-y-3">
              {filteredDocuments.map((document) => (
                <DocumentRow key={document.id} document={document} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DocumentRow({ document }: { document: PortalDocument }) {
  const canOpen = Boolean(document.view_url);
  const canDownload = Boolean(document.download_url);

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 md:flex-row md:items-center md:justify-between">
      <div className="flex gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <DocumentIcon mimeType={document.mime_type} fileName={document.file_name} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="break-all text-sm font-semibold sm:text-base">{document.file_name}</h2>
            <Badge variant={document.type === "completion_report" ? "default" : "secondary"}>
              {document.type === "completion_report" ? "Report" : "Allegato"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {document.ticket_code ? `${document.ticket_code} · ` : ""}
            {document.ticket_title || "Documento associato"}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{formatDate(document.created_at)}</span>
            <span>{formatFileSize(document.file_size)}</span>
            {document.status ? <span>Stato ticket: {document.status}</span> : null}
            {!canOpen && !canDownload ? (
              <span className="text-destructive">Link non disponibile</span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 md:justify-end">
        <Button variant="outline" size="sm" asChild disabled={!canOpen}>
          <a href={document.view_url || "#"} target="_blank" rel="noreferrer">
            <Eye className="mr-2 h-4 w-4" />
            Visualizza
          </a>
        </Button>
        <Button size="sm" asChild disabled={!canDownload}>
          <a href={document.download_url || "#"} target="_blank" rel="noreferrer">
            <Download className="mr-2 h-4 w-4" />
            Scarica
          </a>
        </Button>
      </div>
    </div>
  );
}

function DocumentIcon({ mimeType, fileName }: { mimeType: string | null; fileName: string }) {
  const lower = `${mimeType || ""} ${fileName}`.toLowerCase();
  if (lower.includes("image/")) return <FileImage className="h-5 w-5" />;
  if (lower.includes("zip") || lower.includes("archive"))
    return <FileArchive className="h-5 w-5" />;
  return <FileText className="h-5 w-5" />;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function formatFileSize(value: number | null | undefined) {
  if (!value) return "Dimensione non disponibile";
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${Math.round((value / 1024 / 1024) * 10) / 10} MB`;
}
