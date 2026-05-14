export type OAuthScope =
  | "openid"
  | "profile"
  | "email"
  | "pcready:read"
  | "pcready:write"
  | "pcready:admin";

export interface ScopeDefinition {
  label: string;
  /** Breve riepilogo (es. tooltip o elenchi compatti). */
  description: string;
  /** Spiegazione estesa in linguaggio naturale per admin e schermata di consenso. */
  longDescription: string;
}

export const OAUTH_SCOPES: Record<OAuthScope, ScopeDefinition> = {
  openid: {
    label: "Identità (OpenID)",
    description: "Identificativo utente stabile per l’app esterna.",
    longDescription:
      "Consente all’applicazione di sapere chi sei in modo anonimo e coerente tra le sessioni, senza accedere automaticamente al nome o all’email. È il permesso base per molti flussi di login tramite PCReady.",
  },
  profile: {
    label: "Profilo",
    description: "Nome visualizzato e iniziali.",
    longDescription:
      "L’app può leggere come ti presenti in PCReady (nome completo e iniziali), utile per personalizzare interfacce o firme, senza modificare il tuo account.",
  },
  email: {
    label: "Email",
    description: "Indirizzo email associato all’account.",
    longDescription:
      "L’app può leggere l’indirizzo email del tuo account PCReady. Serve per notifiche, abbinamento utenti o supporto; non implica l’invio automatico di messaggi da PCReady.",
  },
  "pcready:read": {
    label: "Lettura dati PCReady",
    description: "Consultare clienti, ticket, dispositivi e liste operative.",
    longDescription:
      "L’applicazione può consultare i dati operativi (clienti, ticket, dispositivi, checklist e contenuti collegati) ma non modificarli. Adatta a dashboard, report o integrazioni in sola lettura.",
  },
  "pcready:write": {
    label: "Scrittura dati PCReady",
    description: "Creare e aggiornare ticket, inventario e attività collegate.",
    longDescription:
      "L’applicazione può creare e aggiornare ticket, stati, note e altri dati operativi (in base alle API esposte). Usa questo permesso solo per tool di automazione o app di campo di cui ti fidi.",
  },
  "pcready:admin": {
    label: "Amministrazione",
    description: "Gestione utenti, impostazioni e funzioni riservate agli admin.",
    longDescription:
      "Accesso ad azioni amministrative (utenti, configurazione, audit e simili). Assegna questo permesso solo a integrazioni interne molto attendibili: equivale a poteri di amministratore via API.",
  },
} as const;

export function getScopeLabel(scope: OAuthScope): string {
  return OAUTH_SCOPES[scope]?.label || scope;
}

export function getScopeDescription(scope: OAuthScope): string {
  const def = OAUTH_SCOPES[scope];
  if (!def) return "";
  return def.longDescription || def.description;
}
