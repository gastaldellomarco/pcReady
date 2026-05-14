import { createServerFn } from "@tanstack/react-start";

export type ExportTableName = "tickets" | "devices" | "clients";

export type ExportAllDataResult = {
  generatedAt: string;
  files: Record<ExportTableName, { filename: string; csv: string; rowCount: number }>;
};

export const exportAllData = createServerFn({ method: "GET" })
  .inputValidator((data: { accessToken: string }) => data)
  .handler(async ({ data: { accessToken } }): Promise<ExportAllDataResult> => {
    const { requireAdmin } = await import("./admin-users.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { throwIfRateLimited } = await import("@/lib/rate-limit");
    const { RATE_LIMITER_KEYS } = await import("@/lib/rate-limit-config");

    const actorId = await requireAdmin(accessToken);
    throwIfRateLimited(actorId, RATE_LIMITER_KEYS.EXPORT_ALL_DATA);

    const [ticketsRes, devicesRes, clientsRes] = await Promise.all([
      supabaseAdmin.from("tickets").select("*"),
      supabaseAdmin.from("devices").select("*"),
      supabaseAdmin.from("clients").select("*"),
    ]);

    if (ticketsRes.error) throw ticketsRes.error;
    if (devicesRes.error) throw devicesRes.error;
    if (clientsRes.error) throw clientsRes.error;

    const date = new Date().toISOString().slice(0, 10);

    return {
      generatedAt: new Date().toISOString(),
      files: {
        tickets: {
          filename: `tickets_export_${date}.csv`,
          csv: toCsv((ticketsRes.data ?? []) as Record<string, unknown>[]),
          rowCount: ticketsRes.data?.length ?? 0,
        },
        devices: {
          filename: `devices_export_${date}.csv`,
          csv: toCsv((devicesRes.data ?? []) as Record<string, unknown>[]),
          rowCount: devicesRes.data?.length ?? 0,
        },
        clients: {
          filename: `clients_export_${date}.csv`,
          csv: toCsv((clientsRes.data ?? []) as Record<string, unknown>[]),
          rowCount: clientsRes.data?.length ?? 0,
        },
      },
    };
  });

function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  return [
    columns.map(csvCell).join(","),
    ...rows.map((row) => columns.map((key) => csvCell(row[key])).join(",")),
  ].join("\n");
}

function csvCell(value: unknown) {
  if (value == null) return "";
  const normalized = typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}
