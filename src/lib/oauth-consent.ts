"use server";

import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { AUDIT_ACTIONS } from "@/lib/audit-log-actions";
import { throwIfRateLimited } from "@/lib/rate-limit";
import { RATE_LIMITER_KEYS } from "@/lib/rate-limit-config";
import type { Database } from "@/integrations/supabase/types";
import type { OAuthScope } from "@/lib/oauth-scopes";
import { randomBytes } from "node:crypto";

/**
 *
 */
export type OAuthClientStatus = Database["public"]["Enums"]["oauth_client_status"];
import { z } from "zod";

interface DenyConsentInput {
  clientId: string;
  redirectUri: string;
  state?: string;
}

const OAuthAuthedSchema = z.object({ accessToken: z.string() });
const OAuthValidateSchema = z.object({ accessToken: z.string(), clientId: z.string(), redirectUri: z.string(), scope: z.string(), state: z.string().optional() });
const OAuthGrantSchema = z.object({ accessToken: z.string(), clientId: z.string(), redirectUri: z.string(), scopes: z.array(z.string()), state: z.string().optional() });
const OAuthCreateClientSchema = z.object({ accessToken: z.string(), name: z.string(), description: z.string().optional(), redirectUris: z.array(z.string()), scopesAllowed: z.array(z.string()) });
const OAuthStatusSchema = z.object({ accessToken: z.string(), clientId: z.string(), nextStatus: z.string() });
const OAuthRotateSchema = z.object({ accessToken: z.string(), clientId: z.string() });
const OAuthLifecycleSchema = z.object({ accessToken: z.string(), clientId: z.string() });
const OAuthDenySchema = z.object({ clientId: z.string(), redirectUri: z.string(), state: z.string().optional() });

async function requireAdminUserId(accessToken: string): Promise<{ userId: string }> {
  const token = accessToken?.trim();
  if (!token) throw new Response("Unauthorized", { status: 401 });
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) throw new Response("Unauthorized", { status: 401 });
  const { data: roleData, error: roleError } = await supabaseAdmin.rpc("has_role", {
    _user_id: authData.user.id,
    _role: "admin",
  });
  if (roleError || !roleData) throw new Response("Forbidden", { status: 403 });
  return { userId: authData.user.id };
}

async function logOAuthClientAudit(params: {
  actorId: string;
  actionType: string;
  clientId: string;
  message: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
}) {
  const { error } = await supabaseAdmin.from("activity_log" as any).insert({
    type: "user",
    action_type: params.actionType,
    actor_id: params.actorId,
    entity_type: "oauth_client",
    entity_id: params.clientId,
    severity: "info",
    message: params.message,
    old_value: params.oldValue ?? null,
    new_value: params.newValue ?? null,
  });
  if (error) console.error("[oauth] activity_log insert failed", error);
}

/** Costruisce l'URL di redirect per consenso negato (usata anche dai test). */
export function buildDenyConsentRedirect(data: DenyConsentInput): string {
  const params = new URLSearchParams({
    error: "access_denied",
    error_description: "User denied access",
    ...(data.state && { state: data.state }),
  });
  return `${data.redirectUri}?${params.toString()}`;
}

/**
 *
 */
export function invalidOAuthScopesAgainstAllowed(
  requestedScopes: OAuthScope[],
  allowed: OAuthScope[],
): OAuthScope[] {
  return requestedScopes.filter((scope) => !allowed.includes(scope));
}

/**
 *
 */
export interface OAuthClientInfo {
  clientId: string;
  name: string;
  description?: string;
  scopesAllowed: OAuthScope[];
  redirectUris: string[];
  status: OAuthClientStatus;
  lastUsedAt: string | null;
  createdAt: string;
}

/** Risposta di creazione: include il secret mostrato una sola volta. */
export interface OAuthClientCreated extends OAuthClientInfo {
  clientSecret: string;
}

/**
 *
 */
export interface OAuthValidationResult {
  client: OAuthClientInfo;
  requestedScopes: OAuthScope[];
  state?: string;
}

/**
 *
 */
export interface OAuthConsentHistoryRow {
  userId: string;
  userName: string | null;
  scopesGranted: OAuthScope[];
  grantedAt: string;
  revokedAt: string | null;
  expiresAt: string | null;
}

/**
 *
 */
export interface OAuthAuthorizationEventRow {
  createdAt: string;
  expiresAt: string;
  redeemed: boolean;
}

/**
 *
 */
export interface OAuthAdminEventRow {
  id: string;
  message: string;
  createdAt: string;
  actionType: string | null;
  actorId: string | null;
}

/**
 *
 */
export interface OAuthClientLifecyclePayload {
  consents: OAuthConsentHistoryRow[];
  authorizationEvents: OAuthAuthorizationEventRow[];
  adminEvents: OAuthAdminEventRow[];
}

// Validate OAuth request parameters
export const validateOAuthRequest = createServerFn({ method: "POST" })
  .validator(OAuthValidateSchema)
  .handler(async ({ data }): Promise<OAuthValidationResult> => {
    const token = data.accessToken?.trim();
    if (!token) throw new Response("Unauthorized", { status: 401 });

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData.user) throw new Response("Unauthorized", { status: 401 });

    const { data: client, error: clientError } = await supabaseAdmin
      .from("oauth_clients")
      .select(
        "client_id, name, description, redirect_uris, scopes_allowed, status, last_used_at, created_at",
      )
      .eq("client_id", data.clientId)
      .single();

    if (clientError || !client) {
      throw new Response("Invalid client_id", { status: 400 });
    }

    const clientAny = client as any;
    if (clientAny.status && clientAny.status !== "active") {
      throw new Response("Client OAuth disattivato o revocato", { status: 403 });
    }

    if (!clientAny.redirect_uris || !clientAny.redirect_uris.includes(data.redirectUri)) {
      throw new Response("Invalid redirect_uri", { status: 400 });
    }

    const requestedScopes = data.scope.split(" ").filter(Boolean) as OAuthScope[];
    const invalidScopes = invalidOAuthScopesAgainstAllowed(
      requestedScopes,
      (clientAny.scopes_allowed || []) as OAuthScope[],
    );
    if (invalidScopes.length > 0) {
      throw new Response(`Invalid scopes: ${invalidScopes.join(", ")}`, { status: 400 });
    }

    return {
      client: {
        clientId: clientAny.client_id,
        name: clientAny.name,
        description: clientAny.description,
        scopesAllowed: clientAny.scopes_allowed || [],
        redirectUris: clientAny.redirect_uris || [],
        status: clientAny.status ?? "active",
        lastUsedAt: clientAny.last_used_at ?? null,
        createdAt: clientAny.created_at,
      },
      requestedScopes,
      state: data.state,
    };
  });

// Grant consent and generate authorization code
export const grantConsent = createServerFn({ method: "POST" })
  .validator(OAuthGrantSchema)
  .handler(async ({ data }): Promise<{ redirectUrl: string }> => {
    const token = data.accessToken?.trim();
    if (!token) throw new Response("Unauthorized", { status: 401 });

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData.user) throw new Response("Unauthorized", { status: 401 });

    const userId = authData.user.id;

    const { data: clientRow, error: clientErr } = await supabaseAdmin
      .from("oauth_clients")
      .select("status")
      .eq("client_id", data.clientId)
      .single();
    if (clientErr || !clientRow) throw new Response("Invalid client", { status: 400 });
    if ((clientRow as any).status !== "active") {
      throw new Response("Client OAuth disattivato o revocato", { status: 403 });
    }

    const codeBytes = new Uint8Array(32);
    crypto.getRandomValues(codeBytes);
    const authCode = Array.from(codeBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const nowIso = new Date().toISOString();

    const { error: insertError } = await supabaseAdmin
      .from("oauth_authorization_codes" as any)
      .insert({
        code: authCode,
        user_id: userId,
        client_id: data.clientId,
        scopes_granted: data.scopes,
        redirect_uri: data.redirectUri,
        state: data.state,
        expires_at: expiresAt,
      } as any);

    if (insertError) {
      throw new Response("Failed to generate authorization code", { status: 500 });
    }

    await supabaseAdmin
      .from("oauth_clients")
      .update({ last_used_at: nowIso, updated_at: nowIso })
      .eq("client_id", data.clientId);

    const params = new URLSearchParams({
      code: authCode,
      ...(data.state && { state: data.state }),
    });

    return {
      redirectUrl: `${data.redirectUri}?${params.toString()}`,
    };
  });

// List OAuth clients (admin only)
export const listOAuthClients = createServerFn({ method: "POST" })
  .validator(OAuthAuthedSchema)
  .handler(async ({ data }): Promise<OAuthClientInfo[]> => {
    const { userId } = await requireAdminUserId(data.accessToken);
    void userId;

    const { data: clients, error: clientsError } = await supabaseAdmin
      .from("oauth_clients")
      .select(
        "client_id, name, description, redirect_uris, scopes_allowed, status, last_used_at, created_at",
      )
      .order("created_at", { ascending: false });

    if (clientsError) throw new Response("Failed to fetch clients", { status: 500 });

    const clientsArr = (clients ?? []) as any[];
    return clientsArr.map((client: any) => ({
      clientId: client.client_id,
      name: client.name,
      description: client.description,
      scopesAllowed: client.scopes_allowed || [],
      redirectUris: client.redirect_uris || [],
      status: (client.status ?? "active") as OAuthClientStatus,
      lastUsedAt: client.last_used_at ?? null,
      createdAt: client.created_at,
    }));
  });

// Create OAuth client (admin only)
export const createOAuthClient = createServerFn({ method: "POST" })
  .validator(OAuthCreateClientSchema)
  .handler(async ({ data }): Promise<OAuthClientCreated> => {
    const { userId } = await requireAdminUserId(data.accessToken);

    throwIfRateLimited(userId, RATE_LIMITER_KEYS.CREATE_OAUTH_CLIENT);

    const clientId = `pcready_${Date.now()}_${randomBytes(8).toString("base64url")}`;
    const clientSecret = `secret_${Date.now()}_${randomBytes(16).toString("base64url")}`;

    const { data: client, error: clientError } = await supabaseAdmin
      .from("oauth_clients")
      .insert({
        client_id: clientId,
        client_secret: clientSecret,
        name: data.name,
        description: data.description,
        redirect_uris: data.redirectUris,
        scopes_allowed: data.scopesAllowed,
        created_by: userId,
      } as any)
      .select(
        "client_id, name, description, redirect_uris, scopes_allowed, status, last_used_at, created_at",
      )
      .single();

    if (clientError) throw new Response("Failed to create client", { status: 500 });

    const clientAny = client as any;
    await logOAuthClientAudit({
      actorId: userId,
      actionType: AUDIT_ACTIONS.OAUTH_CLIENT_CREATED,
      clientId: clientAny.client_id,
      message: `Client OAuth creato: ${clientAny.name} (${clientAny.client_id})`,
      newValue: { name: clientAny.name, redirect_count: data.redirectUris.length },
    });

    return {
      clientId: clientAny.client_id,
      clientSecret,
      name: clientAny.name,
      description: clientAny.description,
      scopesAllowed: clientAny.scopes_allowed || [],
      redirectUris: clientAny.redirect_uris || [],
      status: (clientAny.status ?? "active") as OAuthClientStatus,
      lastUsedAt: clientAny.last_used_at ?? null,
      createdAt: clientAny.created_at,
    };
  });

export const setOAuthClientStatus = createServerFn({ method: "POST" })
  .validator(OAuthStatusSchema)
  .handler(async ({ data }): Promise<{ ok: true; status: OAuthClientStatus }> => {
    const { userId } = await requireAdminUserId(data.accessToken);

    const { data: row, error: fetchErr } = await supabaseAdmin
      .from("oauth_clients")
      .select("status, name")
      .eq("client_id", data.clientId)
      .single();
    if (fetchErr || !row) throw new Response("Client non trovato", { status: 404 });

    const prev = (row as any).status as OAuthClientStatus;
    const next = data.nextStatus as OAuthClientStatus;
    if (prev === "revoked") {
      throw new Response("Client gia' revocato: non e' possibile modificarlo.", { status: 400 });
    }
    if (next === prev) return { ok: true, status: prev };

    const nowIso = new Date().toISOString();
    const { error: upErr } = await supabaseAdmin
      .from("oauth_clients")
      .update({ status: next, updated_at: nowIso })
      .eq("client_id", data.clientId);
    if (upErr) throw new Response("Aggiornamento non riuscito", { status: 500 });

    const name = (row as any).name as string;
    const actionType =
      next === "active"
        ? AUDIT_ACTIONS.OAUTH_CLIENT_ENABLED
        : next === "revoked"
          ? AUDIT_ACTIONS.OAUTH_CLIENT_REVOKED
          : AUDIT_ACTIONS.OAUTH_CLIENT_DISABLED;
    const message =
      next === "active"
        ? `Client OAuth riattivato: ${name} (${data.clientId})`
        : next === "revoked"
          ? `Client OAuth revocato: ${name} (${data.clientId})`
          : `Client OAuth disattivato: ${name} (${data.clientId})`;

    await logOAuthClientAudit({
      actorId: userId,
      actionType,
      clientId: data.clientId,
      message,
      oldValue: { status: prev },
      newValue: { status: next },
    });

    return { ok: true, status: next };
  });

export const rotateOAuthClientSecret = createServerFn({ method: "POST" })
  .validator(OAuthRotateSchema)
  .handler(async ({ data }): Promise<{ clientId: string; clientSecret: string }> => {
    const { userId } = await requireAdminUserId(data.accessToken);

    const newSecret = `secret_${Date.now()}_${randomBytes(16).toString("base64url")}`;
    const nowIso = new Date().toISOString();

    const { data: updated, error } = await supabaseAdmin
      .from("oauth_clients")
      .update({ client_secret: newSecret, updated_at: nowIso })
      .eq("client_id", data.clientId)
      .select("name, status")
      .single();

    if (error || !updated)
      throw new Response("Client non trovato o aggiornamento fallito", { status: 400 });
    if ((updated as any).status !== "active") {
      throw new Response("Ruota il secret solo per client attivi (riattiva prima se necessario).", {
        status: 400,
      });
    }

    await logOAuthClientAudit({
      actorId: userId,
      actionType: AUDIT_ACTIONS.OAUTH_CLIENT_SECRET_ROTATED,
      clientId: data.clientId,
      message: `Secret OAuth ruotato per ${(updated as any).name} (${data.clientId})`,
      newValue: { rotated_at: nowIso },
    });

    return { clientId: data.clientId, clientSecret: newSecret };
  });

export const getOAuthClientLifecycle = createServerFn({ method: "POST" })
  .validator(OAuthLifecycleSchema)
  .handler(async ({ data }): Promise<OAuthClientLifecyclePayload> => {
    await requireAdminUserId(data.accessToken);
    const clientId = data.clientId;

    const { data: consents, error: cErr } = await supabaseAdmin
      .from("oauth_consents")
      .select("user_id, scopes_granted, granted_at, revoked_at, expires_at")
      .eq("client_id", clientId)
      .order("granted_at", { ascending: false })
      .limit(100);
    if (cErr) throw new Response("Impossibile caricare i consensi", { status: 500 });

    const userIds = [...new Set((consents ?? []).map((c: any) => c.user_id as string))];
    let nameById = new Map<string, string | null>();
    if (userIds.length > 0) {
      const { data: profiles, error: pErr } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      if (!pErr && profiles) {
        nameById = new Map(
          (profiles as any[]).map((p) => [p.id as string, p.full_name as string | null]),
        );
      }
    }

    const consentRows: OAuthConsentHistoryRow[] = (consents ?? []).map((c: any) => ({
      userId: c.user_id,
      userName: nameById.get(c.user_id) ?? null,
      scopesGranted: (c.scopes_granted || []) as OAuthScope[],
      grantedAt: c.granted_at,
      revokedAt: c.revoked_at ?? null,
      expiresAt: c.expires_at ?? null,
    }));

    const { data: codes, error: codeErr } = await supabaseAdmin
      .from("oauth_authorization_codes")
      .select("created_at, expires_at, used_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (codeErr)
      throw new Response("Impossibile caricare i codici di autorizzazione", { status: 500 });

    const authorizationEvents: OAuthAuthorizationEventRow[] = (codes ?? []).map((row: any) => ({
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      redeemed: !!row.used_at,
    }));

    const { data: logs, error: logErr } = await supabaseAdmin
      .from("activity_log")
      .select("id, message, created_at, action_type, actor_id")
      .eq("entity_type", "oauth_client")
      .eq("entity_id", clientId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (logErr) throw new Response("Impossibile caricare il log amministrativo", { status: 500 });

    const adminEvents: OAuthAdminEventRow[] = (logs ?? []).map((row: any) => ({
      id: row.id,
      message: row.message,
      createdAt: row.created_at,
      actionType: row.action_type ?? null,
      actorId: row.actor_id ?? null,
    }));

    return { consents: consentRows, authorizationEvents, adminEvents };
  });

// Deny consent
export const denyConsent = createServerFn({ method: "POST" })
  .validator(OAuthDenySchema)
  .handler(async ({ data }): Promise<{ redirectUrl: string }> => {
    return {
      redirectUrl: buildDenyConsentRedirect(data),
    };
  });
