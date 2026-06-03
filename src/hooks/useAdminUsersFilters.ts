import { useMemo, useState } from "react";
import type { AdminUserRow } from "@/lib/admin-users";

/**
 *
 */
export function useAdminUsersFilters(rows: AdminUserRow[]) {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesText =
        !needle ||
        `${row.full_name} ${row.email ?? ""}`.toLowerCase().includes(needle);
      const matchesRole = !role || row.role === role;
      return matchesText && matchesRole;
    });
  }, [q, role, rows]);

  return { q, setQ, role, setRole, filtered };
}
