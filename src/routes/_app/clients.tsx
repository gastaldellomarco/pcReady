import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ClientSchema,
  ContactSchema,
  type ClientInput,
  type ContactInput,
} from "@/lib/schemas/clients";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth-context";
import { Modal } from "@/components/pcready/Modal";
import {
  Building2,
  CheckCircle2,
  Download,
  FileDown,
  FileUp,
  Plus,
  Save,
  Search,
  Star,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/clients")({
  head: () => ({
    meta: [
      { title: "Clienti - PCReady" },
      { name: "description", content: "Anagrafica clienti e referenti aziendali." },
    ],
  }),
  component: ClientsPage,
});

type ClientRow = {
  id: string;
  name: string;
  company_name: string | null;
  vat_number: string | null;
  fiscal_code: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  updated_at: string;
};

type ContactRow = {
  id: string;
  client_id: string;
  full_name: string | null;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  department: string | null;
  is_primary: boolean;
  notes: string | null;
};

type ClientForm = {
  company_name: string;
  vat_number: string;
  fiscal_code: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
};

type ContactForm = {
  id?: string;
  full_name: string;
  email: string;
  phone: string;
  job_title: string;
  department: string;
  is_primary: boolean;
  notes: string;
};

const emptyClient: ClientForm = {
  company_name: "",
  vat_number: "",
  fiscal_code: "",
  email: "",
  phone: "",
  address: "",
  notes: "",
};

const emptyContact: ContactForm = {
  full_name: "",
  email: "",
  phone: "",
  job_title: "",
  department: "",
  is_primary: false,
  notes: "",
};

const PAGE_SIZE = 50;
const EXPORT_CHUNK_SIZE = 1000;
const CLIENT_SELECT =
  "id, name, company_name, vat_number, fiscal_code, email, phone, address, notes, updated_at";

function ClientsPage() {
  const { canEdit, profile } = useAuth();
  const canDelete = profile?.role === "admin";
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [q, setQ] = useState("");
  const [exportBusy, setExportBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const clientForm = useForm<ClientInput>({
    resolver: zodResolver(ClientSchema),
    mode: "onChange",
    defaultValues: emptyClient as ClientInput,
  });

  const contactForm = useForm<ContactInput>({
    resolver: zodResolver(ContactSchema),
    mode: "onChange",
    defaultValues: emptyContact as ContactInput,
  });
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadClients = useCallback(async () => {
    let query = supabase.from("clients").select(CLIENT_SELECT, { count: "exact" }).order("name");
    const term = cleanSearchTerm(q);
    if (term) {
      query = query.or(
        `name.ilike.%${term}%,company_name.ilike.%${term}%,vat_number.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`,
      );
    }
    const { data, count, error } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) return toast.error(error.message);
    const totalRows = count ?? 0;
    if (page > 0 && page * PAGE_SIZE >= totalRows) {
      setPage(0);
      return;
    }
    const arr = (data ?? []) as ClientRow[];
    setClients(arr);
    setTotal(totalRows);
    setSelectedId((cur) => (cur && arr.some((c) => c.id === cur) ? cur : arr[0]?.id || null));
    setSelectedIds((current) => {
      const pageIds = new Set(arr.map((c) => c.id));
      const next = new Set<string>();
      for (const id of current) {
        if (pageIds.has(id)) next.add(id);
      }
      return next;
    });
  }, [page, q]);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  useEffect(() => {
    setPage(0);
  }, [q]);

  useEffect(() => {
    if (!selectedId) {
      setContacts([]);
      clientForm.reset(emptyClient as ClientInput);
      return;
    }
    const client = clients.find((c) => c.id === selectedId);
    if (client) clientForm.reset(toClientForm(client) as ClientInput);
    loadContacts(selectedId);
  }, [selectedId, clients, clientForm]);

  const selected = clients.find((c) => c.id === selectedId) || null;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const allPageSelected = clients.length > 0 && clients.every((c) => selectedIds.has(c.id));

  async function loadContacts(clientId: string) {
    const { data, error } = await supabase
      .from("client_contacts")
      .select(
        "id, client_id, full_name, first_name, last_name, email, phone, job_title, department, is_primary, notes",
      )
      .eq("client_id", clientId)
      .order("is_primary", { ascending: false })
      .order("full_name");
    if (error) return toast.error(error.message);
    setContacts((data ?? []) as ContactRow[]);
  }

  function startNewClient() {
    setSelectedId(null);
    clientForm.reset(emptyClient as ClientInput);
    setContacts([]);
    resetContactForm();
  }

  function resetContactForm() {
    setEditingContactId(null);
    contactForm.reset(emptyContact as ContactInput);
  }

  const onSaveClient = clientForm.handleSubmit(async (values) => {
    if (!canEdit) return toast.error("Permessi insufficienti");
    setBusy(true);
    try {
      const companyName = values.company_name.trim();
      if (selected) {
        const patch: TablesUpdate<"clients"> = {
          name: companyName,
          company_name: companyName,
          vat_number: clean(values.vat_number || ""),
          fiscal_code: clean(values.fiscal_code || ""),
          email: clean(values.email || ""),
          phone: clean(values.phone || ""),
          address: clean(values.address || ""),
          notes: clean(values.notes || ""),
        };
        const { error } = await supabase.from("clients").update(patch).eq("id", selected!.id);
        if (error) throw error;
        toast.success("Cliente aggiornato");
      } else {
        const insert: TablesInsert<"clients"> = {
          name: companyName,
          company_name: companyName,
          vat_number: clean(values.vat_number || ""),
          fiscal_code: clean(values.fiscal_code || ""),
          email: clean(values.email || ""),
          phone: clean(values.phone || ""),
          address: clean(values.address || ""),
          notes: clean(values.notes || ""),
        };
        const { data, error } = await supabase.from("clients").insert(insert).select("id").single();
        if (error) throw error;
        setSelectedId(data.id);
        toast.success("Cliente creato");
      }
      await loadClients();
    } catch (e) {
      toast.error(errorMessage(e, "Errore salvataggio cliente"));
    } finally {
      setBusy(false);
    }
  });

  async function deleteClient() {
    if (!selected || !canDelete) return toast.error("Solo admin puo' eliminare clienti");
    if (!confirm(`Eliminare ${selected.company_name || selected.name}?`)) return;
    const { error } = await supabase.from("clients").delete().eq("id", selected.id);
    if (error) return toast.error(error.message);
    toast.success("Cliente eliminato");
    setSelectedId(null);
    await loadClients();
  }

  async function bulkDelete() {
    if (!canDelete) return toast.error("Solo admin puo' eliminare clienti");
    const ids = Array.from(selectedIds);
    if (!ids.length) return toast.error("Seleziona almeno un cliente");
    if (!confirm(`Eliminare ${ids.length} clienti selezionati?`)) return;
    const { error } = await supabase.from("clients").delete().in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`${ids.length} clienti eliminati`);
    if (selectedId && selectedIds.has(selectedId)) {
      setSelectedId(null);
    }
    setSelectedIds(new Set());
    await loadClients();
  }

  async function exportCsv() {
    setExportBusy(true);
    try {
      const allClients = await loadAllClientsForExport();
      if (!allClients.length) return toast.error("Nessun cliente da esportare");
      downloadClientsCsv(allClients);
      toast.success("CSV clienti esportato");
    } catch (error) {
      toast.error(errorMessage(error, "Errore esportazione CSV"));
    } finally {
      setExportBusy(false);
    }
  }

  function toggleSelected(id: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function togglePageSelected(checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const client of clients) {
        if (checked) next.add(client.id);
        else next.delete(client.id);
      }
      return next;
    });
  }

  const onSaveContact = contactForm.handleSubmit(async (values) => {
    if (!canEdit) return toast.error("Permessi insufficienti");
    if (!selectedId) return toast.error("Salva prima il cliente");
    setBusy(true);
    try {
      const fullName = values.full_name.trim();
      if (values.is_primary) {
        await supabase
          .from("client_contacts")
          .update({ is_primary: false })
          .eq("client_id", selectedId);
      }
      const base = {
        full_name: fullName,
        first_name: firstName(fullName),
        last_name: lastName(fullName),
        email: clean(values.email || ""),
        phone: clean(values.phone || ""),
        job_title: clean(values.job_title || ""),
        role: clean(values.job_title || ""),
        department: clean(values.department || ""),
        is_primary: !!values.is_primary,
        notes: clean(values.notes || ""),
      };
      if (editingContactId) {
        const { error } = await supabase
          .from("client_contacts")
          .update(base as TablesUpdate<"client_contacts">)
          .eq("id", editingContactId);
        if (error) throw error;
        toast.success("Referente aggiornato");
      } else {
        const insert: TablesInsert<"client_contacts"> = { client_id: selectedId, ...base };
        const { error } = await supabase.from("client_contacts").insert(insert);
        if (error) throw error;
        toast.success("Referente aggiunto");
      }
      resetContactForm();
      await loadContacts(selectedId);
    } catch (e) {
      toast.error(errorMessage(e, "Errore salvataggio referente"));
    } finally {
      setBusy(false);
    }
  });

  async function deleteContact(contact: ContactRow) {
    if (!canDelete) return toast.error("Solo admin puo' eliminare referenti");
    if (!confirm(`Eliminare ${contactLabel(contact)}?`)) return;
    const { error } = await supabase.from("client_contacts").delete().eq("id", contact.id);
    if (error) return toast.error(error.message);
    toast.success("Referente eliminato");
    await loadContacts(contact.client_id);
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-4">
      <div className="pc-card overflow-hidden">
        <div className="pc-card-hd">
          <div className="pc-card-title">Clienti</div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              className="pc-btn pc-btn-ghost pc-btn-sm"
              disabled={exportBusy}
              onClick={exportCsv}
            >
              <FileDown className="w-3 h-3" />
              {exportBusy ? "Esportazione..." : "Export CSV"}
            </button>
            <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={() => setImportOpen(true)}>
              <Upload className="w-3 h-3" /> Import CSV
            </button>
            <button className="pc-btn pc-btn-primary pc-btn-sm" onClick={startNewClient}>
              <Plus className="w-3 h-3" /> Nuovo
            </button>
          </div>
        </div>
        <div className="p-3 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-text3" />
            <input
              className="pc-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cerca clienti..."
            />
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 text-xs text-text3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                aria-label="Seleziona pagina"
                checked={allPageSelected}
                onChange={(event) => togglePageSelected(event.target.checked)}
              />
              Seleziona pagina
            </label>
            <span className="font-mono">
              {total
                ? `${page * PAGE_SIZE + 1}-${page * PAGE_SIZE + clients.length} di ${total}`
                : "0 clienti"}
            </span>
          </div>
          {selectedIds.size > 0 && (
            <div
              className="mt-3 flex items-center justify-between gap-2 rounded-md px-3 py-2"
              style={{ background: "var(--surface2)" }}
            >
              <span className="text-xs text-text2">{selectedIds.size} clienti selezionati</span>
              <button
                className="pc-btn pc-btn-ghost pc-btn-xs"
                disabled={!canDelete}
                onClick={bulkDelete}
              >
                <Trash2 className="w-3 h-3" /> Elimina
              </button>
            </div>
          )}
        </div>
        <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
          {clients.map((c) => (
            <div
              key={c.id}
              className="w-full cursor-pointer px-4 py-3 text-left border-b hover:bg-surface2 transition-colors"
              style={{
                borderColor: "var(--border)",
                background: c.id === selectedId ? "var(--accent2)" : undefined,
              }}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedId(c.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedId(c.id);
                }
              }}
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  aria-label={`Seleziona ${c.company_name || c.name}`}
                  checked={selectedIds.has(c.id)}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => toggleSelected(c.id, event.target.checked)}
                />
                <Building2 className="w-4 h-4 text-text3 flex-shrink-0" />
                <div className="font-semibold text-[13px] truncate">{c.company_name || c.name}</div>
              </div>
              <div className="mt-1 text-[11px] text-text3 truncate">
                {c.vat_number || c.email || c.phone || "Anagrafica da completare"}
              </div>
            </div>
          ))}
          {!clients.length && (
            <div className="p-8 text-center text-sm text-text3">Nessun cliente</div>
          )}
        </div>
        <div
          className="flex items-center justify-end gap-2 px-3 py-2 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          <button
            className="pc-btn pc-btn-ghost pc-btn-sm"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Precedente
          </button>
          <span className="text-xs text-text3 font-mono">
            Pagina {page + 1} di {pageCount}
          </span>
          <button
            className="pc-btn pc-btn-ghost pc-btn-sm"
            disabled={page + 1 >= pageCount}
            onClick={() => setPage((p) => p + 1)}
          >
            Successiva
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="pc-card">
          <div className="pc-card-hd">
            <div className="pc-card-title">{selected ? "Dettaglio cliente" : "Nuovo cliente"}</div>
            <div className="flex gap-2">
              {selected && (
                <button
                  className="pc-btn pc-btn-ghost pc-btn-sm"
                  disabled={!canDelete}
                  onClick={deleteClient}
                >
                  <Trash2 className="w-3 h-3" /> Elimina
                </button>
              )}
              <button
                className="pc-btn pc-btn-primary pc-btn-sm"
                disabled={busy || !canEdit}
                onClick={onSaveClient}
              >
                <Save className="w-3 h-3" /> Salva cliente
              </button>
            </div>
          </div>
          <div className="pc-card-body grid grid-cols-1 md:grid-cols-2 gap-[14px]">
            <Field label="Ragione sociale *">
              <input className="pc-input" {...clientForm.register("company_name")} />
              {clientForm.formState.errors.company_name && (
                <p className="text-sm text-destructive mt-1">
                  {clientForm.formState.errors.company_name.message}
                </p>
              )}
            </Field>
            <Field label="P.IVA">
              <input className="pc-input" {...clientForm.register("vat_number")} />
            </Field>
            <Field label="Codice fiscale">
              <input className="pc-input" {...clientForm.register("fiscal_code")} />
            </Field>
            <Field label="Email">
              <input className="pc-input" type="email" {...clientForm.register("email")} />
              {clientForm.formState.errors.email && (
                <p className="text-sm text-destructive mt-1">
                  {clientForm.formState.errors.email.message}
                </p>
              )}
            </Field>
            <Field label="Telefono">
              <input className="pc-input" {...clientForm.register("phone")} />
            </Field>
            <Field label="Indirizzo">
              <input className="pc-input" {...clientForm.register("address")} />
            </Field>
            <div className="md:col-span-2">
              <Field label="Note">
                <textarea className="pc-input min-h-[78px]" {...clientForm.register("notes")} />
              </Field>
            </div>
          </div>
        </div>

        <div className="pc-card overflow-hidden">
          <div className="pc-card-hd">
            <div className="pc-card-title">Referenti</div>
            <span className="text-xs text-text3">{contacts.length} contatti</span>
          </div>
          <div className="pc-card-body grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    {["Nome", "Ruolo", "Reparto", "Email", "Telefono", ""].map((h) => (
                      <th
                        key={h}
                        className="text-left px-3 py-2 text-[10.5px] font-bold uppercase text-text3 border-b"
                        style={{ borderColor: "var(--border)" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b hover:bg-surface2"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <td className="px-3 py-2 text-[12.5px] font-semibold">
                        <span className="inline-flex items-center gap-1">
                          {c.is_primary && (
                            <Star className="w-3 h-3" style={{ color: "var(--warn)" }} />
                          )}
                          {contactLabel(c)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-[12px] text-text2">{c.job_title || "-"}</td>
                      <td className="px-3 py-2 text-[12px] text-text2">{c.department || "-"}</td>
                      <td className="px-3 py-2 text-[12px] text-text2">{c.email || "-"}</td>
                      <td className="px-3 py-2 text-[12px] text-text2">{c.phone || "-"}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <button
                            className="pc-btn pc-btn-ghost pc-btn-xs"
                            onClick={() => {
                              setEditingContactId(c.id);
                              contactForm.reset({
                                full_name: contactLabel(c),
                                email: c.email || null,
                                phone: c.phone || null,
                                job_title: c.job_title || null,
                                department: c.department || null,
                                is_primary: c.is_primary,
                                notes: c.notes || null,
                              } as ContactInput);
                            }}
                          >
                            Modifica
                          </button>
                          <button
                            className="pc-btn-icon"
                            disabled={!canDelete}
                            onClick={() => deleteContact(c)}
                            title="Elimina referente"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!contacts.length && (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-sm text-text3">
                        Nessun referente associato.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="rounded-[8px] border p-3" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold text-[13px] flex items-center gap-2">
                  <UserRound className="w-4 h-4 text-text3" />
                  {editingContactId ? "Modifica referente" : "Nuovo referente"}
                </div>
                {editingContactId && (
                  <button className="pc-btn pc-btn-ghost pc-btn-xs" onClick={resetContactForm}>
                    Annulla
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-3">
                <Field label="Nome e cognome *">
                  <input className="pc-input" {...contactForm.register("full_name")} />
                  {contactForm.formState.errors.full_name && (
                    <p className="text-sm text-destructive mt-1">
                      {contactForm.formState.errors.full_name.message}
                    </p>
                  )}
                </Field>
                <Field label="Email">
                  <input className="pc-input" type="email" {...contactForm.register("email")} />
                  {contactForm.formState.errors.email && (
                    <p className="text-sm text-destructive mt-1">
                      {contactForm.formState.errors.email.message}
                    </p>
                  )}
                </Field>
                <Field label="Telefono">
                  <input className="pc-input" {...contactForm.register("phone")} />
                </Field>
                <Field label="Ruolo aziendale">
                  <input className="pc-input" {...contactForm.register("job_title")} />
                </Field>
                <Field label="Reparto">
                  <input className="pc-input" {...contactForm.register("department")} />
                </Field>
                <label className="flex items-center gap-2 text-[12px] text-text2">
                  <input type="checkbox" {...contactForm.register("is_primary")} />
                  Referente principale
                </label>
                <Field label="Note">
                  <textarea className="pc-input min-h-[64px]" {...contactForm.register("notes")} />
                </Field>
                <button
                  className="pc-btn pc-btn-primary justify-center"
                  disabled={busy || !canEdit || !selectedId}
                  onClick={onSaveContact}
                >
                  <Save className="w-3 h-3" /> Salva referente
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ImportClientsCsvDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          setSelectedIds(new Set());
          void loadClients();
        }}
      />
    </div>
  );
}

type ClientImportRow = {
  rowNumber: number;
  name: string;
  company_name: string;
  vat_number: string;
  fiscal_code: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  existingId: string | null;
  action: "insert" | "update" | "skip";
  errors: string[];
};

type ClientImportResult = {
  inserted: number;
  updated: number;
  errors: { rowNumber: number; name: string; error: string }[];
};

function ImportClientsCsvDialog({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const { canEdit } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [rows, setRows] = useState<ClientImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ClientImportResult | null>(null);

  const stats = useMemo(
    () => ({
      inserts: rows.filter((row) => row.action === "insert").length,
      updates: rows.filter((row) => row.action === "update").length,
      errors: rows.filter((row) => row.errors.length).length,
      valid: rows.filter((row) => row.action !== "skip").length,
    }),
    [rows],
  );

  function resetAndClose() {
    setStep(1);
    setRows([]);
    setFileName("");
    setBusy(false);
    setResult(null);
    onClose();
  }

  async function handleFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    setResult(null);
    setFileName(file.name);
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      const existing = await loadClientImportKeys();
      const preview = buildClientImportPreview(parsed, existing);
      setRows(preview);
      setStep(2);
      if (!preview.length) toast.error("CSV vuoto o senza righe valide");
    } catch (error) {
      toast.error(errorMessage(error, "Errore lettura CSV"));
    } finally {
      setBusy(false);
    }
  }

  function downloadTemplate() {
    const template = [
      ["Nome", "Azienda", "P.IVA", "Email", "Telefono", "Indirizzo", "Codice fiscale", "Note"],
      [
        "Mario Rossi",
        "Rossi SRL",
        "IT12345678901",
        "mario@rossi.example",
        "+39 02 123456",
        "Via Roma 1",
        "",
        "",
      ],
    ];
    downloadCsv(template, "template-clienti-pcready.csv");
  }

  async function confirmImport() {
    if (!canEdit) return toast.error("Permessi insufficienti");
    if (!stats.valid) return toast.error("Nessuna riga valida da importare");
    setBusy(true);
    setStep(3);
    try {
      const importResult = await importClientsFromPreview(rows);
      setResult(importResult);
      onImported();
      toast.success("Import CSV completato");
    } catch (error) {
      toast.error(errorMessage(error, "Errore import CSV"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={resetAndClose}
      title="Import CSV clienti"
      size="lg"
      footer={
        <>
          <button className="pc-btn pc-btn-ghost" onClick={resetAndClose} disabled={busy}>
            Chiudi
          </button>
          {step === 2 && (
            <button
              className="pc-btn pc-btn-primary"
              onClick={confirmImport}
              disabled={busy || !stats.valid}
            >
              Conferma import
            </button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2 text-xs">
          {[
            ["1", "Upload"],
            ["2", "Preview"],
            ["3", "Conferma"],
          ].map(([n, label]) => (
            <div
              key={n}
              className="rounded-md border px-3 py-2"
              style={{
                borderColor: Number(n) === step ? "var(--primary)" : "var(--border)",
                background: Number(n) === step ? "var(--surface2)" : "transparent",
              }}
            >
              <span className="font-mono">{n}</span> {label}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="flex flex-col gap-3">
            <label
              className="flex min-h-[150px] cursor-pointer flex-col items-center justify-center gap-3 rounded-md border border-dashed px-4 text-center"
              style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
            >
              <FileUp className="h-8 w-8 text-text3" />
              <div>
                <div className="text-sm font-semibold">Carica file .csv</div>
                <div className="text-xs text-text3">
                  {busy ? "Lettura in corso..." : fileName || "nome, azienda, p.iva, email"}
                </div>
              </div>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                disabled={busy}
                onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <button className="pc-btn pc-btn-ghost self-start" onClick={downloadTemplate}>
              <Download className="w-3 h-3" /> Scarica template CSV
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-4 gap-2 text-xs">
              <SummaryBox label="Insert" value={stats.inserts} />
              <SummaryBox label="Update" value={stats.updates} />
              <SummaryBox label="Errori" value={stats.errors} />
              <SummaryBox label="Righe" value={rows.length} />
            </div>
            <div
              className="max-h-[360px] overflow-auto rounded-md border"
              style={{ borderColor: "var(--border)" }}
            >
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: "var(--surface2)" }}>
                    {["Riga", "Nome", "Azienda", "P.IVA", "Email", "Azione", "Validazione"].map(
                      (h) => (
                        <th key={h} className="px-3 py-2 text-left font-bold uppercase text-text3">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={`${row.rowNumber}-${row.email}-${row.vat_number}`}
                      className="border-t"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <td className="px-3 py-2 font-mono">{row.rowNumber}</td>
                      <td className="px-3 py-2">{row.name || "-"}</td>
                      <td className="px-3 py-2">{row.company_name || "-"}</td>
                      <td className="px-3 py-2 font-mono">{row.vat_number || "-"}</td>
                      <td className="px-3 py-2">{row.email || "-"}</td>
                      <td className="px-3 py-2">{row.action}</td>
                      <td
                        className={
                          row.errors.length ? "px-3 py-2 text-destructive" : "px-3 py-2 text-text3"
                        }
                      >
                        {row.errors.join(", ") || "OK"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            {result ? (
              <div className="grid grid-cols-3 gap-2">
                <SummaryBox label="Inseriti" value={result.inserted} />
                <SummaryBox label="Aggiornati" value={result.updated} />
                <SummaryBox label="Errori" value={result.errors.length} />
              </div>
            ) : (
              <div className="text-sm text-text2">Import in corso...</div>
            )}
            {result?.errors.length ? (
              <div
                className="rounded-md border p-3 text-xs text-destructive"
                style={{ borderColor: "var(--border)" }}
              >
                {result.errors.map((error) => (
                  <div key={`${error.rowNumber}-${error.name}`}>
                    Riga {error.rowNumber} ({error.name || "-"}): {error.error}
                  </div>
                ))}
              </div>
            ) : result ? (
              <div className="flex items-center gap-2 text-sm text-text2">
                <CheckCircle2 className="h-4 w-4 text-green-600" /> Import completato
              </div>
            ) : null}
          </div>
        )}
      </div>
    </Modal>
  );
}

function SummaryBox({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="rounded-md border px-3 py-2"
      style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
    >
      <div className="text-[10px] uppercase text-text3">{label}</div>
      <div className="font-mono text-sm font-semibold">{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="pc-label">{label}</label>
      {children}
    </div>
  );
}

function toClientForm(c: ClientRow): ClientForm {
  return {
    company_name: c.company_name || c.name,
    vat_number: c.vat_number || "",
    fiscal_code: c.fiscal_code || "",
    email: c.email || "",
    phone: c.phone || "",
    address: c.address || "",
    notes: c.notes || "",
  };
}

function clean(value: string) {
  const v = value.trim();
  return v || null;
}

function cleanSearchTerm(value: string) {
  return value.trim().replace(/[,%]/g, "");
}

async function loadAllClientsForExport() {
  const rows: ClientRow[] = [];
  for (let from = 0; ; from += EXPORT_CHUNK_SIZE) {
    const { data, error } = await supabase
      .from("clients")
      .select(CLIENT_SELECT)
      .order("name")
      .range(from, from + EXPORT_CHUNK_SIZE - 1);
    if (error) throw error;
    const chunk = (data ?? []) as ClientRow[];
    rows.push(...chunk);
    if (chunk.length < EXPORT_CHUNK_SIZE) break;
  }
  return rows;
}

function downloadClientsCsv(clients: ClientRow[]) {
  const headers = ["Nome", "Azienda", "P.IVA", "Email", "Telefono", "Indirizzo"];
  const rows = clients.map((c) => [
    c.name,
    c.company_name ?? "",
    c.vat_number ?? "",
    c.email ?? "",
    c.phone ?? "",
    c.address ?? "",
  ]);
  downloadCsv([headers, ...rows], `clienti_${new Date().toISOString().slice(0, 10)}.csv`);
}

function downloadCsv(rows: string[][], filename: string) {
  const csv = rows
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

type CsvRecord = {
  rowNumber: number;
  values: Record<string, string>;
};

type ExistingClientKeys = {
  byVat: Map<string, string>;
  byEmail: Map<string, string>;
};

async function loadClientImportKeys() {
  const byVat = new Map<string, string>();
  const byEmail = new Map<string, string>();

  for (let from = 0; ; from += EXPORT_CHUNK_SIZE) {
    const { data, error } = await supabase
      .from("clients")
      .select("id, vat_number, email")
      .order("name")
      .range(from, from + EXPORT_CHUNK_SIZE - 1);
    if (error) throw error;
    const chunk = (data ?? []) as Pick<ClientRow, "id" | "vat_number" | "email">[];
    for (const client of chunk) {
      const vat = normalizeKey(client.vat_number);
      const email = normalizeKey(client.email);
      if (vat) byVat.set(vat, client.id);
      if (email) byEmail.set(email, client.id);
    }
    if (chunk.length < EXPORT_CHUNK_SIZE) break;
  }

  return { byVat, byEmail };
}

function buildClientImportPreview(records: CsvRecord[], existing: ExistingClientKeys) {
  const seenKeys = new Set<string>();

  return records.map((record) => {
    const name = pickCsvValue(record.values, ["nome", "name", "ragione_sociale"]);
    const companyName =
      pickCsvValue(record.values, ["azienda", "company", "company_name", "ragione_sociale"]) ||
      name;
    const vatNumber = pickCsvValue(record.values, ["p_iva", "piva", "partita_iva", "vat_number"]);
    const email = pickCsvValue(record.values, ["email", "mail"]);
    const row: ClientImportRow = {
      rowNumber: record.rowNumber,
      name,
      company_name: companyName,
      vat_number: vatNumber,
      fiscal_code: pickCsvValue(record.values, ["codice_fiscale", "fiscal_code"]),
      email,
      phone: pickCsvValue(record.values, ["telefono", "phone", "tel"]),
      address: pickCsvValue(record.values, ["indirizzo", "address"]),
      notes: pickCsvValue(record.values, ["note", "notes"]),
      existingId: null,
      action: "insert",
      errors: [],
    };

    if (!row.name.trim()) row.errors.push("Nome obbligatorio");
    const vatKey = normalizeKey(row.vat_number);
    const emailKey = normalizeKey(row.email);
    const dedupeKey = vatKey ? `vat:${vatKey}` : emailKey ? `email:${emailKey}` : "";
    if (dedupeKey && seenKeys.has(dedupeKey)) row.errors.push("Duplicato nel CSV");
    if (dedupeKey) seenKeys.add(dedupeKey);

    row.existingId =
      (vatKey && existing.byVat.get(vatKey)) ||
      (emailKey && existing.byEmail.get(emailKey)) ||
      null;
    row.action = row.errors.length ? "skip" : row.existingId ? "update" : "insert";
    return row;
  });
}

async function importClientsFromPreview(rows: ClientImportRow[]) {
  const result: ClientImportResult = { inserted: 0, updated: 0, errors: [] };
  const validRows = rows.filter((row) => row.action !== "skip");

  for (const row of validRows) {
    try {
      const payload = {
        name: row.name.trim(),
        company_name: row.company_name.trim() || row.name.trim(),
        vat_number: clean(row.vat_number),
        fiscal_code: clean(row.fiscal_code),
        email: clean(row.email),
        phone: clean(row.phone),
        address: clean(row.address),
        notes: clean(row.notes),
      };

      if (row.existingId) {
        const { error } = await supabase
          .from("clients")
          .update(payload as TablesUpdate<"clients">)
          .eq("id", row.existingId);
        if (error) throw error;
        result.updated += 1;
      } else {
        const existingId = await findExistingClientId(row);
        if (existingId) {
          const { error } = await supabase
            .from("clients")
            .update(payload as TablesUpdate<"clients">)
            .eq("id", existingId);
          if (error) throw error;
          result.updated += 1;
        } else {
          const { error } = await supabase
            .from("clients")
            .insert(payload as TablesInsert<"clients">);
          if (error) throw error;
          result.inserted += 1;
        }
      }
    } catch (error) {
      result.errors.push({
        rowNumber: row.rowNumber,
        name: row.name,
        error: errorMessage(error, "Errore import riga"),
      });
    }
  }

  return result;
}

async function findExistingClientId(row: ClientImportRow) {
  const vat = row.vat_number.trim();
  if (vat) {
    const { data, error } = await supabase
      .from("clients")
      .select("id")
      .eq("vat_number", vat)
      .maybeSingle();
    if (error) throw error;
    if (data?.id) return data.id;
  }

  const email = row.email.trim();
  if (email) {
    const { data, error } = await supabase
      .from("clients")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (error) throw error;
    if (data?.id) return data.id;
  }

  return null;
}

function parseCsv(text: string): CsvRecord[] {
  const lines = csvToRows(text.replace(/^\uFEFF/, ""));
  if (!lines.length) return [];
  const headers = lines[0].map(normalizeHeader);
  return lines
    .slice(1)
    .map((line, index) => {
      const values: Record<string, string> = {};
      headers.forEach((header, cellIndex) => {
        if (header) values[header] = (line[cellIndex] ?? "").trim();
      });
      return { rowNumber: index + 2, values };
    })
    .filter((record) => Object.values(record.values).some(Boolean));
}

function csvToRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);
  return rows.filter((cells) => cells.some((value) => value.trim()));
}

function pickCsvValue(values: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = values[key];
    if (value) return value.trim();
  }
  return "";
}

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeKey(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

function lastName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(" ") : null;
}

function contactLabel(c: ContactRow) {
  return c.full_name || [c.first_name, c.last_name].filter(Boolean).join(" ");
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
