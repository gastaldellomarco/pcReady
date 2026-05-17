import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import { Modal } from "@/components/pcready/Modal";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { generatePortalAccessLink } from "@/lib/portal-auth";
import queries, { type GlobalContactRow } from "@/lib/queries/clients";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Briefcase,
  Building2,
  CheckCircle2,
  Copy,
  Link2,
  Mail,
  Pencil,
  Phone,
  Search,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import type React from "react";
import { toast } from "sonner";
import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm-dialog";

export const Route = createFileRoute("/_app/contacts")({
  head: () => ({
    meta: [
      { title: "Referenti - PCReady" },
      { name: "description", content: "Vista globale dei referenti cliente." },
    ],
  }),
  component: ContactsPage,
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => <LoadingSkeleton />,
});

type ContactForm = {
  full_name: string;
  email: string;
  phone: string;
  job_title: string;
  department: string;
  is_primary: boolean;
};

function ContactsPage() {
  const { canEdit, profile, session } = useAuth();
  const canDelete = profile?.role === "admin";
  const canManagePortalAccess = profile?.role === "admin" || profile?.role === "tech";
  const qc = useQueryClient();
  const navigate = useNavigate();
  const generatePortalLink = useServerFn(generatePortalAccessLink);
  const { useGlobalContacts } = queries as any;
  const contactsQuery = useGlobalContacts();
  const contacts = useMemo(
    () => (contactsQuery.data ?? []) as GlobalContactRow[],
    [contactsQuery.data],
  );
  const [q, setQ] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "primary" | "portalActive" | "missingEmail"
  >("all");
  const [editing, setEditing] = useState<GlobalContactRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GlobalContactRow | null>(null);
  const [form, setForm] = useState<ContactForm>(emptyContactForm);
  const [busy, setBusy] = useState(false);
  const [portalLink, setPortalLink] = useState<{
    contactName: string;
    clientName: string;
    loginUrl: string;
    expiresAt: string;
  } | null>(null);
  const [copiedPortalLink, setCopiedPortalLink] = useState(false);

  const clients = useMemo(
    () =>
      Array.from(
        new Map(
          contacts
            .map((contact) => contact.client)
            .filter(Boolean)
            .map((client) => [client!.id, client!] as const),
        ).values(),
      ).sort((a, b) => clientName(a).localeCompare(clientName(b))),
    [contacts],
  );
  const roles = useMemo(
    () =>
      Array.from(
        new Set(contacts.map((contact) => contact.job_title).filter(Boolean) as string[]),
      ).sort((a, b) => a.localeCompare(b)),
    [contacts],
  );
  const departments = useMemo(
    () =>
      Array.from(
        new Set(contacts.map((contact) => contact.department).filter(Boolean) as string[]),
      ).sort((a, b) => a.localeCompare(b)),
    [contacts],
  );
  const filteredContacts = contacts.filter((contact) => {
    const term = q.trim().toLowerCase();
    const haystack = [
      contactLabel(contact),
      contact.email ?? "",
      contact.phone ?? "",
      contact.job_title ?? "",
      contact.department ?? "",
      contact.client ? clientName(contact.client) : "",
    ]
      .join(" ")
      .toLowerCase();
    if (term && !haystack.includes(term)) return false;
    if (clientFilter !== "all" && contact.client_id !== clientFilter) return false;
    if (roleFilter !== "all" && contact.job_title !== roleFilter) return false;
    if (departmentFilter !== "all" && contact.department !== departmentFilter) return false;
    if (statusFilter === "primary" && !contact.is_primary) return false;
    if (statusFilter === "portalActive" && !contact.portal_active) return false;
    if (statusFilter === "missingEmail" && contact.email) return false;
    return true;
  });
  const groupedContacts = Array.from(
    filteredContacts.reduce((map, contact) => {
      const key = contact.client_id || "no-client";
      const current = map.get(key) ?? { client: contact.client, rows: [] as GlobalContactRow[] };
      current.rows.push(contact);
      map.set(key, current);
      return map;
    }, new Map<string, { client: GlobalContactRow["client"]; rows: GlobalContactRow[] }>()),
  ).sort((a, b) => clientGroupName(a[1].client).localeCompare(clientGroupName(b[1].client)));

  function openEdit(contact: GlobalContactRow) {
    setEditing(contact);
    setForm({
      full_name: contactLabel(contact),
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      job_title: contact.job_title ?? "",
      department: contact.department ?? "",
      is_primary: contact.is_primary,
    });
  }

  async function saveEdit() {
    if (!editing || !canEdit) return toast.error("Permessi insufficienti");
    if (!form.full_name.trim()) return toast.error("Nome referente obbligatorio");
    if (form.email.trim() && !isValidEmail(form.email)) return toast.error("Email non valida");
    setBusy(true);
    try {
      if (form.is_primary) {
        await supabase
          .from("client_contacts")
          .update({ is_primary: false })
          .eq("client_id", editing.client_id);
      }
      const { error } = await supabase
        .from("client_contacts")
        .update({
          full_name: form.full_name.trim(),
          first_name: firstName(form.full_name),
          last_name: lastName(form.full_name),
          email: clean(form.email),
          phone: clean(form.phone),
          job_title: clean(form.job_title),
          role: clean(form.job_title),
          department: clean(form.department),
          is_primary: form.is_primary,
        } as any)
        .eq("id", editing.id);
      if (error) throw error;
      setEditing(null);
      await qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Referente aggiornato");
    } catch (error) {
      toast.error(errorMessage(error, "Errore salvataggio referente"));
    } finally {
      setBusy(false);
    }
  }

  async function deleteContact(contact: GlobalContactRow) {
    if (!canDelete) return toast.error("Solo admin puo' eliminare referenti");
    const { error } = await supabase.from("client_contacts").delete().eq("id", contact.id);
    if (error) return toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["clients"] });
    toast.success("Referente eliminato");
  }

  async function generateContactPortalLink(contact: GlobalContactRow) {
    if (!session?.access_token) return toast.error("Sessione non valida");
    if (!canManagePortalAccess) return toast.error("Permessi insufficienti");
    setBusy(true);
    setCopiedPortalLink(false);
    try {
      const result = await generatePortalLink({
        data: { accessToken: session.access_token, contactId: contact.id, ttlHours: 24 },
      });
      setPortalLink(result);
      await qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Link portale generato");
    } catch (error) {
      toast.error(errorMessage(error, "Errore generazione link portale"));
    } finally {
      setBusy(false);
    }
  }

  async function copyPortalLink() {
    if (!portalLink?.loginUrl) return;
    try {
      await navigator.clipboard.writeText(portalLink.loginUrl);
      setCopiedPortalLink(true);
      setTimeout(() => setCopiedPortalLink(false), 2000);
    } catch {
      toast.error("Impossibile copiare il link");
    }
  }

  return (
    <div className="pc-card overflow-hidden">
      <div className="pc-card-hd">
        <div>
          <div className="pc-card-title">Referenti</div>
          <div className="mt-1 text-sm text-text3">
            {filteredContacts.length}/{contacts.length} referenti
          </div>
        </div>
        <Users className="h-5 w-5 text-text3" />
      </div>

      <div
        className="grid gap-2 border-b p-3 lg:grid-cols-[minmax(220px,1fr)_180px_180px_170px_170px]"
        style={{ background: "var(--surface2)", borderColor: "var(--border)" }}
      >
        <div
          className="flex items-center gap-2 rounded-lg border px-3 py-2"
          style={{ background: "var(--surface)", borderColor: "var(--border2)" }}
        >
          <Search className="h-4 w-4 text-text3" />
          <input
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Cerca nome, azienda, email, telefono, ruolo..."
          />
        </div>
        <select
          className="pc-input"
          value={clientFilter}
          onChange={(event) => setClientFilter(event.target.value)}
        >
          <option value="all">Tutte le aziende</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {clientName(client)}
            </option>
          ))}
        </select>
        <select
          className="pc-input"
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value)}
        >
          <option value="all">Tutti i ruoli</option>
          {roles.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        <select
          className="pc-input"
          value={departmentFilter}
          onChange={(event) => setDepartmentFilter(event.target.value)}
        >
          <option value="all">Tutti i reparti</option>
          {departments.map((department) => (
            <option key={department} value={department}>
              {department}
            </option>
          ))}
        </select>
        <select
          className="pc-input"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
        >
          <option value="all">Tutti gli stati</option>
          <option value="primary">Referente principale</option>
          <option value="portalActive">Portale attivo</option>
          <option value="missingEmail">Senza email</option>
        </select>
      </div>

      <div className="space-y-4 p-4">
        {groupedContacts.map(([clientId, group]) => (
          <section
            key={clientId}
            className="rounded-xl border"
            style={{ borderColor: "var(--border)" }}
          >
            <div
              className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3"
              style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
            >
              <button
                className="inline-flex min-w-0 items-center gap-2 text-left"
                onClick={() =>
                  group.client &&
                  void navigate({
                    to: "/clients",
                    search: { clientId: group.client.id, tab: "contacts" },
                  })
                }
              >
                <Building2 className="h-4 w-4 shrink-0 text-text3" />
                <span className="truncate text-sm font-bold text-text">
                  {clientGroupName(group.client)}
                </span>
              </button>
              <span className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-text3">
                {group.rows.length} referenti
              </span>
            </div>
            <div className="grid gap-3 p-3 xl:grid-cols-2">
              {group.rows.map((contact) => (
                <GlobalContactCard
                  key={contact.id}
                  contact={contact}
                  busy={busy}
                  canDelete={canDelete}
                  canEdit={canEdit}
                  canManagePortalAccess={canManagePortalAccess}
                  onOpenClient={() =>
                    void navigate({
                      to: "/clients",
                      search: { clientId: contact.client_id, tab: "contacts" },
                    })
                  }
                  onEdit={() => openEdit(contact)}
                  onGeneratePortalLink={() => generateContactPortalLink(contact)}
                  onDelete={() => setDeleteTarget(contact)}
                />
              ))}
            </div>
          </section>
        ))}
        {!filteredContacts.length && (
          <div
            className="rounded-xl border border-dashed py-12 text-center text-sm text-text3"
            style={{ borderColor: "var(--border)" }}
          >
            Nessun referente trovato con i filtri correnti.
          </div>
        )}
      </div>

      <EditContactModal
        editing={editing}
        form={form}
        busy={busy}
        canEdit={canEdit}
        setForm={setForm}
        onClose={() => setEditing(null)}
        onSave={saveEdit}
      />
      <PortalLinkModal
        portalLink={portalLink}
        copied={copiedPortalLink}
        onClose={() => setPortalLink(null)}
        onCopy={copyPortalLink}
      />
      <DestructiveConfirmDialog
        open={!!deleteTarget}
        title="Eliminare questo referente?"
        description={
          deleteTarget
            ? `Il referente "${contactLabel(deleteTarget)}" verra' rimosso da ${deleteTarget.client ? clientName(deleteTarget.client) : "questo cliente"}. L'azione non puo' essere annullata.`
            : "Il referente verra' rimosso dal cliente. L'azione non puo' essere annullata."
        }
        confirmLabel="Elimina referente"
        loadingLabel="Eliminazione..."
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) await deleteContact(deleteTarget);
        }}
      />
    </div>
  );
}

function GlobalContactCard({
  contact,
  busy,
  canDelete,
  canEdit,
  canManagePortalAccess,
  onOpenClient,
  onEdit,
  onGeneratePortalLink,
  onDelete,
}: {
  contact: GlobalContactRow;
  busy: boolean;
  canDelete: boolean;
  canEdit: boolean;
  canManagePortalAccess: boolean;
  onOpenClient: () => void;
  onEdit: () => void;
  onGeneratePortalLink: () => void;
  onDelete: () => void;
}) {
  const name = contactLabel(contact) || "Referente";

  return (
    <div
      className="rounded-xl border p-4"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent">
          {contactInitials(contact)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="truncate text-left text-sm font-bold text-accent"
              onClick={onOpenClient}
            >
              {name}
            </button>
            {contact.is_primary && (
              <span className="inline-flex items-center gap-1 rounded-full bg-warn-bg px-2 py-0.5 text-[10px] font-bold text-warn">
                <Star className="h-3 w-3" /> Principale
              </span>
            )}
            <PortalBadge active={contact.portal_active} />
          </div>
          <button
            className="mt-1 inline-flex max-w-full items-center gap-1 text-left text-[12px] font-semibold text-text2 hover:text-accent"
            onClick={onOpenClient}
            title={contact.client ? clientName(contact.client) : "Cliente non associato"}
          >
            <Building2 className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {contact.client ? clientName(contact.client) : "Cliente non associato"}
            </span>
          </button>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-text3">
            <span className="inline-flex items-center gap-1">
              <Briefcase className="h-3 w-3" /> {contact.job_title || "Ruolo non indicato"}
            </span>
            {contact.department && (
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3 w-3" /> {contact.department}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {contact.email ? (
          <a
            href={`mailto:${contact.email}`}
            className="inline-flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-[12px] font-semibold text-text2 hover:text-accent"
            style={{ borderColor: "var(--border)" }}
            title={contact.email}
          >
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{contact.email}</span>
          </a>
        ) : (
          <span
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] text-text3"
            style={{ borderColor: "var(--border)" }}
          >
            <Mail className="h-3.5 w-3.5" /> Email mancante
          </span>
        )}
        {contact.phone ? (
          <a
            href={`tel:${contact.phone}`}
            className="inline-flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-[12px] font-semibold text-text2 hover:text-accent"
            style={{ borderColor: "var(--border)" }}
            title={contact.phone}
          >
            <Phone className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{contact.phone}</span>
          </a>
        ) : (
          <span
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] text-text3"
            style={{ borderColor: "var(--border)" }}
          >
            <Phone className="h-3.5 w-3.5" /> Telefono mancante
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-1.5">
        <button className="pc-btn pc-btn-ghost pc-btn-xs" disabled={!canEdit} onClick={onEdit}>
          <Pencil className="h-3 w-3" /> Modifica
        </button>
        <button
          className="pc-btn pc-btn-ghost pc-btn-xs"
          disabled={!canManagePortalAccess || busy}
          onClick={onGeneratePortalLink}
        >
          <Link2 className="h-3 w-3" /> Portale
        </button>
        <button
          className="pc-btn-icon"
          disabled={!canDelete}
          onClick={onDelete}
          title="Elimina referente"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function EditContactModal({
  editing,
  form,
  setForm,
  canEdit,
  busy,
  onClose,
  onSave,
}: {
  editing: GlobalContactRow | null;
  form: ContactForm;
  setForm: React.Dispatch<React.SetStateAction<ContactForm>>;
  canEdit: boolean;
  busy: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Modal
      open={!!editing}
      onClose={onClose}
      title="Modifica referente"
      footer={
        <>
          <button className="pc-btn pc-btn-ghost" onClick={onClose} disabled={busy}>
            Annulla
          </button>
          <button className="pc-btn pc-btn-primary" onClick={onSave} disabled={busy || !canEdit}>
            Salva referente
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Nome e cognome *">
          <input
            className="pc-input"
            value={form.full_name}
            onChange={(event) =>
              setForm((current) => ({ ...current, full_name: event.target.value }))
            }
          />
        </Field>
        <Field label="Email">
          <input
            className="pc-input"
            type="email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          />
        </Field>
        <Field label="Telefono">
          <input
            className="pc-input"
            value={form.phone}
            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
          />
        </Field>
        <Field label="Ruolo">
          <input
            className="pc-input"
            value={form.job_title}
            onChange={(event) =>
              setForm((current) => ({ ...current, job_title: event.target.value }))
            }
          />
        </Field>
        <Field label="Reparto">
          <input
            className="pc-input"
            value={form.department}
            onChange={(event) =>
              setForm((current) => ({ ...current, department: event.target.value }))
            }
          />
        </Field>
        <label className="flex items-center gap-2 pt-6 text-[12px] text-text2">
          <input
            type="checkbox"
            checked={form.is_primary}
            onChange={(event) =>
              setForm((current) => ({ ...current, is_primary: event.target.checked }))
            }
          />
          Referente principale
        </label>
      </div>
    </Modal>
  );
}

function PortalLinkModal({
  portalLink,
  copied,
  onClose,
  onCopy,
}: {
  portalLink: {
    contactName: string;
    clientName: string;
    loginUrl: string;
    expiresAt: string;
  } | null;
  copied: boolean;
  onClose: () => void;
  onCopy: () => void;
}) {
  return (
    <Modal
      open={!!portalLink}
      onClose={onClose}
      title="Link accesso portale"
      footer={
        <>
          <button className="pc-btn pc-btn-ghost" onClick={onClose}>
            Chiudi
          </button>
          <button className="pc-btn pc-btn-primary" onClick={onCopy}>
            {copied ? (
              <>
                <CheckCircle2 className="w-3 h-3" /> Copiato
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" /> Copia link
              </>
            )}
          </button>
        </>
      }
    >
      {portalLink && (
        <div className="flex flex-col gap-3">
          <div>
            <div className="pc-label">Referente</div>
            <div className="text-[13px] font-semibold">{portalLink.contactName}</div>
            <div className="text-[12px] text-text3">{portalLink.clientName}</div>
          </div>
          <div
            className="break-all rounded-md border px-3 py-2 font-mono text-[12px]"
            style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
          >
            {portalLink.loginUrl}
          </div>
        </div>
      )}
    </Modal>
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

function PortalBadge({ active }: { active: boolean }) {
  return (
    <span
      className="inline-flex rounded-full px-2 py-0.5 text-[10.5px] font-bold"
      style={{
        background: active ? "rgba(22, 163, 74, .12)" : "var(--surface2)",
        color: active ? "#15803d" : "var(--text3)",
      }}
    >
      {active ? "Attivo" : "Nessun accesso"}
    </span>
  );
}

const emptyContactForm: ContactForm = {
  full_name: "",
  email: "",
  phone: "",
  job_title: "",
  department: "",
  is_primary: false,
};

function clientName(client: NonNullable<GlobalContactRow["client"]>) {
  return client.company_name || client.name;
}

function clientGroupName(client: GlobalContactRow["client"]) {
  return client ? clientName(client) : "Cliente non associato";
}

function contactLabel(contact: Pick<GlobalContactRow, "full_name" | "first_name" | "last_name">) {
  return contact.full_name || [contact.first_name, contact.last_name].filter(Boolean).join(" ");
}

function contactInitials(
  contact: Pick<GlobalContactRow, "full_name" | "first_name" | "last_name" | "email">,
) {
  const name = contactLabel(contact) || contact.email || "Referente";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

function lastName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(" ") : null;
}

function clean(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
