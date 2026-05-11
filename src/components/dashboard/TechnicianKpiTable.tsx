import type { TechnicianKpi } from "@/lib/dashboard-analytics";
import { formatAvgDays } from "./analytics-format";

export function TechnicianKpiTable({ rows }: { rows: TechnicianKpi[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr>
            {["Tecnico", "Ticket assegnati", "Ticket completati", "Tempo medio"].map((h) => (
              <th
                key={h}
                className="text-left px-[14px] py-[9px] text-[10.5px] font-bold uppercase tracking-wider text-text3 border-b"
                style={{ background: "var(--surface2)", borderColor: "var(--border)" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.technician_id ?? "unassigned"} className="border-b" style={{ borderColor: "var(--border)" }}>
              <td className="px-[14px] py-[10px] text-[12.5px] font-semibold">{row.full_name}</td>
              <td className="px-[14px] py-[10px] text-[12.5px] font-mono text-text3">{row.assigned}</td>
              <td className="px-[14px] py-[10px] text-[12.5px] font-mono text-text3">{row.completed}</td>
              <td className="px-[14px] py-[10px] text-[12.5px] font-mono text-text3">
                {formatAvgDays(row.avg_days)}
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={4} className="text-center py-8 text-text3 text-sm">
                Nessun dato tecnico nel periodo selezionato.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
