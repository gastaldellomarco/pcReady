"use server";

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { OAuthScope } from "@/lib/oauth-scopes";

interface AuthedInput {
  accessToken: string;
}

interface ValidateOAuthRequestInput extends AuthedInput {
  clientId: string;
  redirectUri: string;
  scope: string;
  state?: string;
}

interface GrantConsentInput extends AuthedInput {
  clientId: string;
  redirectUri: string;
  scopes: OAuthScope[];
  state?: string;
}

interface DenyConsentInput {
  clientId: string;
  redirectUri: string;
  state?: string;
}

export interface OAuthClientInfo {
  clientId: string;
  name: string;
  description?: string;
  scopesAllowed: OAuthScope[];
}

export interface OAuthValidationResult {
  client: OAuthClientInfo;
  requestedScopes: OAuthScope[];
  state?: string;
}

// Validate OAuth request parameters
export const validateOAuthRequest = createServerFn({ method: "POST" })
  .inputValidator((data: ValidateOAuthRequestInput) => data)
  .handler(async ({ data }): Promise<OAuthValidationResult> => {
    const token = data.accessToken?.trim();
    if (!token) throw new Response("Unauthorized", { status: 401 });

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData.user) throw new Response("Unauthorized", { status: 401 });

    // Validate client_id exists and redirect_uri is allowed
    const { data: client, error: clientError } = await supabaseAdmin
      .from('oauth_clients')
      .select('client_id, name, description, redirect_uris, scopes_allowed')
      .eq('client_id', data.clientId)
      .single();

    if (clientError || !client) {
      throw new Response("Invalid client_id", { status: 400 });
    }

    // Check redirect_uri is in allowed list
    if (!client.redirect_uris.includes(data.redirectUri)) {
      throw new Response("Invalid redirect_uri", { status: 400 });
    }

    // Parse and validate scopes
    const requestedScopes = data.scope.split(' ').filter(Boolean) as OAuthScope[];
    const invalidScopes = requestedScopes.filter(scope => !client.scopes_allowed.includes(scope));
    if (invalidScopes.length > 0) {
      throw new Response(`Invalid scopes: ${invalidScopes.join(', ')}`, { status: 400 });
    }

    return {
      client: {
        clientId: client.client_id,
        name: client.name,
        description: client.description,
        scopesAllowed: client.scopes_allowed
      },
      requestedScopes,
      state: data.state
    };
  });

// Grant consent and generate authorization code
export const grantConsent = createServerFn({ method: "POST" })
  .inputValidator((data: GrantConsentInput) => data)
  .handler(async ({ data }): Promise<{ redirectUrl: string }> => {
    const token = data.accessToken?.trim();
    if (!token) throw new Response("Unauthorized", { status: 401 });

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData.user) throw new Response("Unauthorized", { status: 401 });

    const userId = authData.user.id;

    // Generate authorization code (using crypto.getRandomValues for secure random)
    const codeBytes = new Uint8Array(32);
    crypto.getRandomValues(codeBytes);
    const authCode = Array.from(codeBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Store authorization code temporarily (10 minute expiration)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    
    const { error: insertError } = await supabaseAdmin
      .from('oauth_authorization_codes')
      .insert({
        code: authCode,
        user_id: userId,
        client_id: data.clientId,
        scopes_granted: data.scopes,
        redirect_uri: data.redirectUri,
        state: data.state,
        expires_at: expiresAt
      });

    if (insertError) {
      throw new Response("Failed to generate authorization code", { status: 500 });
    }

    // Build redirect URL
    const params = new URLSearchParams({
      code: authCode,
      ...(data.state && { state: data.state })
    });

    return {
      redirectUrl: `${data.redirectUri}?${params.toString()}`
    };
  });

interface CreateOAuthClientInput extends AuthedInput {
  name: string;
  description?: string;
  redirectUris: string[];
  scopesAllowed: OAuthScope[];
}

interface ListOAuthClientsInput extends AuthedInput {}

// List OAuth clients (admin only)
export const listOAuthClients = createServerFn({ method: "POST" })
  .inputValidator((data: ListOAuthClientsInput) => data)
  .handler(async ({ data }): Promise<OAuthClientInfo[]> => {
    const token = data.accessToken?.trim();
    if (!token) throw new Response("Unauthorized", { status: 401 });

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData.user) throw new Response("Unauthorized", { status: 401 });

    // Check admin role
    const { data: roleData, error: roleError } = await supabaseAdmin.rpc('has_role', {
      _user_id: authData.user.id,
      _role: 'admin'
    });
    if (roleError || !roleData) throw new Response("Forbidden", { status: 403 });

    const { data: clients, error: clientsError } = await supabaseAdmin
      .from('oauth_clients')
      .select('client_id, name, description, redirect_uris, scopes_allowed')
      .order('created_at', { ascending: false });

    if (clientsError) throw new Response("Failed to fetch clients", { status: 500 });

    return clients.map(client => ({
      clientId: client.client_id,
      name: client.name,
      description: client.description,
      scopesAllowed: client.scopes_allowed
    }));
  });

// Create OAuth client (admin only)
export const createOAuthClient = createServerFn({ method: "POST" })
  .inputValidator((data: CreateOAuthClientInput) => data)
  .handler(async ({ data }): Promise<OAuthClientInfo> => {
    const token = data.accessToken?.trim();
    if (!token) throw new Response("Unauthorized", { status: 401 });

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData.user) throw new Response("Unauthorized", { status: 401 });

    // Check admin role
    const { data: roleData, error: roleError } = await supabaseAdmin.rpc('has_role', {
      _user_id: authData.user.id,
      _role: 'admin'
    });
    if (roleError || !roleData) throw new Response("Forbidden", { status: 403 });

    // Generate client_id and secret
    const clientId = `pcready_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const clientSecret = `secret_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;

    const { data: client, error: clientError } = await supabaseAdmin
      .from('oauth_clients')
      .insert({
        client_id: clientId,
        client_secret: clientSecret,
        name: data.name,
        description: data.description,
        redirect_uris: data.redirectUris,
        scopes_allowed: data.scopesAllowed,
        created_by: authData.user.id
      })
      .select('client_id, name, description, redirect_uris, scopes_allowed')
      .single();

    if (clientError) throw new Response("Failed to create client", { status: 500 });

    return {
      clientId: client.client_id,
      name: client.name,
      description: client.description,
      scopesAllowed: client.scopes_allowed
    };
  });

// Deny consent
export const denyConsent = createServerFn({ method: "POST" })
  .inputValidator((data: DenyConsentInput) => data)
  .handler(async ({ data }): Promise<{ redirectUrl: string }> => {
    // Build redirect URL with error
    const params = new URLSearchParams({
      error: 'access_denied',
      error_description: 'User denied access',
      ...(data.state && { state: data.state })
    });

    return {
      redirectUrl: `${data.redirectUri}?${params.toString()}`
    };
  });