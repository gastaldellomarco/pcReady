import { useMemo, useState } from "react";
import { CheckCircle2, Download, FileUp } from "lucide-react";
import { Modal } from "@/components/pcready/Modal";
import { useAuth } from "@/lib/auth-context";
import {
  csvTemplate,
  importDevicesFromCsv,
  loadInventoryImportContext,
  parseDevicesCsv,
  validateImportRows,
  type ImportResult,
  type PreviewRow,
} from "@/lib/inventory-import";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

export function ImportCsvDialog({ open, onClose, onImported }: Props) {
  const { user, canEdit } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);

  const stats = useMemo(
    () => ({
      inserts: rows.filter((row) => row.action === "insert").length,
      updates: rows.filter((row) => row.action === "update").length,
      errors: rows.filter((row) => row.errors.length).length,
      valid: rows.filter((row) => row.action !== "skip").length,
    }),
    [rows],
  );

  function resetAndClose() {
    setStep(1);
    setRows([]);
    setFileName("");
    setBusy(false);
    setProgress(0);
    setResult(null);
    onClose();
  }

  async function handleFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    setResult(null);
    setFileName(file.name);
    try {
      const text = await file.text();
      const parsed = parseDevicesCsv(text);
      const context = await loadInventoryImportContext();
      const preview = validateImportRows(parsed, context.clients, context.devices);
      setRows(preview);
      setStep(2);
      if (!preview.length) toast.error("CSV vuoto o senza righe valide");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore lettura CSV");
    } finally {
      setBusy(false);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([csvTemplate()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "template-inventario-pcready.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function confirmImport() {
    if (!canEdit) return toast.error("Permessi insufficienti");
    if (!stats.valid) return toast.error("Nessuna riga valida da importare");

    setBusy(true);
    setProgress(0);
    setStep(3);
    try {
      const importResult = await importDevicesFromCsv(rows, user?.id ?? null, (done, total) => {
        setProgress(total ? Math.round((done / total) * 100) : 100);
      });
      setResult(importResult);
      onImported();
      toast.success("Import CSV completato");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore import CSV");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={resetAndClose}
      title="Import CSV dispositivi"
      size="lg"
      footer={
        <>
          <button className="pc-btn pc-btn-ghost" onClick={resetAndClose} disabled={busy}>
            Chiudi
          </button>
          {step === 2 && (
            <button
              className="pc-btn pc-btn-primary"
              onClick={confirmImport}
              disabled={busy || !stats.valid}
            >
              Conferma import
            </button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2 text-xs">
          {[
            ["1", "Upload"],
            ["2", "Preview"],
            ["3", "Conferma"],
          ].map(([n, label]) => (
            <div
              key={n}
              className="rounded-md border px-3 py-2"
              style={{
                borderColor: Number(n) === step ? "var(--primary)" : "var(--border)",
                background: Number(n) === step ? "var(--surface2)" : "transparent",
              }}
            >
              <span className="font-mono">{n}</span> {label}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="flex flex-col gap-3">
            <label
              className="flex min-h-[150px] cursor-pointer flex-col items-center justify-center gap-3 rounded-md border border-dashed px-4 text-center"
              style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
            >
              <FileUp className="h-8 w-8 text-text3" />
              <div>
                <div className="text-sm font-semibold">Carica file .csv</div>
                <div className="text-xs text-text3">
                  {busy
                    ? "Lettura in corso..."
                    : fileName || "serial, model, os, status, client_name, notes"}
                </div>
              </div>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                disabled={busy}
                onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <button className="pc-btn pc-btn-ghost self-start" onClick={downloadTemplate}>
              <Download className="w-3 h-3" /> Scarica template CSV
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-4 gap-2 text-xs">
              <SummaryBox label="Insert" value={stats.inserts} />
              <SummaryBox label="Update" value={stats.updates} />
              <SummaryBox label="Errori" value={stats.errors} />
              <SummaryBox label="Righe" value={rows.length} />
            </div>
            <div
              className="max-h-[360px] overflow-auto rounded-md border"
              style={{ borderColor: "var(--border)" }}
            >
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: "var(--surface2)" }}>
                    {[
                      "Riga",
                      "Seriale",
                      "Modello",
                      "Cliente",
                      "Stato",
                      "Azione",
                      "Validazione",
                    ].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-bold uppercase text-text3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={`${row.rowNumber}-${row.serial}`}
                      className="border-t"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <td className="px-3 py-2 font-mono">{row.rowNumber}</td>
                      <td className="px-3 py-2 font-mono">{row.serial || "-"}</td>
                      <td className="px-3 py-2">{row.model || "-"}</td>
                      <td className="px-3 py-2">{row.client_name || "-"}</td>
                      <td className="px-3 py-2">{row.status}</td>
                      <td className="px-3 py-2">{row.action}</td>
                      <td
                        className={
                          row.errors.length ? "px-3 py-2 text-destructive" : "px-3 py-2 text-text3"
                        }
                      >
                        {row.errors.join(", ") || "OK"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <div
              className="h-2 overflow-hidden rounded-full"
              style={{ background: "var(--surface2)" }}
            >
              <div
                className="h-full transition-all"
                style={{ width: `${progress}%`, background: "var(--primary)" }}
              />
            </div>
            {result ? (
              <div className="grid grid-cols-3 gap-2">
                <SummaryBox label="Inseriti" value={result.inserted} />
                <SummaryBox label="Aggiornati" value={result.updated} />
                <SummaryBox label="Errori" value={result.errors.length} />
              </div>
            ) : (
              <div className="text-sm text-text2">Import in corso...</div>
            )}
            {result?.errors.length ? (
              <div
                className="rounded-md border p-3 text-xs text-destructive"
                style={{ borderColor: "var(--border)" }}
              >
                {result.errors.map((error) => (
                  <div key={`${error.rowNumber}-${error.serial}`}>
                    Riga {error.rowNumber} ({error.serial || "-"}): {error.error}
                  </div>
                ))}
              </div>
            ) : result ? (
              <div className="flex items-center gap-2 text-sm text-text2">
                <CheckCircle2 className="h-4 w-4 text-green-600" /> Import completato
              </div>
            ) : null}
          </div>
        )}
      </div>
    </Modal>
  );
}

function SummaryBox({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="rounded-md border px-3 py-2"
      style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
    >
      <div className="text-[10px] uppercase text-text3">{label}</div>
      <div className="font-mono text-sm font-semibold">{value}</div>
    </div>
  );
}
