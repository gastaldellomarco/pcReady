import type { AppRole } from "@/lib/auth-context";

export const ADMIN_ROLES: AppRole[] = ["admin", "tech", "viewer"];

export const ADMIN_WIP_LIMIT_FIELDS = [
  ["pending", "In attesa"],
  ["in-progress", "In lavorazione"],
  ["testing", "Testing"],
  ["ready", "Pronto"],
  ["completed", "Completato"],
  ["archived", "Archiviato"],
] as const;

export function isAppRole(value: string): value is AppRole {
  return value === "admin" || value === "tech" || value === "viewer";
}

export function adminRoleLabel(role: AppRole) {
  if (role === "admin") return "Amministratore";
  if (role === "tech") return "Tecnico";
  return "Visualizzatore";
}
