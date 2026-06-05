import {
  CheckCircle2,
  Eye,
  FileText,
  Plus,
  ReceiptText,
  Save,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { positiveNumber, type QuoteDraft } from "@/lib/costs-finance";
import { randomUUID } from "@/lib/random-uuid";

type ClientOption = { id: string; name: string; company_name: string | null };
type TicketLike = { id: string; ticket_code: string; client_id: string | null };

export type QuoteLineDraft = {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  itemType: "service" | "labor" | "material" | "extra";
};

export function createEmptyQuoteLine(): QuoteLineDraft {
  return {
    id: randomUUID(),
    description: "",
    quantity: "1",
    unitPrice: "0",
    itemType: "extra",
  };
}

type QuoteModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteDraft: QuoteDraft;
  setQuoteDraft: Dispatch<SetStateAction<QuoteDraft>>;
  quoteLines: QuoteLineDraft[];
  setQuoteLines: Dispatch<SetStateAction<QuoteLineDraft[]>>;
  quoteTicketId: string;
  setQuoteTicketId: (id: string) => void;
  clients: ClientOption[];
  ticketOptions: TicketLike[];
  busy: boolean;
  onCreateQuote: () => void;
};

type QuoteRow = {
  id: string;
  client_id: string;
  quote_number: string;
  status: "draft" | "sent" | "approved" | "rejected" | "converted" | "expired";
  title: string;
  issue_date: string;
  valid_until: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  notes: string | null;
  converted_ticket_id: string | null;
  converted_invoice_id?: string | null;
  client?: ClientOption | null;
};

function quoteStatusColor(status: QuoteRow["status"]): { bg: string; fg: string } {
  switch (status) {
    case "draft":
      return { bg: "var(--surface2)", fg: "var(--text3)" };
    case "sent":
      return { bg: "var(--accent-alpha)", fg: "var(--accent)" };
    case "approved":
      return { bg: "var(--success-alpha)", fg: "var(--success)" };
    case "rejected":
      return { bg: "rgba(239, 68, 68, 0.15)", fg: "#ef4444" };
    case "converted":
      return { bg: "rgba(99, 102, 241, 0.15)", fg: "#6366f1" };
    case "expired":
      return { bg: "var(--warning-alpha)", fg: "#f97316" };
  }
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Bozza",
  sent: "Inviato",
  approved: "Approvato",
  rejected: "Rifiutato",
  converted: "Convertito",
  expired: "Scaduto",
};

export function QuoteStatusBadge({ status }: { status: QuoteRow["status"] }) {
  const { t } = useTranslation("costs");
  const { bg, fg } = quoteStatusColor(status);
  const labelKey = `finance.quoteStatus${status.charAt(0).toUpperCase() + status.slice(1)}`;
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap"
      style={{ background: bg, color: fg }}
    >
      {t(labelKey, STATUS_LABELS[status] || status)}
    </span>
  );
}

type QuoteActionsProps = {
  quote: QuoteRow;
  busy: boolean;
  onStatusChange: (quote: QuoteRow, status: QuoteRow["status"]) => void;
  onConvertToTicket: (quote: QuoteRow) => void;
  onConvertToInvoice: (quote: QuoteRow) => void;
  onDelete: (quote: QuoteRow) => void;
  onViewPdf?: (quote: QuoteRow) => void;
};

export function QuoteActions({
  quote,
  busy,
  onStatusChange,
  onConvertToTicket,
  onConvertToInvoice,
  onDelete,
  onViewPdf,
}: QuoteActionsProps) {
  const { t } = useTranslation("costs");
  const s = quote.status;

  return (
    <div className="flex items-center justify-end gap-1">
      {onViewPdf && (
        <button
          className="pc-btn pc-btn-ghost pc-btn-xs"
          onClick={() => onViewPdf(quote)}
          disabled={busy}
          title={t("finance.viewPdfQuote", "Visualizza PDF")}
        >
          <Eye size={12} />
        </button>
      )}
      {s === "draft" && (
        <button
          className="pc-btn pc-btn-ghost pc-btn-xs"
          onClick={() => onStatusChange(quote, "sent")}
          disabled={busy}
          title={t("finance.sendQuote", "Invia")}
        >
          <Send size={12} />
        </button>
      )}
      {s === "sent" && (
        <>
          <button
            className="pc-btn pc-btn-ghost pc-btn-xs"
            onClick={() => onStatusChange(quote, "approved")}
            disabled={busy}
            title={t("finance.approveQuote", "Approva")}
            style={{ color: "var(--success)" }}
          >
            <CheckCircle2 size={12} />
          </button>
          <button
            className="pc-btn pc-btn-ghost pc-btn-xs"
            onClick={() => onStatusChange(quote, "rejected")}
            disabled={busy}
            title={t("finance.rejectQuote", "Rifiuta")}
            style={{ color: "#ef4444" }}
          >
            <X size={12} />
          </button>
        </>
      )}
      {s === "approved" && (
        <button
          className="pc-btn pc-btn-ghost pc-btn-xs"
          onClick={() => onConvertToInvoice(quote)}
          disabled={busy}
          title={t("finance.convertToInvoice", "Converti in fattura")}
          style={{ color: "var(--success)" }}
        >
          <ReceiptText size={12} />
        </button>
      )}
      {(s === "draft" || s === "approved") && (
        <button
          className="pc-btn pc-btn-ghost pc-btn-xs"
          onClick={() => onConvertToTicket(quote)}
          disabled={busy}
          title={t("finance.convertToTicket", "Converti in ticket")}
        >
          <FileText size={12} />
        </button>
      )}
      <button
        className="pc-btn pc-btn-ghost pc-btn-xs"
        onClick={() => onDelete(quote)}
        disabled={busy}
        title={t("finance.deleteQuote", "Elimina")}
        style={{ color: "var(--text3)" }}
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

export function QuoteModal({
  open,
  onOpenChange,
  quoteDraft,
  setQuoteDraft,
  quoteLines,
  setQuoteLines,
  quoteTicketId,
  setQuoteTicketId,
  clients,
  ticketOptions,
  busy,
  onCreateQuote,
}: QuoteModalProps) {
  const { t } = useTranslation("costs");

  function updateLine(id: string, patch: Partial<QuoteLineDraft>) {
    setQuoteLines((lines) => lines.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setQuoteLines((lines) => [...lines, createEmptyQuoteLine()]);
  }

  function removeLine(id: string) {
    setQuoteLines((lines) => (lines.length > 1 ? lines.filter((line) => line.id !== id) : lines));
  }

  const totals = useMemo(() => {
    const subtotal = quoteLines.reduce(
      (sum, line) => sum + positiveNumber(line.quantity) * positiveNumber(line.unitPrice),
      0,
    );
    const taxRate = 22;
    const taxAmount = Math.round(subtotal * taxRate) / 100;
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      taxRate,
      taxAmount,
      total: Math.round((subtotal + taxAmount) * 100) / 100,
    };
  }, [quoteLines]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("finance.createQuote", "Crea preventivo")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Client + Quote Number + Title row */}
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-sm font-medium text-text2 col-span-2 sm:col-span-1">
              {t("finance.quoteClientLabel", "Cliente")} *
              <select
                className="pc-input w-full"
                value={quoteDraft.clientId}
                onChange={(e) => setQuoteDraft((v) => ({ ...v, clientId: e.target.value }))}
              >
                <option value="">
                  {t("contractForm.clientPlaceholder", "Seleziona cliente...")}
                </option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.company_name || client.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm font-medium text-text2">
              {t("finance.quoteNumberLabel", "Numero")}
              <input
                className="pc-input w-full"
                value={quoteDraft.quoteNumber}
                onChange={(e) => setQuoteDraft((v) => ({ ...v, quoteNumber: e.target.value }))}
              />
            </label>

            <label className="space-y-1 text-sm font-medium text-text2 col-span-2 sm:col-span-1">
              {t("finance.quoteTitleLabel", "Titolo")}
              <input
                className="pc-input w-full"
                value={quoteDraft.title}
                onChange={(e) => setQuoteDraft((v) => ({ ...v, title: e.target.value }))}
              />
            </label>

            <label className="space-y-1 text-sm font-medium text-text2">
              {t("finance.quoteValidUntilLabel", "Valido fino al")}
              <DatePickerInput
                value={quoteDraft.validUntil}
                onChange={(v) => setQuoteDraft((prev) => ({ ...prev, validUntil: v }))}
              />
            </label>

            <label className="space-y-1 text-sm font-medium text-text2">
              {t("finance.quoteTicketLabel", "Ticket collegato (opzionale)")}
              <select
                className="pc-input w-full"
                value={quoteTicketId}
                onChange={(e) => setQuoteTicketId(e.target.value)}
              >
                <option value="">{t("finance.quoteTicketPlaceholder", "Nessun ticket")}</option>
                {ticketOptions.slice(0, 50).map((ticket) => (
                  <option key={ticket.id} value={ticket.id}>
                    {ticket.ticket_code}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Dynamic quote lines */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-text2">
                {t("finance.quoteDescriptionLabel", "Voci preventivo")}
              </span>
              <button type="button" className="pc-btn pc-btn-ghost pc-btn-xs" onClick={addLine}>
                <Plus className="size-3" /> {t("finance.addQuoteLine", "Aggiungi voce")}
              </button>
            </div>

            <div className="space-y-2 max-h-[280px] overflow-y-auto">
              {quoteLines.map((line, index) => (
                <div
                  key={line.id}
                  className="flex flex-wrap items-end gap-2 rounded-lg border p-2"
                  style={{ borderColor: "var(--border)" }}
                >
                  <label className="flex-1 min-w-[160px] space-y-0.5 text-xs font-medium text-text2">
                    {t("finance.quoteLineDescriptionLabel", "Descrizione")}
                    <input
                      className="pc-input w-full text-sm"
                      value={line.description}
                      onChange={(e) => updateLine(line.id, { description: e.target.value })}
                      placeholder={`Voce ${index + 1}`}
                    />
                  </label>

                  <label className="w-20 space-y-0.5 text-xs font-medium text-text2">
                    {t("finance.quantityLabel", "Q.tà")}
                    <input
                      className="pc-input w-full text-sm"
                      type="number"
                      min="0"
                      step="0.25"
                      value={line.quantity}
                      onChange={(e) => updateLine(line.id, { quantity: e.target.value })}
                    />
                  </label>

                  <label className="w-24 space-y-0.5 text-xs font-medium text-text2">
                    {t("finance.unitPriceLabel", "Prezzo")}
                    <input
                      className="pc-input w-full text-sm"
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.unitPrice}
                      onChange={(e) => updateLine(line.id, { unitPrice: e.target.value })}
                    />
                  </label>

                  <label className="w-24 space-y-0.5 text-xs font-medium text-text2">
                    {t("finance.quoteLineTypeLabel", "Tipo")}
                    <select
                      className="pc-input w-full text-sm"
                      value={line.itemType}
                      onChange={(e) =>
                        updateLine(line.id, {
                          itemType: e.target.value as QuoteLineDraft["itemType"],
                        })
                      }
                    >
                      <option value="service">Servizio</option>
                      <option value="labor">Manodopera</option>
                      <option value="material">Materiale</option>
                      <option value="extra">Extra</option>
                    </select>
                  </label>

                  <div className="text-sm font-mono font-bold whitespace-nowrap pb-1">
                    €{(positiveNumber(line.quantity) * positiveNumber(line.unitPrice)).toFixed(2)}
                  </div>

                  <button
                    type="button"
                    className="pc-btn pc-btn-ghost pc-btn-xs pb-1"
                    onClick={() => removeLine(line.id)}
                    disabled={quoteLines.length <= 1}
                    title={t("finance.removeQuoteLine", "Rimuovi")}
                  >
                    <X className="size-3 text-destructive" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <label className="space-y-1 text-sm font-medium text-text2">
            {t("finance.quoteNotesLabel", "Note")}
            <textarea
              className="pc-input w-full min-h-16 text-sm"
              value={quoteDraft.notes}
              onChange={(e) => setQuoteDraft((v) => ({ ...v, notes: e.target.value }))}
            />
          </label>

          {/* Totals */}
          <div
            className="rounded-lg border p-3 space-y-1 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
          >
            <div className="flex items-center justify-between">
              <span className="text-text3">{t("finance.quoteSubtotal", "Imponibile")}</span>
              <span className="font-mono">€{totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text3">{t("finance.quoteTax", "IVA 22%")}</span>
              <span className="font-mono">€{totals.taxAmount.toFixed(2)}</span>
            </div>
            <div
              className="flex items-center justify-between border-t pt-1 font-bold"
              style={{ borderColor: "var(--border)" }}
            >
              <span>{t("finance.quoteTotal", "Totale")}</span>
              <span className="font-mono">€{totals.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              className="pc-btn pc-btn-ghost pc-btn-sm"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              {t("finance.cancelQuote", "Annulla")}
            </button>
            <button
              type="button"
              className="pc-btn pc-btn-primary pc-btn-sm"
              onClick={onCreateQuote}
              disabled={busy || !quoteDraft.clientId}
            >
              <Save className="size-3" /> {t("finance.saveQuote", "Salva preventivo")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
