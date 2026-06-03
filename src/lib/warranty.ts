import { pcReadyColors } from "@/lib/design-system";

/**
 *
 */
export type WarrantyType = "standard" | "extended" | "onsite" | "none";
/**
 *
 */
export type WarrantyStatus = "valid" | "expiring" | "urgent" | "expired" | "missing";
/**
 *
 */
export type WarrantyFilter = "all" | WarrantyStatus;

/**
 *
 */
export type WarrantyFields = {
  purchase_date?: string | null;
  warranty_expiry_date?: string | null;
  warranty_type?: WarrantyType | string | null;
  warranty_provider?: string | null;
  warranty_notes?: string | null;
};

export const WARRANTY_TYPES: { value: WarrantyType; label: string }[] = [
  { value: "standard", label: "Standard" },
  { value: "extended", label: "Estesa" },
  { value: "onsite", label: "On-site" },
  { value: "none", label: "Nessuna" },
];

export const WARRANTY_STATUS_META: Record<
  WarrantyStatus,
  { label: string; color: string; background: string }
> = {
  valid: {
    label: "In garanzia",
    color: pcReadyColors.success,
    background: pcReadyColors.successLight,
  },
  expiring: {
    label: "In scadenza",
    color: pcReadyColors.warning,
    background: pcReadyColors.warningLight,
  },
  urgent: {
    label: "Urgente",
    color: pcReadyColors.warning,
    background: pcReadyColors.warningLight,
  },
  expired: { label: "Scaduta", color: pcReadyColors.danger, background: pcReadyColors.dangerLight },
  missing: {
    label: "N/D",
    color: pcReadyColors.textSecondary,
    background: pcReadyColors.slateLight,
  },
};

/**
 *
 */
export function todayDateOnly(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 *
 */
export function parseDateOnly(value?: string | null) {
  if (!value) return null;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

/**
 *
 */
export function daysUntil(date?: string | null, now = new Date()) {
  const target = parseDateOnly(date);
  if (!target) return null;
  const today = todayDateOnly(now);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

/**
 *
 */
export function getWarrantyStatus(expiryDate?: string | null, now = new Date()): WarrantyStatus {
  const days = daysUntil(expiryDate, now);
  if (days === null) return "missing";
  if (days < 0) return "expired";
  if (days <= 30) return "urgent";
  if (days <= 90) return "expiring";
  return "valid";
}

/**
 *
 */
export function warrantyStatusLabel(status: WarrantyStatus) {
  return WARRANTY_STATUS_META[status].label;
}

/**
 *
 */
export function warrantyProgress(fields: WarrantyFields, now = new Date()) {
  const purchase = parseDateOnly(fields.purchase_date);
  const expiry = parseDateOnly(fields.warranty_expiry_date);
  if (!purchase || !expiry || expiry.getTime() <= purchase.getTime()) {
    return {
      percent: null as number | null,
      elapsedDays: null as number | null,
      totalDays: null as number | null,
    };
  }
  const today = todayDateOnly(now).getTime();
  const totalMs = expiry.getTime() - purchase.getTime();
  const elapsedMs = Math.min(Math.max(today - purchase.getTime(), 0), totalMs);
  return {
    percent: Math.round((elapsedMs / totalMs) * 100),
    elapsedDays: Math.round(elapsedMs / 86400000),
    totalDays: Math.round(totalMs / 86400000),
  };
}

/**
 *
 */
export function isProbablyUrl(value?: string | null) {
  if (!value) return false;
  return /^https?:\/\//i.test(value.trim());
}

/**
 *
 */
export function toDateInputValue(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}
