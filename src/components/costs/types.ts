export type TicketCostRow = {
  id: string;
  ticket_code: string;
  client_id: string | null;
  client_name: string | null;
  assignee_id: string | null;
  technician_name: string | null;
  status: string;
  priority: string;
  ticket_type: string;
  created_at: string;
  completed_at: string | null;
  billable_hours: number | null;
  hourly_rate: number | null;
  material_cost: number | null;
  labor_cost: number | null;
  total_cost: number | null;
  tracked_minutes: number | null;
};

export type ClientOption = { id: string; name: string; company_name: string | null };

export type ContractRow = {
  id: string;
  client_id: string;
  name: string;
  status: "active" | "paused" | "expired" | "draft";
  billing_period: "monthly" | "annual";
  recurring_fee: number;
  included_hours: number;
  extra_hourly_rate: number;
  start_date: string;
  end_date: string | null;
  notes: string | null;
  client?: ClientOption | null;
};

export type ContractDraft = {
  client_id: string;
  name: string;
  billing_period: "monthly" | "annual";
  recurring_fee: string;
  included_hours: string;
  extra_hourly_rate: string;
  start_date: string;
  end_date: string;
};

export type InvoiceRow = {
  id: string;
  client_id: string;
  invoice_number: string;
  status: "draft" | "sent" | "paid" | "partial" | "overdue" | "void";
  issue_date: string;
  due_date: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  sender_name: string | null;
  sender_address: string | null;
  recipient_name: string | null;
  recipient_address: string | null;
  notes: string | null;
  client?: ClientOption | null;
};

export type InvoiceItemRow = {
  id?: string;
  invoice_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total?: number;
  item_type?: string;
};

export type QuoteRow = {
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

export type QuoteItemRow = {
  id?: string;
  quote_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total?: number;
  item_type?: "service" | "labor" | "material" | "extra";
};

export type QuoteLineDraft = {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  itemType: "service" | "labor" | "material" | "extra";
};

export type BudgetUsageRow = {
  budget_id: string;
  client_id: string;
  client_name: string;
  period: "monthly" | "annual";
  budget_amount: number;
  alert_threshold_percent: number;
  used_amount: number;
  used_percent: number;
  alert_active: boolean;
  active: boolean;
  starts_on: string;
  ends_on: string | null;
};

export type PeriodicReportRow = {
  id: string;
  client_id: string;
  report_month: string;
  status: "scheduled" | "generated" | "sent" | "failed";
  email_to: string | null;
  sent_at: string | null;
  client?: ClientOption | null;
};

export type CostsTab = "dashboard" | "contracts" | "billing" | "report";
