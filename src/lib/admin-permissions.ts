import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ALL_PERMISSIONS } from "@/lib/auth-context";
import { requireAdmin } from "./admin-users.server";
import { z } from "zod";

/**
 *
 */
export interface RolePermissions {
  role: string;
  permissions: string[];
}

/**
 * Lists all role-permission assignments for every role.
 * Admin always returns all permissions (not stored in DB).
 */
const PermAuthedSchema = z.object({ accessToken: z.string() });
const PermSaveSchema = z.object({ accessToken: z.string(), role: z.string(), permissions: z.array(z.string()) });

export const listRolePermissions = createServerFn({ method: "POST" })
  .validator(PermAuthedSchema)
  .handler(async ({ data }): Promise<RolePermissions[]> => {
    await requireAdmin(data.accessToken);

    const { data: rows, error } = await (supabaseAdmin as any)
      .from("role_permissions")
      .select("role, permission")
      .order("role");

    if (error) throw new Error(error.message);

    // Group by role
    const map = new Map<string, string[]>();

    // Admin always has all permissions
    map.set("admin", [...ALL_PERMISSIONS]);

    // Ensure tech and viewer are present
    if (!map.has("tech")) map.set("tech", []);
    if (!map.has("viewer")) map.set("viewer", []);

    for (const row of rows ?? []) {
      if (!map.has(row.role)) map.set(row.role, []);
      if (row.role !== "admin") {
        map.get(row.role)!.push(row.permission);
      }
    }

    return Array.from(map.entries())
      .filter(([role]) => role !== "admin") // Admin displayed as immutable
      .map(([role, permissions]) => ({ role, permissions }));
  });

/**
 * Saves (upserts) permissions for a single role.
 * Admin permissions are immutable and cannot be changed.
 */
export const saveRolePermissions = createServerFn({ method: "POST" })
  .validator(PermSaveSchema)
  .handler(async ({ data }) => {
    await requireAdmin(data.accessToken);

    if (data.role === "admin") {
      throw new Response("I permessi admin non sono modificabili", { status: 400 });
    }

    if (!["tech", "viewer"].includes(data.role)) {
      throw new Response("Ruolo non valido", { status: 400 });
    }

    // Validate all permissions are known
    const validPermissions = data.permissions.every((p) =>
      (ALL_PERMISSIONS as readonly string[]).includes(p),
    );
    if (!validPermissions) {
      throw new Response("Permesso non valido", { status: 400 });
    }

    // Delete and insert within a transaction for atomicity
    const { error: txError } = await (supabaseAdmin as any).rpc("replace_role_permissions", {
      _role: data.role,
      _permissions: data.permissions,
    });

    // Fallback: if the RPC doesn't exist (migration not yet applied), use two-step
    if (txError) {
      const { error: deleteError } = await (supabaseAdmin as any)
        .from("role_permissions")
        .delete()
        .eq("role", data.role);

      if (deleteError) throw new Error(deleteError.message);

      if (data.permissions.length > 0) {
        const inserts = data.permissions.map((permission) => ({
          role: data.role,
          permission,
        }));

        const { error: insertError } = await (supabaseAdmin as any)
          .from("role_permissions")
          .insert(inserts);

        if (insertError) throw new Error(insertError.message);
      }
    }

    return { ok: true };
  });
