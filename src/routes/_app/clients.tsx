import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ClientSchema, ContactSchema, type ClientInput, type ContactInput } from "@/lib/schemas/clients";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth-context";
import { Building2, Plus, Save, Search, Star, Trash2, UserRound } from "lucide-react";
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

function ClientsPage() {
  const { canEdit, profile } = useAuth();
  const canDelete = profile?.role === "admin";
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [q, setQ] = useState("");
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

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setContacts([]);
      clientForm.reset(emptyClient as ClientInput);
      return;
    }
    const client = clients.find((c) => c.id === selectedId);
    if (client) clientForm.reset(toClientForm(client) as ClientInput);
    loadContacts(selectedId);
  }, [selectedId, clients]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((c) =>
      [c.company_name, c.name, c.vat_number, c.email, c.phone]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(term)),
    );
  }, [clients, q]);

  const selected = clients.find((c) => c.id === selectedId) || null;

  async function loadClients() {
    const { data, error } = await supabase
      .from("clients")
      .select(
        "id, name, company_name, vat_number, fiscal_code, email, phone, address, notes, updated_at",
      )
      .order("name");
    if (error) return toast.error(error.message);
    const arr = (data ?? []) as ClientRow[];
    setClients(arr);
    setSelectedId((cur) => cur || arr[0]?.id || null);
  }

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
    setClientForm(emptyClient);
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

  const onSaveContact = contactForm.handleSubmit(async (values) => {
    if (!canEdit) return toast.error("Permessi insufficienti");
    if (!selectedId) return toast.error("Salva prima il cliente");
    setBusy(true);
    try {
      const fullName = values.full_name.trim();
      if (values.is_primary) {
        await supabase.from("client_contacts").update({ is_primary: false }).eq("client_id", selectedId);
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
        const { error } = await supabase.from("client_contacts").update(base as TablesUpdate<"client_contacts">).eq("id", editingContactId);
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
          <button className="pc-btn pc-btn-primary pc-btn-sm" onClick={startNewClient}>
            <Plus className="w-3 h-3" /> Nuovo cliente
          </button>
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
        </div>
        <div className="max-h-[calc(100vh-230px)] overflow-y-auto">
          {filtered.map((c) => (
            <button
              key={c.id}
              className="w-full text-left px-4 py-3 border-b hover:bg-surface2 transition-colors"
              style={{
                borderColor: "var(--border)",
                background: c.id === selectedId ? "var(--accent2)" : undefined,
              }}
              onClick={() => setSelectedId(c.id)}
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-text3 flex-shrink-0" />
                <div className="font-semibold text-[13px] truncate">{c.company_name || c.name}</div>
              </div>
              <div className="mt-1 text-[11px] text-text3 truncate">
                {c.vat_number || c.email || c.phone || "Anagrafica da completare"}
              </div>
            </button>
          ))}
          {!filtered.length && (
            <div className="p-8 text-center text-sm text-text3">Nessun cliente</div>
          )}
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
              <button className="pc-btn pc-btn-primary pc-btn-sm" disabled={busy || !canEdit} onClick={onSaveClient}>
                <Save className="w-3 h-3" /> Salva cliente
              </button>
            </div>
          </div>
          <div className="pc-card-body grid grid-cols-1 md:grid-cols-2 gap-[14px]">
            <Field label="Ragione sociale *">
              <input className="pc-input" {...clientForm.register("company_name")} />
              {clientForm.formState.errors.company_name && (
                <p className="text-sm text-destructive mt-1">{clientForm.formState.errors.company_name.message}</p>
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
                <p className="text-sm text-destructive mt-1">{clientForm.formState.errors.email.message}</p>
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
                    <p className="text-sm text-destructive mt-1">{contactForm.formState.errors.full_name.message}</p>
                  )}
                </Field>
                <Field label="Email">
                  <input className="pc-input" type="email" {...contactForm.register("email")} />
                  {contactForm.formState.errors.email && (
                    <p className="text-sm text-destructive mt-1">{contactForm.formState.errors.email.message}</p>
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
                <button className="pc-btn pc-btn-primary justify-center" disabled={busy || !canEdit || !selectedId} onClick={onSaveContact}>
                  <Save className="w-3 h-3" /> Salva referente
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
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
