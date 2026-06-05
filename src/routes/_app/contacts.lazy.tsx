import { useQueryClient } from "@tanstack/react-query";
import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
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
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Modal } from "@/components/pcready/Modal";
import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm-dialog";
import { Field } from "@/components/ui/form-field";
import { useVirtualList } from "@/hooks/useVirtualList";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { errorMessage } from "@/lib/errors";
import { generatePortalAccessLink } from "@/lib/portal-auth";
import queries, { type GlobalContactRow } from "@/lib/queries/clients";
import type React from "react";

export const Route = createLazyFileRoute("/_app/contacts")({
  component: ContactsPage,
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
  const { t } = useTranslation("contacts");
  const { canEdit, profile, session } = useAuth();
  const canDelete = profile?.role === "admin";
  const canManagePortalAccess = profile?.role === "admin" || profile?.role === "tech";
  const qc = useQueryClient();
  const navigate = useNavigate();
  const generatePortalLink = useServerFn(generatePortalAccessLink);
  const { useGlobalContactsInfiniteList } = queries as any;
  const [q, setQ] = useState("");
  const listQuery = useGlobalContactsInfiniteList({ q });
  const contacts = useMemo(
    () => (listQuery.data?.pages ?? []).flat() as GlobalContactRow[],
    [listQuery.data],
  );
  const desktopSentinelRef = useRef<HTMLDivElement>(null);
  const mobileSentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = desktopSentinelRef.current;
    if (!el || !listQuery.hasNextPage || listQuery.isFetchingNextPage) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && listQuery.hasNextPage) {
          void listQuery.fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [listQuery.hasNextPage, listQuery.isFetchingNextPage, listQuery.fetchNextPage]);
  useEffect(() => {
    const el = mobileSentinelRef.current;
    if (!el || !listQuery.hasNextPage || listQuery.isFetchingNextPage) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && listQuery.hasNextPage) {
          void listQuery.fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [listQuery.hasNextPage, listQuery.isFetchingNextPage, listQuery.fetchNextPage]);
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
  const {
    containerRef: sectionContainerRef,
    virtualizer: sectionVirtualizer,
    virtualItems: virtualSections,
    totalSize: sectionTotalSize,
  } = useVirtualList({
    count: groupedContacts.length,
    estimateSize: 300,
    overscan: 3,
    threshold: 20,
  });
  const {
    containerRef: mobileContainerRef,
    virtualizer: mobileVirtualizer,
    virtualItems: mobileVirtualItems,
    totalSize: mobileVirtualTotalSize,
  } = useVirtualList({
    count: filteredContacts.length,
    estimateSize: 240,
    overscan: 5,
    threshold: 20,
  });

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
    if (!editing || !canEdit) return toast.error(t("toast.noPermission", "Permessi insufficienti"));
    if (!form.full_name.trim())
      return toast.error(t("toast.nameRequired", "Nome referente obbligatorio"));
    if (form.email.trim() && !isValidEmail(form.email))
      return toast.error(t("toast.invalidEmail", "Email non valida"));
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
      toast.success(t("toast.contactUpdated", "Referente aggiornato"));
    } catch (error) {
      toast.error(errorMessage(error, t("toast.saveError", "Errore salvataggio referente")));
    } finally {
      setBusy(false);
    }
  }

  async function deleteContact(contact: GlobalContactRow) {
    if (!canDelete)
      return toast.error(t("toast.deleteNoPermission", "Solo admin può eliminare referenti"));
    const { error } = await supabase.from("client_contacts").delete().eq("id", contact.id);
    if (error) return toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["clients"] });
    toast.success(t("toast.contactDeleted", "Referente eliminato"));
  }

  async function generateContactPortalLink(contact: GlobalContactRow) {
    if (!session?.access_token)
      return toast.error(t("toast.invalidSession", "Sessione non valida"));
    if (!canManagePortalAccess)
      return toast.error(t("toast.noPermission", "Permessi insufficienti"));
    setBusy(true);
    setCopiedPortalLink(false);
    try {
      const result = await generatePortalLink({
        data: { accessToken: session.access_token, contactId: contact.id, ttlHours: 24 },
      });
      setPortalLink(result);
      await qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success(t("toast.portalLinkGenerated", "Link portale generato"));
    } catch (error) {
      toast.error(
        errorMessage(error, t("toast.portalLinkError", "Errore generazione link portale")),
      );
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
      toast.error(t("toast.copyLinkError", "Impossibile copiare il link"));
    }
  }

  return (
    <div className="pc-card overflow-hidden">
      <div className="pc-card-hd">
        <div>
          <div className="pc-card-title">{t("page.title", "Referenti")}</div>
          <div className="mt-1 text-sm text-text3">
            {t("page.contactCount", "{{filtered}}/{{total}} referenti", {
              filtered: filteredContacts.length,
              total: contacts.length,
            })}
          </div>
        </div>
        <Users className="size-5 text-text3" />
      </div>

      <div
        className="grid gap-2 border-b p-3 lg:grid-cols-[minmax(220px,1fr)_180px_180px_170px_170px]"
        style={{ background: "var(--surface2)", borderColor: "var(--border)" }}
      >
        <div
          className="flex items-center gap-2 rounded-lg border px-3 py-2"
          style={{ background: "var(--surface)", borderColor: "var(--border2)" }}
        >
          <Search className="size-4 text-text3" />
          <input
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder={t("search.placeholder", "Cerca nome, azienda, email, telefono, ruolo...")}
            aria-label={t("search.label", "Cerca referente")}
          />
        </div>
        <select
          className="pc-input"
          value={clientFilter}
          onChange={(event) => setClientFilter(event.target.value)}
          aria-label={t("filters.clientLabel", "Filtra per azienda")}
        >
          <option value="all">{t("filters.allCompanies", "Tutte le aziende")}</option>
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
          aria-label={t("filters.roleLabel", "Filtra per ruolo")}
        >
          <option value="all">{t("filters.allRoles", "Tutti i ruoli")}</option>
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
          aria-label={t("filters.departmentLabel", "Filtra per reparto")}
        >
          <option value="all">{t("filters.allDepartments", "Tutti i reparti")}</option>
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
          aria-label={t("filters.statusLabel", "Filtra per stato")}
        >
          <option value="all">{t("filters.allStatuses", "Tutti gli stati")}</option>
          <option value="primary">{t("filters.primary", "Referente principale")}</option>
          <option value="portalActive">{t("filters.portalActive", "Portale attivo")}</option>
          <option value="missingEmail">{t("filters.missingEmail", "Senza email")}</option>
        </select>
      </div>

      <div className="hidden md:block">
        <div
          ref={sectionContainerRef}
          className="space-y-4 p-4"
          style={{ maxHeight: "calc(100vh - 200px)", overflow: "auto" }}
        >
          {groupedContacts.length > 20 ? (
            <div style={{ height: sectionTotalSize, position: "relative" }}>
              {virtualSections.map((virtualSection) => {
                const [, group] = groupedContacts[virtualSection.index];
                return (
                  <div
                    key={virtualSection.key}
                    ref={sectionVirtualizer.measureElement}
                    data-index={virtualSection.index}
                    style={{
                      position: "absolute",
                      top: 0,
                      transform: `translateY(${virtualSection.start}px)`,
                      left: 0,
                      right: 0,
                      paddingBottom: "16px",
                    }}
                  >
                    <section className="rounded-xl border" style={{ borderColor: "var(--border)" }}>
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
                          <Building2 className="size-4 shrink-0 text-text3" />
                          <span className="truncate text-sm font-bold text-text">
                            {group.client
                              ? clientName(group.client)
                              : t("contact.noClient", "Cliente non associato")}
                          </span>
                        </button>
                        <span className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-text3">
                          {t("contact.count", "{{count}} referenti", { count: group.rows.length })}
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
                  </div>
                );
              })}
            </div>
          ) : (
            groupedContacts.map(([clientId, group]) => (
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
                    <Building2 className="size-4 shrink-0 text-text3" />
                    <span className="truncate text-sm font-bold text-text">
                      {group.client
                        ? clientName(group.client)
                        : t("contact.noClient", "Cliente non associato")}
                    </span>
                  </button>
                  <span className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-text3">
                    {t("contact.count", "{{count}} referenti", { count: group.rows.length })}
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
            ))
          )}
          {!filteredContacts.length && !listQuery.isLoading && groupedContacts.length === 0 && (
            <div
              className="rounded-xl border border-dashed py-12 text-center text-sm text-text3"
              style={{ borderColor: "var(--border)" }}
            >
              {t("emptyState.noResults", "Nessun referente trovato con i filtri correnti.")}
            </div>
          )}
          {listQuery.isLoading && (
            <div className="py-8 text-center text-sm text-text3">
              {t("loading", "Caricamento referenti...")}
            </div>
          )}
          {listQuery.isFetchingNextPage && (
            <div className="py-4 text-center text-sm text-text3">
              {t("loadingMore", "Caricamento altri referenti...")}
            </div>
          )}
          <div ref={desktopSentinelRef} className="h-px" />
        </div>
      </div>

      <div
        ref={mobileContainerRef}
        className="md:hidden"
        style={{
          maxHeight: filteredContacts.length > 20 ? "calc(100vh - 200px)" : undefined,
          overflow: filteredContacts.length > 20 ? "auto" : undefined,
        }}
      >
        {filteredContacts.length > 20 ? (
          <div style={{ position: "relative", height: mobileVirtualTotalSize }}>
            {mobileVirtualItems.map((virtualItem) => {
              const contact = filteredContacts[virtualItem.index];
              return (
                <div
                  key={contact.id}
                  ref={mobileVirtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    transform: `translateY(${virtualItem.start}px)`,
                    left: 0,
                    right: 0,
                    marginBottom: "12px",
                  }}
                >
                  <GlobalContactCard
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
                </div>
              );
            })}
          </div>
        ) : !filteredContacts.length && !listQuery.isLoading ? (
          <div className="p-4">
            <div
              className="rounded-xl border border-dashed py-12 text-center text-sm text-text3"
              style={{ borderColor: "var(--border)" }}
            >
              {t("emptyState.noResults", "Nessun referente trovato con i filtri correnti.")}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 p-4">
            {filteredContacts.map((contact) => (
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
        )}
        {listQuery.isLoading && (
          <div className="p-4 text-center text-sm text-text3">
            {t("loading", "Caricamento referenti...")}
          </div>
        )}
        {listQuery.isFetchingNextPage && (
          <div className="p-4 text-center text-sm text-text3">
            {t("loadingMore", "Caricamento altri referenti...")}
          </div>
        )}
        <div ref={mobileSentinelRef} className="h-px" />
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
        title={t("deleteDialog.title", "Eliminare questo referente?")}
        description={
          deleteTarget
            ? t(
                "deleteDialog.descriptionWithName",
                'Il referente "{{name}}" verrà rimosso da {{client}}. L\'azione non può essere annullata.',
                {
                  name: contactLabel(deleteTarget),
                  client: deleteTarget.client
                    ? clientName(deleteTarget.client)
                    : t("deleteDialog.thisClient", "questo cliente"),
                },
              )
            : t(
                "deleteDialog.description",
                "Il referente verrà rimosso dal cliente. L'azione non può essere annullata.",
              )
        }
        confirmLabel={t("deleteDialog.confirmLabel", "Elimina referente")}
        loadingLabel={t("deleteDialog.loadingLabel", "Eliminazione...")}
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
  const { t } = useTranslation("contacts");
  const name = contactLabel(contact) || t("contact.defaultName", "Referente");

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
                <Star className="size-3" /> {t("contact.primaryBadge", "Principale")}
              </span>
            )}
            <PortalBadge active={contact.portal_active} />
          </div>
          <button
            className="mt-1 inline-flex max-w-full items-center gap-1 text-left text-[12px] font-semibold text-text2 hover:text-accent"
            onClick={onOpenClient}
            title={
              contact.client
                ? clientName(contact.client)
                : t("contact.noClient", "Cliente non associato")
            }
          >
            <Building2 className="size-3 shrink-0" />
            <span className="truncate">
              {contact.client
                ? clientName(contact.client)
                : t("contact.noClient", "Cliente non associato")}
            </span>
          </button>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-text3">
            <span className="inline-flex items-center gap-1">
              <Briefcase className="size-3" />{" "}
              {contact.job_title || t("contact.noRole", "Ruolo non indicato")}
            </span>
            {contact.department && (
              <span className="inline-flex items-center gap-1">
                <Building2 className="size-3" /> {contact.department}
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
            <Mail className="h-3.5 w-3.5" /> {t("contact.missingEmail", "Email mancante")}
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
            <Phone className="h-3.5 w-3.5" /> {t("contact.missingPhone", "Telefono mancante")}
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-1.5">
        <button className="pc-btn pc-btn-ghost pc-btn-xs" disabled={!canEdit} onClick={onEdit}>
          <Pencil className="size-3" /> {t("contact.editButton", "Modifica")}
        </button>
        <button
          className="pc-btn pc-btn-ghost pc-btn-xs"
          disabled={!canManagePortalAccess || busy}
          onClick={onGeneratePortalLink}
        >
          <Link2 className="size-3" /> {t("contact.portalButton", "Portale")}
        </button>
        <button
          className="pc-btn-icon touch-target"
          disabled={!canDelete}
          onClick={onDelete}
          title={t("contact.deleteButtonTooltip", "Elimina referente")}
        >
          <Trash2 className="size-3" />
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
  const { t } = useTranslation("contacts");
  return (
    <Modal
      open={!!editing}
      onClose={onClose}
      title={t("editModal.title", "Modifica referente")}
      footer={
        <>
          <button className="pc-btn pc-btn-ghost" onClick={onClose} disabled={busy}>
            {t("editModal.cancelButton", "Annulla")}
          </button>
          <button className="pc-btn pc-btn-primary" onClick={onSave} disabled={busy || !canEdit}>
            {t("editModal.saveButton", "Salva referente")}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label={t("editModal.fullNameLabel", "Nome e cognome *")}>
          <input
            className="pc-input"
            value={form.full_name}
            onChange={(event) =>
              setForm((current) => ({ ...current, full_name: event.target.value }))
            }
          />
        </Field>
        <Field label={t("editModal.emailLabel", "Email")}>
          <input
            className="pc-input"
            type="email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          />
        </Field>
        <Field label={t("editModal.phoneLabel", "Telefono")}>
          <input
            className="pc-input"
            value={form.phone}
            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
          />
        </Field>
        <Field label={t("editModal.roleLabel", "Ruolo")}>
          <input
            className="pc-input"
            value={form.job_title}
            onChange={(event) =>
              setForm((current) => ({ ...current, job_title: event.target.value }))
            }
          />
        </Field>
        <Field label={t("editModal.departmentLabel", "Reparto")}>
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
          {t("editModal.isPrimaryLabel", "Referente principale")}
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
  const { t } = useTranslation("contacts");
  return (
    <Modal
      open={!!portalLink}
      onClose={onClose}
      title={t("portalModal.title", "Link accesso portale")}
      footer={
        <>
          <button className="pc-btn pc-btn-ghost" onClick={onClose}>
            {t("portalModal.closeButton", "Chiudi")}
          </button>
          <button className="pc-btn pc-btn-primary" onClick={onCopy}>
            {copied ? (
              <>
                <CheckCircle2 className="size-3" /> {t("portalModal.copiedButton", "Copiato")}
              </>
            ) : (
              <>
                <Copy className="size-3" /> {t("portalModal.copyLinkButton", "Copia link")}
              </>
            )}
          </button>
        </>
      }
    >
      {portalLink && (
        <div className="flex flex-col gap-3">
          <div>
            <div className="pc-label">{t("portalModal.contactLabel", "Referente")}</div>
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

function PortalBadge({ active }: { active: boolean }) {
  const { t } = useTranslation("contacts");
  return (
    <span
      className="inline-flex rounded-full px-2 py-0.5 text-[10.5px] font-bold"
      style={{
        background: active ? "rgba(22, 163, 74, .12)" : "var(--surface2)",
        color: active ? "#15803d" : "var(--text3)",
      }}
    >
      {active ? t("portalBadge.active", "Attivo") : t("portalBadge.noAccess", "Nessun accesso")}
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
