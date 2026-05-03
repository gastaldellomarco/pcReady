export type OAuthScope = 'openid' | 'profile' | 'email' | 'pcready:read' | 'pcready:write' | 'pcready:admin';

export interface ScopeDefinition {
  label: string;
  description: string;
}

export const OAUTH_SCOPES: Record<OAuthScope, ScopeDefinition> = {
  openid: {
    label: 'Identità',
    description: 'Accedi al tuo ID utente univoco'
  },
  profile: {
    label: 'Profilo',
    description: 'Leggi nome completo e iniziali'
  },
  email: {
    label: 'Email',
    description: 'Leggi il tuo indirizzo email'
  },
  'pcready:read': {
    label: 'Lettura dati',
    description: 'Visualizza clienti, ticket e checklist'
  },
  'pcready:write': {
    label: 'Scrittura dati',
    description: 'Crea e modifica ticket, checklist, inventario'
  },
  'pcready:admin': {
    label: 'Amministrazione',
    description: 'Gestisci utenti e configurazione'
  }
} as const;

export function getScopeLabel(scope: OAuthScope): string {
  return OAUTH_SCOPES[scope]?.label || scope;
}

export function getScopeDescription(scope: OAuthScope): string {
  return OAUTH_SCOPES[scope]?.description || '';
}