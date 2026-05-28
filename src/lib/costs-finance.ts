export type MoneyLike = string | number | null | undefined;

export type ClientCostProfile = {
  clientId: string | null;
  clientName: string;
  revenue: number;
  labor: number;
  materials: number;
  actualCost: number;
  margin: number;
  marginPercent: number;
  hours: number;
};

export type InvoiceDraft = {
  invoiceNumber: string;
  senderName: string;
  senderAddress: string;
  recipientName: string;
  recipientAddress: string;
  issueDate: string;
  dueDate: string;
  taxRate: string;
  notes: string;
  logoUrl: string;
};

export type QuoteDraft = {
  clientId: string;
  quoteNumber: string;
  title: string;
  validUntil: string;
  description: string;
  quantity: string;
  unitPrice: string;
  notes: string;
};

export type MaterialDraft = {
  ticketId: string;
  description: string;
  supplier: string;
  sku: string;
  quantity: string;
  unitCost: string;
  resaleMarginPercent: string;
};

export type BudgetDraft = {
  clientId: string;
  period: "monthly" | "annual";
  budgetAmount: string;
  alertThresholdPercent: string;
  startsOn: string;
  endsOn: string;
};

export type TicketLike = {
  id: string;
  ticket_code: string;
  client_id: string | null;
  client_name: string | null;
  billable_hours: number | null;
  labor_cost: number | null;
  material_cost: number | null;
  total_cost: number | null;
};

export type ContractLike = {
  client_id: string;
  status: string;
  billing_period: "monthly" | "annual";
  recurring_fee: number;
};

export function money(value: MoneyLike) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function positiveNumber(value: MoneyLike) {
  return Math.max(0, money(value));
}

export function invoiceSeed(prefix = "INV") {
  const now = new Date();
  return `${prefix}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getTime(),
  ).slice(-5)}`;
}

export function quoteSeed(prefix = "PREV") {
  const now = new Date();
  return `${prefix}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getTime(),
  ).slice(-5)}`;
}

export function computeClientProfitability(
  tickets: TicketLike[],
  contracts: ContractLike[],
  fallbackClient: string,
): ClientCostProfile[] {
  const map = new Map<string, ClientCostProfile>();
  tickets.forEach((ticket) => {
    const key = ticket.client_id ?? ticket.client_name ?? fallbackClient;
    const current =
      map.get(key) ??
      {
        clientId: ticket.client_id,
        clientName: ticket.client_name || fallbackClient,
        revenue: 0,
        labor: 0,
        materials: 0,
        actualCost: 0,
        margin: 0,
        marginPercent: 0,
        hours: 0,
      };
    current.labor += money(ticket.labor_cost);
    current.materials += money(ticket.material_cost);
    current.actualCost += money(ticket.total_cost);
    current.hours += money(ticket.billable_hours);
    map.set(key, current);
  });

  contracts
    .filter((contract) => contract.status === "active")
    .forEach((contract) => {
      const current =
        map.get(contract.client_id) ??
        {
          clientId: contract.client_id,
          clientName: fallbackClient,
          revenue: 0,
          labor: 0,
          materials: 0,
          actualCost: 0,
          margin: 0,
          marginPercent: 0,
          hours: 0,
        };
      current.revenue += normalizeRecurringFee(contract);
      map.set(contract.client_id, current);
    });

  return Array.from(map.values())
    .map((row) => {
      const revenue = row.revenue;
      const margin = revenue - row.actualCost;
      return {
        ...row,
        revenue,
        margin,
        marginPercent: revenue > 0 ? (margin / revenue) * 100 : 0,
      };
    })
    .sort((a, b) => b.margin - a.margin);
}

export function normalizeRecurringFee(contract: ContractLike) {
  return contract.billing_period === "annual" ? money(contract.recurring_fee) / 12 : money(contract.recurring_fee);
}

export function buildAccountingCsvRows(invoices: Array<Record<string, any>>) {
  return [
    [
      "Numero",
      "Cliente",
      "Data",
      "Scadenza",
      "Imponibile",
      "IVA",
      "Totale",
      "Pagato",
      "Stato",
      "Valuta",
    ],
    ...invoices.map((invoice) => [
      invoice.invoice_number,
      invoice.recipient_name ?? invoice.client?.company_name ?? invoice.client?.name ?? "",
      invoice.issue_date,
      invoice.due_date ?? "",
      invoice.subtotal ?? 0,
      invoice.tax_amount ?? 0,
      invoice.total_amount ?? 0,
      invoice.paid_amount ?? 0,
      invoice.status,
      invoice.currency ?? "EUR",
    ]),
  ];
}

export function buildFatturaPaXml(invoice: Record<string, any>, items: Array<Record<string, any>>) {
  const total = money(invoice.total_amount).toFixed(2);
  const body = items
    .map(
      (item, index) => `
      <DettaglioLinee>
        <NumeroLinea>${index + 1}</NumeroLinea>
        <Descrizione>${escapeXml(item.description ?? "Servizio")}</Descrizione>
        <Quantita>${money(item.quantity).toFixed(2)}</Quantita>
        <PrezzoUnitario>${money(item.unit_price).toFixed(2)}</PrezzoUnitario>
        <PrezzoTotale>${money(item.line_total).toFixed(2)}</PrezzoTotale>
        <AliquotaIVA>${money(invoice.tax_rate).toFixed(2)}</AliquotaIVA>
      </DettaglioLinee>`,
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<FatturaElettronica versione="FPR12">
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>TD01</TipoDocumento>
        <Divisa>${escapeXml(invoice.currency ?? "EUR")}</Divisa>
        <Data>${escapeXml(invoice.issue_date ?? "")}</Data>
        <Numero>${escapeXml(invoice.invoice_number ?? "")}</Numero>
        <ImportoTotaleDocumento>${total}</ImportoTotaleDocumento>
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>${body}
      <DatiRiepilogo>
        <AliquotaIVA>${money(invoice.tax_rate).toFixed(2)}</AliquotaIVA>
        <ImponibileImporto>${money(invoice.subtotal).toFixed(2)}</ImponibileImporto>
        <Imposta>${money(invoice.tax_amount).toFixed(2)}</Imposta>
      </DatiRiepilogo>
    </DatiBeniServizi>
  </FatturaElettronicaBody>
</FatturaElettronica>`;
}

export function escapeXml(value: string) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
