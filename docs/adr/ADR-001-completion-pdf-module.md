# ADR-001: Modulo PDF di completamento come deep module

**Data:** 2026-06-10
**Stato:** Approvato
**Author:** AI + Marco

## Contesto

Il file `src/lib/ticket-completion.server.ts` (~1700 righe) mescolava cinque
preoccupazioni distinte: fetch dati Supabase, computazione checklist,
generazione layout PDF (PDFKit), upload Supabase Storage, invio email.
Di queste, ~900 righe erano puro codice di layout PDF.

La generazione PDF non era testabile in isolamento: ogni test avrebbe
richiesto Supabase, Storage ed email. Il modulo non aveva una **seam**
tra "cosa renderizzare" e "come farlo".

## Decisione

Estrarre tutta la generazione PDF in `src/lib/completion-pdf.ts` con
un'interfaccia minima:

```ts
generateCompletionPdf(
  ticket: TicketPdfData,
  template: CompletionPdfTemplate
) → Promise<Buffer>
```

Il modulo riceve dati **pre-calcolati** e restituisce un buffer PDF.
Non conosce Supabase, Storage, o email. È un **deep module** nel senso
del glossario architetturale: molta leva dietro un'interfaccia piccola.

**Cosa include il modulo:**
- `generateCompletionPdf` — generatore principale
- `generateErrorPdf` — fallback (interno)
- Tutti i primitivi di layout PDFKit (header, card, signature section, etc.)
- Formattatori (`formatPdfDateTime`, `cleanPdfText`, etc.)
- `buildWorkExecutionSummary` — estrazione strutturata dai dati testuali
- Tipi: `TicketPdfData`, `CompletionPdfTemplate`, `TicketChecklistSummary`, etc.

**Cosa resta in `ticket-completion.server.ts`:**
- `completeTicket` — orchestrazione (fetch → prepara dati → chiama PDF → upload → notifica)
- `buildChecklistSummaries` e helper — computazione dati
- `getCompletionPdfUrl` — lookup URL firmato

**Chi chiama cosa:**
- `ticket-completion.ts` (wrapper `createServerFn`) → `completeTicket` → `generateCompletionPdf`
- Nessun chiamante diretto al modulo PDF; l'interfaccia di `completeTicket` è invariata

## Conseguenze

**Positive:**
- Il modulo PDF è testabile in isolamento con dati mock (16 test in
  `src/__tests__/lib/completion-pdf.test.ts`, nessuna dipendenza da Supabase)
- Le primitive di layout (`sectionTitle`, `drawCard`, `workField`, etc.)
  possono essere riutilizzate per altri PDF del progetto (costi, inventario)
- Bug di layout PDF si diagnosticano leggendo un modulo, non tracciando
  l'intero flusso di completamento
- `ticket-completion.server.ts` è passato da ~1700 a ~350 righe

**Negative:**
- `humanizeValue` è duplicato tra i due moduli (versione semplificata in
  `ticket-completion.server.ts` per label checklist). La duplicazione è
  intenzionale: i moduli servono scopi diversi.
- `TicketPdfData` duplica parzialmente `TicketRow` (il tipo interno di
  `ticket-completion.server.ts`). Accettabile finché non cresce.

**Rischio:** Il lazy import `await import("./ticket-completion.server")` in
`ticket-completion.ts` ora trascina anche `completion-pdf.ts` + `pdfkit`.
Nessun impatto pratico: il caricamento è già su richiesta.

## File coinvolti

| File | Azione |
|------|--------|
| `src/lib/completion-pdf.ts` | Creato (~1000 righe, deep module) |
| `src/lib/ticket-completion.server.ts` | Sfoltito (~1700 → ~350 righe) |
| `src/__tests__/lib/completion-pdf.test.ts` | Creato (16 test) |
| `src/__tests__/setup.ts` | Reso difensivo (`window is not defined`) |
| `src/lib/ticket-completion.ts` | Nessuna modifica (interfaccia invariata) |

## Riferimenti

- [ADR-002: Split portal-auth in moduli di dominio](./ADR-002-portal-auth-split.md)
- `docs/domain-model.md` — glossario entità
