import { createServerFn } from "@tanstack/react-start";
import { createHash } from "node:crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CreateShareLinkSchema = z.object({
  accessToken: z.string().min(1),
  scriptId: z.string().uuid(),
  password: z.string().min(1),
  expiresInHours: z.number().int().min(1).max(720).nullable().optional(),
});

const ValidateShareLinkSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(1),
});

const RevokeShareLinkSchema = z.object({
  accessToken: z.string().min(1),
  linkId: z.string().uuid(),
});

const ListShareLinksSchema = z.object({
  accessToken: z.string().min(1),
  scriptId: z.string().uuid(),
});

function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 40; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

function sha256Hash(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export const createScriptShareLink = createServerFn({ method: "POST" })
  .validator(CreateShareLinkSchema)
  .handler(async ({ data: validated }) => {
    const supabaseAny = supabaseAdmin as any;

    // Authenticate and get the creator user
    const { data: userData, error: userError } =
      await supabaseAdmin.auth.getUser(validated.accessToken);
    if (userError || !userData.user)
      throw new Response("Non autenticato", { status: 401 });

    const token = generateToken();
    const passwordHash = sha256Hash(validated.password);
    const expiresAt = validated.expiresInHours
      ? new Date(Date.now() + validated.expiresInHours * 3600_000).toISOString()
      : null;

    const { data: link, error } = await supabaseAny
      .from("script_share_links")
      .insert({
        script_id: validated.scriptId,
        token,
        password_hash: passwordHash,
        expires_at: expiresAt,
        created_by: userData.user.id,
      })
      .select("id, token, expires_at, created_at")
      .single();

    if (error) throw error;
    return link;
  });

export const validateScriptShareToken = createServerFn({ method: "POST" })
  .validator(ValidateShareLinkSchema)
  .handler(async ({ data: validated }) => {
    const supabaseAny = supabaseAdmin as any;

    const { data: link, error } = await supabaseAny
      .from("script_share_links")
      .select("id, script_id, password_hash, expires_at, is_revoked")
      .eq("token", validated.token)
      .single();

    if (error || !link) return { ok: false, reason: "token_invalid" };
    if (link.is_revoked) return { ok: false, reason: "token_revoked" };
    if (link.expires_at && new Date(link.expires_at) < new Date())
      return { ok: false, reason: "token_expired" };

    const hashedInput = sha256Hash(validated.password);
    if (hashedInput !== link.password_hash)
      return { ok: false, reason: "wrong_password" };

    const { data: script, error: scriptError } = await supabaseAny
      .from("scripts")
      .select("id, name, description, language, content, category")
      .eq("id", link.script_id)
      .single();

    if (scriptError || !script) return { ok: false, reason: "script_not_found" };
    return { ok: true, data: script };
  });

export const revokeScriptShareLink = createServerFn({ method: "POST" })
  .validator(RevokeShareLinkSchema)
  .handler(async ({ data: validated }) => {
    const supabaseAny = supabaseAdmin as any;

    const { error } = await supabaseAny
      .from("script_share_links")
      .update({ is_revoked: true })
      .eq("id", validated.linkId);

    if (error) throw error;
    return { ok: true };
  });

export const listScriptShareLinks = createServerFn({ method: "POST" })
  .validator(ListShareLinksSchema)
  .handler(async ({ data: validated }) => {
    const supabaseAny = supabaseAdmin as any;

    const { data: links, error } = await supabaseAny
      .from("script_share_links")
      .select("id, token, expires_at, is_revoked, created_at")
      .eq("script_id", validated.scriptId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return links ?? [];
  });

const ListAllShareLinksSchema = z.object({
  accessToken: z.string().min(1),
});

export const listAllScriptShareLinks = createServerFn({ method: "POST" })
  .validator(ListAllShareLinksSchema)
  .handler(async ({ data: _validated }) => {
    const supabaseAny = supabaseAdmin as any;

    const { data: links, error } = await supabaseAny
      .from("script_share_links")
      .select(`
        id, token, expires_at, is_revoked, created_at, created_by,
        scripts!inner(id, name, category, language)
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;
    const rows = (links ?? []) as {
      id: string;
      token: string;
      expires_at: string | null;
      is_revoked: boolean | null;
      created_at: string | null;
      created_by: string | null;
      scripts: { id: string; name: string; category: string; language: string };
    }[];

    // Batch-fetch creator profiles
    const userIds = rows
      .map((r) => r.created_by)
      .filter((id): id is string => !!id);
    const uniqueIds = [...new Set(userIds)];
    const profileMap = new Map<string, string>();
    if (uniqueIds.length > 0) {
      const { data: profiles } = await supabaseAny
        .from("profiles")
        .select("id, full_name")
        .in("id", uniqueIds);
      if (profiles) {
        for (const p of profiles) {
          profileMap.set(p.id, p.full_name);
        }
      }
    }

    return rows.map((r) => ({
      ...r,
      creator_name: r.created_by ? (profileMap.get(r.created_by) ?? null) : null,
    }));
  });
