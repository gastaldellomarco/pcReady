import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Download,
  Eye,
  FileArchive,
  FileImage,
  FileText,
  X,
  RefreshCw,
  PenLine,
  CheckCircle2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ListSkeleton, PageEmptyState, PageFetchError } from "@/components/page-states";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { listPortalDocuments, signPortalDocument } from "@/lib/portal-tickets";

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
  signature?: { signed_at: string; signature_path: string } | null;
};

const DOC_CATEGORIES = [
  { key: "all", label: "Tutti" },
  { key: "report", label: "Report" },
  { key: "attachment", label: "Allegati" },
  { key: "contract", label: "Contratti" },
  { key: "invoice", label: "Fatture" },
  { key: "manual", label: "Manuali" },
] as const;

function classifyDocument(doc: PortalDocument): string {
  if (doc.type === "completion_report") return "report";
  const name = (doc.file_name || "").toLowerCase();
  if (name.includes("contratto") || name.includes("contract") || name.includes("contr."))
    return "contract";
  if (
    name.includes("fattura") ||
    name.includes("invoice") ||
    name.includes("fatt.") ||
    /\binv[_\-.]/.test(name)
  )
    return "invoice";
  if (
    name.includes("manuale") ||
    name.includes("manual") ||
    name.includes("guida") ||
    name.includes("guide")
  )
    return "manual";
  return "attachment";
}

function isSignable(doc: PortalDocument): boolean {
  const isPdf = (doc.mime_type || doc.file_name).toLowerCase().includes("pdf");
  const cat = classifyDocument(doc);
  return isPdf && (cat === "contract" || cat === "invoice" || cat === "report");
}

function PortalDocumentsPage() {
  const loadDocuments = useServerFn(listPortalDocuments);
  const signDocument = useServerFn(signPortalDocument);
  const [documents, setDocuments] = useState<PortalDocument[]>([]);
  const [session, setSession] = useState<any>(null);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [previewDoc, setPreviewDoc] = useState<PortalDocument | null>(null);
  const [signingDoc, setSigningDoc] = useState<PortalDocument | null>(null);
  const [signingBusy, setSigningBusy] = useState(false);

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

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: documents.length };
    documents.forEach((doc) => {
      const cat = classifyDocument(doc);
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    let result = documents;
    if (category !== "all") {
      result = result.filter((doc) => classifyDocument(doc) === category);
    }
    const term = query.trim().toLowerCase();
    if (term) {
      result = result.filter((document) =>
        [document.file_name, document.ticket_code, document.ticket_title, document.mime_type]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term)),
      );
    }
    return result;
  }, [documents, query, category]);

  async function handleSign(signatureDataUrl: string) {
    if (!signingDoc) return;
    const token = localStorage.getItem("pcready_portal_token") || "";
    setSigningBusy(true);
    try {
      await signDocument({ data: { token, documentId: signingDoc.id, signatureDataUrl } });
      toast.success("Documento firmato con successo");
      setSigningDoc(null);
      setRetryKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore durante la firma");
    } finally {
      setSigningBusy(false);
    }
  }

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
          <RefreshCw className="mr-2 size-4" />
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

        {/* Category filter tabs */}
        <div className="px-6 pb-2">
          <div className="flex flex-wrap gap-1.5">
            {DOC_CATEGORIES.map((cat) => {
              const count = categoryCounts[cat.key];
              if (!count && cat.key !== "all") return null;
              return (
                <button
                  key={cat.key}
                  onClick={() => setCategory(cat.key)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    category === cat.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  }`}
                >
                  {cat.label}
                  {count !== undefined && cat.key === "all" && (
                    <span className="text-[10px] opacity-70">({count})</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

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
              title={
                category !== "all" ? "Nessun documento in questa categoria" : "Nessun risultato"
              }
              description={
                category !== "all"
                  ? "Prova a selezionare un'altra categoria."
                  : "La ricerca non corrisponde a nessun documento disponibile."
              }
            />
          ) : (
            <div className="space-y-3">
              {filteredDocuments.map((document) => (
                <DocumentRow
                  key={document.id}
                  document={document}
                  onPreview={() => setPreviewDoc(document)}
                  onSign={() => setSigningDoc(document)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* PDF Preview Modal */}
      {previewDoc && <PdfPreviewModal document={previewDoc} onClose={() => setPreviewDoc(null)} />}

      {/* Signature Modal */}
      {signingDoc && (
        <SignatureModal
          document={signingDoc}
          busy={signingBusy}
          onSign={handleSign}
          onClose={() => setSigningDoc(null)}
        />
      )}
    </div>
  );
}

// ── PDF Preview Modal ─────────────────────────────────────────────────────

function PdfPreviewModal({ document, onClose }: { document: PortalDocument; onClose: () => void }) {
  const isPdf = (document.mime_type || document.file_name).toLowerCase().includes("pdf");

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      role="button"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div
        className="relative w-full max-w-4xl rounded-lg bg-card shadow-2xl"
        style={{ height: "85vh" }}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{document.file_name}</h2>
            <p className="text-xs text-muted-foreground">
              {document.ticket_code ? `Ticket ${document.ticket_code}` : "Documento"}
              {document.signature && " · Firmato"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {document.download_url && (
              <Button size="sm" variant="outline" asChild>
                <a href={document.download_url} target="_blank" rel="noreferrer">
                  <Download className="mr-2 size-4" />
                  Scarica
                </a>
              </Button>
            )}
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Chiudi anteprima"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        <div className="h-[calc(85vh-57px)]">
          {isPdf && document.view_url ? (
            <iframe
              src={document.view_url}
              className="h-full w-full border-0"
              title={document.file_name}
            />
          ) : document.view_url ? (
            <div className="flex h-full items-center justify-center p-8">
              <div className="text-center">
                <FileText className="mx-auto size-16 text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">
                  L'anteprima inline è disponibile solo per i PDF.
                </p>
                <Button variant="outline" className="mt-4" asChild>
                  <a href={document.view_url} target="_blank" rel="noreferrer">
                    Apri in una nuova scheda
                  </a>
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-muted-foreground">Anteprima non disponibile.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Signature Modal ────────────────────────────────────────────────────────

function SignatureModal({
  document,
  busy,
  onSign,
  onClose,
}: {
  document: PortalDocument;
  busy: boolean;
  onSign: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawing, setHasDrawing] = useState(false);
  // Close on Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, busy]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Setup canvas
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1e293b";
  }, []);

  function getPos(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function startDrawing(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasDrawing(true);
  }

  function stopDrawing() {
    setIsDrawing(false);
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawing(false);
  }

  function submitSignature() {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawing) return;
    const dataUrl = canvas.toDataURL("image/png");
    onSign(dataUrl);
  }

  return (
    <div
      role="button"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !busy) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-lg bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Firma documento</h2>
            <p className="text-xs text-muted-foreground truncate max-w-xs">{document.file_name}</p>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Annulla firma"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Disegna la tua firma nel riquadro sottostante.
          </p>

          <div
            className="rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/30"
            style={{ touchAction: "none" }}
          >
            <canvas
              ref={canvasRef}
              key="signature-canvas"
              className="h-40 w-full cursor-crosshair rounded-lg"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>

          <div className="flex justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSignature}
              disabled={!hasDrawing || busy}
            >
              Cancella
            </Button>
            <Button onClick={submitSignature} disabled={!hasDrawing || busy} className="gap-2">
              <PenLine className="size-4" />
              {busy ? "Salvataggio..." : "Firma documento"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Document Row ───────────────────────────────────────────────────────────

function DocumentRow({
  document,
  onPreview,
  onSign,
}: {
  document: PortalDocument;
  onPreview: () => void;
  onSign: () => void;
}) {
  const canOpen = Boolean(document.view_url);
  const canDownload = Boolean(document.download_url);
  const isPdf = (document.mime_type || document.file_name).toLowerCase().includes("pdf");
  const isSigned = !!document.signature;
  const cat = classifyDocument(document);

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
              {DOC_CATEGORIES.find((c) => c.key === cat)?.label || "Allegato"}
            </Badge>
            {isSigned && (
              <Badge
                variant="outline"
                className="border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400"
              >
                <CheckCircle2 className="mr-1 size-3" />
                Firmato
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {document.ticket_code ? `${document.ticket_code} · ` : ""}
            {document.ticket_title || "Documento associato"}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{formatDate(document.created_at)}</span>
            <span>{formatFileSize(document.file_size)}</span>
            {document.status ? <span>Stato ticket: {document.status}</span> : null}
            {isSigned && <span>Firmato il {formatDate(document.signature!.signed_at)}</span>}
            {!canOpen && !canDownload && (
              <span className="text-destructive">Link non disponibile</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 md:justify-end">
        {isPdf && canOpen && (
          <Button size="sm" variant="ghost" onClick={onPreview}>
            <Eye className="mr-2 size-4" />
            Anteprima
          </Button>
        )}
        {canDownload && (
          <Button size="sm" variant="outline" asChild>
            <a href={document.download_url ?? undefined} target="_blank" rel="noreferrer">
              <Download className="mr-2 size-4" />
              Scarica
            </a>
          </Button>
        )}
        {!isSigned && isSignable(document) && (
          <Button size="sm" onClick={onSign} className="gap-2">
            <PenLine className="size-4" />
            Firma
          </Button>
        )}
      </div>
    </div>
  );
}

function DocumentIcon({ mimeType, fileName }: { mimeType: string | null; fileName: string }) {
  const lower = `${mimeType || ""} ${fileName}`.toLowerCase();
  if (lower.includes("image/")) return <FileImage className="size-5" />;
  if (lower.includes("zip") || lower.includes("archive")) return <FileArchive className="size-5" />;
  return <FileText className="size-5" />;
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
