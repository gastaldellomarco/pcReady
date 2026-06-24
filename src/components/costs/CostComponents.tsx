import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCurrency, formatHours } from "./helpers";

type CostGroup = { name: string; hours: number; total: number; materials: number; labor: number };

export function FinanceTable({
  title,
  empty,
  emptyIcon,
  emptyAction,
  actions,
  children,
}: {
  title: string;
  empty: string;
  emptyIcon?: ReactNode;
  emptyAction?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="pc-card overflow-hidden">
      <div className="pc-card-hd">
        <div className="pc-card-title">{title}</div>
        {actions}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-[12.5px]">
          <thead style={{ background: "var(--surface2)" }}>
            <tr>
              {["Numero", "Cliente", "Totale", "Stato", "Azioni"].map((header) => (
                <th
                  key={header}
                  className="px-3 py-2 text-left text-[10.5px] font-bold uppercase text-text3"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {children}
            {Array.isArray(children) && children.length === 0 && (
              <tr>
                <td className="px-3 py-10 text-center" colSpan={5}>
                  <div className="flex flex-col items-center gap-2 text-text3">
                    {emptyIcon && <div className="text-text4">{emptyIcon}</div>}
                    <div className="text-sm">{empty}</div>
                    {emptyAction && <div className="mt-1">{emptyAction}</div>}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CostStat({
  label,
  value,
  tone = "default",
  helpText,
}: {
  label: string;
  value: string;
  tone?: "default" | "success";
  helpText?: string;
}) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-text3">
        {label}
        {helpText && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex cursor-help">
                  <Info className="h-3.5 w-3.5 text-text3 hover:text-text2 transition-colors" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[260px] text-xs leading-relaxed">
                {helpText}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <div
        className="mt-2 text-xl font-bold"
        style={{ color: tone === "success" ? "var(--success)" : "var(--text)" }}
      >
        {value}
      </div>
    </div>
  );
}

export function SummaryTable({
  title,
  rows,
  onRowClick,
}: {
  title: string;
  rows: CostGroup[];
  onRowClick?: (name: string) => void;
}) {
  const { t } = useTranslation("costs");
  return (
    <div className="pc-card overflow-hidden">
      <div className="pc-card-hd">
        <div className="pc-card-title">{title}</div>
        {onRowClick && rows.length > 0 && (
          <div className="text-[10.5px] text-text3">
            {t("summaryTables.clickHint", "Clicca per dettaglio")}
          </div>
        )}
      </div>
      <table className="w-full text-[12.5px]">
        <thead style={{ background: "var(--surface2)" }}>
          <tr>
            <th className="px-3 py-2 text-left text-[10.5px] font-bold uppercase text-text3">
              {t("summaryTables.nameHeader", "Nome")}
            </th>
            <th className="px-3 py-2 text-right text-[10.5px] font-bold uppercase text-text3">
              {t("summaryTables.hoursHeader", "Ore")}
            </th>
            <th className="px-3 py-2 text-right text-[10.5px] font-bold uppercase text-text3">
              {t("summaryTables.totalHeader", "Totale")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 8).map((row) => (
            <tr
              key={row.name}
              className={`border-t ${onRowClick ? "cursor-pointer transition-colors hover:bg-surface2" : ""}`}
              style={{ borderColor: "var(--border)" }}
              tabIndex={onRowClick ? 0 : undefined}
              role={onRowClick ? "button" : undefined}
              onClick={() => onRowClick?.(row.name)}
              onKeyDown={(e) => {
                if (onRowClick && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onRowClick(row.name);
                }
              }}
            >
              <td className="px-3 py-2 font-semibold">{row.name}</td>
              <td className="px-3 py-2 text-right font-mono">{formatHours(row.hours)}</td>
              <td className="px-3 py-2 text-right font-mono font-bold">
                {formatCurrency(row.total)}
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td className="px-3 py-6 text-center text-text3" colSpan={3}>
                {t("summaryTables.noData", "Nessun dato")}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function ContractMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface2 p-3">
      <div className="text-[10px] font-bold uppercase tracking-wide text-text3">{label}</div>
      <div className="mt-1 font-mono text-sm font-bold">{value}</div>
    </div>
  );
}
