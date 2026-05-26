# ExportPdf — Esportazione PDF avanzata con supporto "tutti i risultati"

**Data:** 2026-05-26  
**Tipo:** Feature  
**Priorità:** Media  
**Componente:** `src/components/ExportPdf.tsx`

## Sommario

L'esportazione PDF attuale si limita ai record della pagina corrente. Questo design introduce un componente modale riutilizzabile `ExportPdf` che permette di esportare **tutti i risultati filtrati** (non solo la pagina corrente), con un warning quando il conteggio supera 500 record. Il componente è generico e utilizzabile per ticket, inventory, costi e altre entità.

## Acceptance Criteria

1. Pulsante "Esporta PDF" nella pagina ticket apre il modale ExportPdf
2. Il modale mostra un riepilogo dei filtri attivi (stato, priorità, tipo, cliente, date range)
3. Radio button per scegliere tra "Pagina corrente" e "Tutti i risultati filtrati"
4. Warning inline quando "Tutti" è selezionato e il conteggio > 500
5. I filtri attivi della pagina vengono rispettati nell'export
6. Il componente è generico e riutilizzabile per altre entità (inventory, costi)

## Component API

```typescript
// src/components/ExportPdf.tsx
interface ExportPdfProps<TData, TPdfRow> {
  // ── Controllo visibilità ──
  open: boolean;
  onOpenChange: (open: boolean) => void;

  // ── Identità ──
  entityLabel: string;              // "ticket", "dispositivi", "costi"

  // ── Rendering PDF (entity-specific) ──
  renderPdf: (rows: TPdfRow[], orgName?: string) => ReactElement<DocumentProps>;
  mapRow: (row: TData) => TPdfRow;
  fileName: string;                 // "pcready-ticket", "pcready-inventory"

  // ── Data fetching ──
  fetchAll: (filters: Record<string, any>) => Promise<{ data: TData[]; count: number }>;

  // ── Contesto pagina corrente ──
  currentPageRows: TData[];
  activeFilters: Record<string, any>;
  totalFilteredCount: number;

  // ── Callbacks ──
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}
```

**Decisioni chiave:**
- `open`/`onOpenChange` — il parent controlla visibilità (button → open, close → `onOpenChange(false)`)
- `renderPdf` + `mapRow` — logica PDF entity-specific resta nel parent, passata come callback
- `fetchAll` — nuova funzione di fetch senza paginazione fornita dal parent
- `currentPageRows` — per la modalità "pagina corrente" (nessun fetch aggiuntivo)
- `activeFilters` — usati per il riepilogo filtri e passati a `fetchAll`

## UI Layout & Stati

```
┌─────────────────────────────────────────────────┐
│  Esporta PDF — Ticket                            │
│                                                   │
│  ── Filtri attivi ───────────────────────────────│
│  Stato: In corso  •  Priorità: Alta              │
│  Cliente: ACME Srl  •  Data: 01/01/26 - 31/05/26│
│  ────────────────────────────────────────────────│
│                                                   │
│  ○  Pagina corrente (25 ticket)                  │
│  ●  Tutti i risultati filtrati (342 ticket)      │
│                                                   │
│  ⚠️  L'export supera 500 record (3.210 ticket).  │  ← solo se >500
│     Il PDF potrebbe essere grande. Confermi?      │
│                                                   │
│  ┌──────────────────────────────────────────────┐ │
│  │         [Annulla]    [Esporta PDF]            │ │
│  └──────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### Stati del componente

| Stato | Comportamento |
|---|---|
| **Default** | Radio button con conteggi. Bottone "Esporta PDF" attivo |
| **Warning (>500)** | Banner inline appare quando "Tutti" selezionato e count > 500. Bottone diventa "Conferma ed esporta" |
| **Loading** | Bottone mostra spinner + "Esportazione in corso...". Tutti gli input disabilitati |
| **Success** | Modale si chiude, parent mostra toast ("PDF esportato") via `onSuccess` |
| **Error** | Messaggio errore inline nel modale, bottone "Riprova". Chiama `onError` |
| **Empty (0 risultati)** | Radio "Tutti" disabilitato con label "Nessun risultato" |

## Data Flow

```
Page (tickets.lazy.tsx)                    ExportPdf Modal
─────────────────────                      ───────────────
activeFilters ──────────────────────────→  mostra riepilogo filtri
totalFilteredCount ─────────────────────→  mostra conteggi record
currentPageRows ────────────────────────→  dati per opzione "pagina corrente"
fetchAll() callback ────────────────────→  chiamata quando "tutti" selezionato

Utente clicca "Esporta PDF":
  ┌─ "pagina corrente"? → renderPdf(currentPageRows.map(mapRow)) → downloadPdf(...)
  └─ "tutti"?
       ├─ count > 500? → mostra warning, attendi conferma
       └─ confermato → fetchAll(activeFilters) → renderPdf(data.map(mapRow)) → downloadPdf(...)
```

## Nuova funzione fetchAll

Aggiunta a `src/lib/queries/tickets.ts`:

```typescript
export async function fetchAllTicketsList(params: TicketsListParams) {
  let query = supabase
    .from("tickets")
    .select("...stessi campi di fetchTicketsList...", { count: "exact" })
    .not("status", "eq", "archived");

  // Stessi filtri di fetchTicketsList
  if (params.status) query = query.eq("status", params.status);
  if (params.priority) query = query.eq("priority", params.priority);
  if (params.ticket_type) query = query.eq("ticket_type", params.ticket_type);
  if (params.client_id) query = query.eq("client_id", params.client_id);
  if (params.assignee_id) query = query.eq("assignee_id", params.assignee_id);
  if (params.dateFrom) query = query.gte("created_at", params.dateFrom);
  if (params.dateTo) query = query.lte("created_at", params.dateTo + "T23:59:59.999Z");
  // ... search query ...

  // NESSUN .range() — recupera tutti i risultati
  const { data, count, error } = await query;
  if (error) throw error;
  return { data: (data ?? []) as any[], count: count ?? 0 };
}
```

## Error Handling

| Scenario | Comportamento |
|---|---|
| `fetchAll` reject | Errore inline "Impossibile recuperare i dati. Riprova." con bottone retry |
| `renderPdf` throw | Catch in try/catch, toast error via `onError` callback |
| Supabase timeout / network | Stato errore generico, bottone retry |
| 0 total results | Radio "tutti" disabilitato, label "Nessun risultato" |
| Count > 500 + utente annulla | Collassa warning, mantieni "tutti" selezionato, utente può switchare a "pagina corrente" |

## Testing

### Unit test (`src/__tests__/ExportPdf.test.tsx`)
- Renderizza con entrambe le opzioni radio e conteggi corretti
- Mostra warning quando count > 500 e "tutti" selezionato
- Nasconde warning quando si switcha a "pagina corrente"
- Chiama `fetchAll` con i filtri corretti quando si esporta "tutti"
- Disabilita input durante loading
- Chiama `onSuccess` dopo export riuscito
- Mostra errore inline quando `fetchAll` fallisce

### E2E test (`e2e/pdf-export.spec.ts`)
- Apri modale ExportPdf dalla pagina ticket
- Seleziona "Tutti i risultati" e verifica conteggio
- Esporta e verifica download
- Verifica warning per > 500 record

## File da creare/modificare

| File | Azione |
|---|---|
| `src/components/ExportPdf.tsx` | **NUOVO** — componente modale riutilizzabile |
| `src/lib/queries/tickets.ts` | **MODIFICA** — aggiungi `fetchAllTicketsList()` |
| `src/routes/_app/tickets.lazy.tsx` | **MODIFICA** — sostituisci `exportPdf()` inline con integrazione ExportPdf |
| `src/lib/queries/list-config.ts` | **MODIFICA** — aggiungi costante `EXPORT_WARNING_THRESHOLD = 500` |

## i18n

Il componente usa le label passate dal parent. Tutte le stringhe usano il pattern `useTranslation("tickets")` esistente. Il componente stesso non importa i18n direttamente — riceve label localizzate via props o il parent le gestisce.

## Non incluso in questo design

- **Inventory e costi**: Il componente è generico e pronto per essere usato anche lì, ma l'integrazione in `inventory.lazy.tsx` e `costs.lazy.tsx` è fuori scope per questa iterazione
- **Progress bar per export grandi**: Non necessario finché non si osserva un problema reale di performance
- **Export in background / code async**: Fuori scope — il flusso è sincrono (fetch → render → download)
