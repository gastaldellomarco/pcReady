# ADR-002: Split portal-auth in moduli di dominio

**Data:** 2026-06-10
**Stato:** Approvato
**Author:** AI + Marco

## Contesto

Il file `src/lib/portal-auth.server.ts` (~270 righe) gestiva cinque
preoccupazioni distinte in un unico modulo piatto:

- Hashing e verifica password (`hashPortalPassword`, `verifyPortalPassword`)
- Gestione sessioni portal (`createPortalSession`, `getPortalSession`,
  `validatePortalSessionServer`, `logoutPortalSessionServer`)
- Flussi di login (`requestPortalLoginServer`, `loginPortalWithPasswordServer`,
  `verifyPortalLogin2FAServer`)
- Listing contatti (`getPortalClientContactsServer`)
- Guard operatore (`assertPortalLinkOperator`)

Il modulo era già parzialmente splittato — `portal-auth-2fa.server.ts`,
`portal-auth-links.server.ts` e `portal-auth-profile.server.ts` esistevano
come file separati, ma importavano ancora dal monolite `portal-auth.server.ts`.
Questo creava una gerarchia piatta innaturale: moduli specializzati che
dipendevano da un catch-all.

## Decisione

Splittare `portal-auth.server.ts` in 5 moduli di dominio indipendenti,
ciascuno con un'interfaccia minima e una responsabilità singola:

| Modulo | Interfaccia pubblica |
|--------|---------------------|
| `portal-password.server.ts` | `hashPortalPassword`, `verifyPortalPassword` |
| `portal-sessions.server.ts` | `createPortalSession`, `getPortalSession`, `validatePortalSessionServer`, `logoutPortalSessionServer`, `portalLoginUrl`, tipi `PortalBranding`, `PortalSessionContext` |
| `portal-login.server.ts` | `requestPortalLoginServer`, `loginPortalWithPasswordServer`, `verifyPortalLogin2FAServer` |
| `portal-contacts.server.ts` | `getPortalClientContactsServer` |
| `portal-operator.server.ts` | `assertPortalLinkOperator` |

Il vecchio `portal-auth.server.ts` diventa un **barrel** che riesporta
tutte le interfacce pubbliche dai sub-moduli. Zero breaking changes per
gli 8 file chiamanti.

**Grafo delle dipendenze:**
```
portal-login.server.ts ──────► portal-sessions.server.ts
                            └► portal-password.server.ts

portal-contacts.server.ts ──► portal-sessions.server.ts

portal-auth.server.ts (barrel) ──► tutti i sub-moduli
```

Nessuna dipendenza circolare. I moduli sono indipendenti e testabili
separatamente.

**Modifiche all'interfaccia pubblica:**
- `verifyPortalPassword`: era `private`, ora è `export` dal modulo
  password. È una funzione pura con interfaccia chiara — il tipo di cosa
  che *dovrebbe* essere pubblica.
- `hashToken`: era `export` ma mai usata esternamente. Ora è interna al
  modulo sessions.

## Conseguenze

**Positive:**
- Ogni modulo ha località: un bug nella verifica password non richiede
  di leggere codice di sessioni o login
- `getPortalSession` (la funzione più usata — 6+ chiamanti) vive in un
  modulo dedicato con i tipi che le servono
- I moduli password e operator sono testabili in isolamento puro
  (funzioni pure + Supabase)
- Il barrel preserva la retrocompatibilità; i chiamanti possono migrare
  agli import diretti gradualmente

**Negative:**
- 5 file invece di 1 — overhead di navigazione per chi non conosce la
  struttura. Mitigato dal barrel e dalla convenzione di naming coerente
  (`portal-<dominio>.server.ts`)

**Rischio:** `hashToken` non è più esportata. Se codice futuro la
importava da `@/lib/portal-auth.server`, si romperà. Verificato: nessun
chiamante esterno la usa.

## File coinvolti

| File | Azione |
|------|--------|
| `src/lib/portal-sessions.server.ts` | Creato (~110 righe) |
| `src/lib/portal-password.server.ts` | Creato (~25 righe) |
| `src/lib/portal-login.server.ts` | Creato (~140 righe) |
| `src/lib/portal-contacts.server.ts` | Creato (~30 righe) |
| `src/lib/portal-operator.server.ts` | Creato (~20 righe) |
| `src/lib/portal-auth.server.ts` | Sostituito con barrel (~35 righe) |
| `src/lib/portal-auth-2fa.server.ts` | Nessuna modifica |
| `src/lib/portal-auth-links.server.ts` | Nessuna modifica |
| `src/lib/portal-auth-profile.server.ts` | Nessuna modifica |
| `src/lib/portal-auth.ts` | Nessuna modifica |
| `src/lib/portal-devices.server.ts` | Nessuna modifica |
| `src/lib/portal-documents.server.ts` | Nessuna modifica |
| `src/lib/portal-tickets.server.ts` | Nessuna modifica |

## Riferimenti

- [ADR-001: Modulo PDF di completamento](./ADR-001-completion-pdf-module.md)
- `docs/domain-model.md` — glossario entità
