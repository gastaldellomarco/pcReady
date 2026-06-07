import { useQueryClient } from "@tanstack/react-query";
import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Copy,
  GitCompare,
  GitMerge,
  History,
  Link2,
  Lock,
  LogIn,
  Mail,
  Pencil,
  Phone,
  Search,
  Send,
  Star,
  Ticket,
  Trash2,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Modal } from "@/components/pcready/Modal";
import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm-dialog";
import { Field } from "@/components/ui/form-field";
import { useVirtualList } from "@/hooks/useVirtualList";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { openTicketDetail } from "@/lib/detail-navigation";
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
  private_note: string;
  availability_status: string;
  return_date: string;
  group_id: string;
};

function ContactsPage() {
  const { t } = useTranslation("contacts");
  const { canEdit, profile, session } = useAuth();
  const canDelete = profile?.role === "admin";
  const canManagePortalAccess = profile?.role === "admin" || profile?.role === "tech";
  const qc = useQueryClient();
  const navigate = useNavigate();
  const generatePortalLink = useServerFn(generatePortalAccessLink);
  const { useGlobalContactsInfiniteList, useToggleStarContact, useContactInteractionHistory, useDuplicateCandidates, useMergeContacts } = queries as any;
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
    "all" | "primary" | "portalActive" | "missingEmail" | "starred"
  >("all");
  const [editing, setEditing] = useState<GlobalContactRow | null>(null);
  const [detailContact, setDetailContact] = useState<GlobalContactRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GlobalContactRow | null>(null);
  const [mergeWizardOpen, setMergeWizardOpen] = useState(false);
  const [form, setForm] = useState<ContactForm>(emptyContactForm);
  const [busy, setBusy] = useState(false);
  const [portalLink, setPortalLink] = useState<{
    contactName: string;
    clientName: string;
    loginUrl: string;
    expiresAt: string;
  } | null>(null);
  const [copiedPortalLink, setCopiedPortalLink] = useState(false);
  const toggleStarMut = useToggleStarContact();

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
    if (statusFilter === "starred" && !contact.is_starred) return false;
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
      private_note: contact.private_note ?? "",
      availability_status: contact.availability_status ?? "",
      return_date: contact.return_date ?? "",
      group_id: contact.group_id ?? "",
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
          private_note: clean(form.private_note),
          availability_status: form.availability_status || null,
          return_date: form.return_date || null,
          group_id: form.group_id || null,
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
        <div className="flex items-center gap-2">
          <button
            className="pc-btn pc-btn-ghost pc-btn-xs"
            onClick={() => setMergeWizardOpen(true)}
            title={t("merge.title", "Unisci contatti duplicati")}
          >
            <GitMerge className="size-3" /> {t("merge.title", "Unisci duplicati")}
          </button>
          <Users className="size-5 text-text3" />
        </div>
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
          <option value="starred">{t("filters.starred", "Preferiti")}</option>
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
                            onToggleStar={(starred) => toggleStarMut.mutate({ contactId: contact.id, isStarred: starred })}
                            onOpenClient={() =>
                              void navigate({
                                to: "/clients",
                                search: { clientId: contact.client_id, tab: "contacts" },
                              })
                            }
                            onEdit={() => openEdit(contact)}
                            onGeneratePortalLink={() => generateContactPortalLink(contact)}
                            onDelete={() => setDeleteTarget(contact)}
                            onViewDetail={() => setDetailContact(contact)}
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
                      onToggleStar={(starred) => toggleStarMut.mutate({ contactId: contact.id, isStarred: starred })}
                      onOpenClient={() =>
                        void navigate({
                          to: "/clients",
                          search: { clientId: contact.client_id, tab: "contacts" },
                        })
                      }
                      onEdit={() => openEdit(contact)}
                      onGeneratePortalLink={() => generateContactPortalLink(contact)}
                      onDelete={() => setDeleteTarget(contact)}
                      onViewDetail={() => setDetailContact(contact)}
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
                    onToggleStar={(starred) => toggleStarMut.mutate({ contactId: contact.id, isStarred: starred })}
                    onOpenClient={() =>
                      void navigate({
                        to: "/clients",
                        search: { clientId: contact.client_id, tab: "contacts" },
                      })
                    }
                    onEdit={() => openEdit(contact)}
                    onGeneratePortalLink={() => generateContactPortalLink(contact)}
                    onDelete={() => setDeleteTarget(contact)}
                    onViewDetail={() => setDetailContact(contact)}
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
                onToggleStar={(starred) => toggleStarMut.mutate({ contactId: contact.id, isStarred: starred })}
                onOpenClient={() =>
                  void navigate({
                    to: "/clients",
                    search: { clientId: contact.client_id, tab: "contacts" },
                  })
                }
                onEdit={() => openEdit(contact)}
                onGeneratePortalLink={() => generateContactPortalLink(contact)}
                onDelete={() => setDeleteTarget(contact)}
                onViewDetail={() => setDetailContact(contact)}
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
      <ContactDetailModal
        contact={detailContact}
        useContactInteractionHistory={useContactInteractionHistory}
        onClose={() => setDetailContact(null)}
      />
      <MergeDuplicatesWizard
        open={mergeWizardOpen}
        clients={clients}
        useDuplicateCandidates={useDuplicateCandidates}
        useMergeContacts={useMergeContacts}
        canEdit={canEdit}
        onClose={() => setMergeWizardOpen(false)}
        onMerged={() => {
          setMergeWizardOpen(false);
          void qc.invalidateQueries({ queryKey: ["clients"] });
        }}
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
  onToggleStar,
  onOpenClient,
  onEdit,
  onGeneratePortalLink,
  onDelete,
  onViewDetail,
}: {
  contact: GlobalContactRow;
  busy: boolean;
  canDelete: boolean;
  canEdit: boolean;
  canManagePortalAccess: boolean;
  onToggleStar: (starred: boolean) => void;
  onOpenClient: () => void;
  onEdit: () => void;
  onGeneratePortalLink: () => void;
  onDelete: () => void;
  onViewDetail: () => void;
}) {
  const { t } = useTranslation("contacts");
  const name = contactLabel(contact) || t("contact.defaultName", "Referente");
  const av = contactAvailability(contact, t as any);

  return (
    <div
      className="rounded-xl border p-4 relative"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      {/* Star toggle */}
      <button
        className="absolute top-3 right-3 p-1 rounded-md hover:bg-[var(--surface2)] transition-colors"
        disabled={!canEdit}
        onClick={() => onToggleStar(!contact.is_starred)}
        title={contact.is_starred ? t("starred.toggleOff", "Rimuovi dai preferiti") : t("starred.toggleOn", "Aggiungi ai preferiti")}
      >
        <Star
          className="size-4"
          style={{
            fill: contact.is_starred ? "var(--warn)" : "none",
            color: contact.is_starred ? "var(--warn)" : "var(--text3)",
          }}
        />
      </button>        <div className="flex items-start gap-3 pr-8">
        <button
          type="button"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent hover:opacity-80 transition-opacity cursor-pointer"
          onClick={onViewDetail}
        >
          {contactInitials(contact)}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="truncate text-left text-sm font-bold text-accent"
              onClick={onViewDetail}
            >
              {name}
            </button>
            {contact.is_primary && (
              <span className="inline-flex items-center gap-1 rounded-full bg-warn-bg px-2 py-0.5 text-[10px] font-bold text-warn">
                <Star className="size-3" /> {t("contact.primaryBadge", "Principale")}
              </span>
            )}
            <PortalBadge active={contact.portal_active} />
            {av.badge && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{ background: av.badge.color + "20", color: av.badge.color }}
              >
                <Calendar className="size-3" /> {av.badge.label}
              </span>
            )}
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
            {contact.private_note && (canEdit || canManagePortalAccess) && (
              <span
                className="inline-flex items-center gap-1 cursor-help"
                title={t("privateNote.hasNoteTitle", "Nota privata") + ": " + contact.private_note}
              >
                <Lock className="size-3" />
              </span>
            )}
          </div>
        </div>
      </div>

      {av.returnText && (
        <div className="mt-2 text-[11px] font-medium" style={{ color: "var(--text3)" }}>
          {av.returnText}
        </div>
      )}

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
  const { useContactGroups } = queries as any;
  const clientId = editing?.client_id ?? null;
  const groupsQuery = useContactGroups(clientId);
  const groups = (groupsQuery.data ?? []) as { id: string; name: string }[];

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
        <Field label={t("editModal.groupLabel", "Gruppo")}>
          <select
            className="pc-input"
            value={form.group_id}
            onChange={(event) => setForm((current) => ({ ...current, group_id: event.target.value }))}
          >
            <option value="">{t("editModal.groupNone", "Nessun gruppo")}</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </Field>
        <Field label={t("editModal.availabilityLabel", "Disponibilità")}>
          <select
            className="pc-input"
            value={form.availability_status}
            onChange={(event) => setForm((current) => ({ ...current, availability_status: event.target.value }))}
          >
            <option value="">{t("editModal.availabilityNone", "Disponibile")}</option>
            <option value="vacation">{t("editModal.availabilityVacation", "In ferie")}</option>
            <option value="sick_leave">{t("editModal.availabilitySickLeave", "In malattia")}</option>
            <option value="unavailable">{t("editModal.availabilityUnavailable", "Non disponibile")}</option>
          </select>
        </Field>
        {form.availability_status && (
          <Field label={t("editModal.returnDateLabel", "Data rientro")}>
            <input
              className="pc-input"
              type="date"
              value={form.return_date}
              onChange={(event) => setForm((current) => ({ ...current, return_date: event.target.value }))}
            />
          </Field>
        )}
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
        <div className="md:col-span-2">
          <Field label={t("editModal.privateNoteLabel", "Nota privata (solo tech/admin)")}>
            <textarea
              className="pc-input min-h-[72px]"
              value={form.private_note}
              onChange={(event) => setForm((current) => ({ ...current, private_note: event.target.value }))}
            />
          </Field>
        </div>
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

function ContactDetailModal({
  contact,
  useContactInteractionHistory,
  onClose,
}: {
  contact: GlobalContactRow | null;
  useContactInteractionHistory: (id: string | null) => { data?: any[]; isLoading: boolean };
  onClose: () => void;
}) {
  const { t } = useTranslation("contacts");
  const [activeTab, setActiveTab] = useState<"info" | "interactions">("info");
  const historyQuery = useContactInteractionHistory(contact?.id ?? null);
  const historyItems = (historyQuery.data ?? []) as import("@/lib/queries/clients").ContactInteractionItem[];

  if (!contact) return null;

  const contactName = contactLabel(contact) || contact.email || t("contact.defaultName", "Referente");
  const av = contactAvailability(contact, t as any);

  return (
    <Modal
      open={!!contact}
      onClose={onClose}
      title={contactName}
      size="xl"
    >
      {/* Contact info header */}
      <div
        className="-mx-4 -mt-4 mb-4 rounded-t-lg border-b px-4 pb-4 sm:-mx-[22px] sm:-mt-[20px] sm:px-[22px] sm:pb-5"
        style={{ background: "var(--surface2)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-3 pt-4 sm:pt-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-soft text-base font-bold text-accent">
            {contactInitials(contact)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-[15px] font-bold" style={{ fontFamily: "var(--font-head)" }}>
                {contactName}
              </span>
              {contact.is_primary && (
                <span className="inline-flex items-center gap-1 rounded-full bg-warn-bg px-2 py-0.5 text-[10px] font-bold text-warn">
                  <Star className="size-3" /> {t("contact.primaryBadge", "Principale")}
                </span>
              )}
              <PortalBadge active={contact.portal_active} />
              {av.badge && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{ background: av.badge.color + "20", color: av.badge.color }}
                >
                  <Calendar className="size-3" /> {av.badge.label}
                </span>
              )}
            </div>
            {contact.client && (
              <span className="mt-0.5 inline-flex items-center gap-1 text-[12.5px] font-semibold text-text2">
                <Building2 className="size-3 shrink-0" />
                <span className="truncate">{clientName(contact.client)}</span>
              </span>
            )}
          </div>
        </div>

        {/* Quick contact actions */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11.5px] font-semibold text-text2 hover:text-accent"
              style={{ borderColor: "var(--border)" }}
            >
              <Mail className="size-3" /> {t("detail.emailLabel", "Email")}
            </a>
          )}
          {contact.phone && (
            <a
              href={`tel:${contact.phone}`}
              className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11.5px] font-semibold text-text2 hover:text-accent"
              style={{ borderColor: "var(--border)" }}
            >
              <Phone className="size-3" /> {t("detail.phoneLabel", "Telefono")}
            </a>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b" style={{ borderColor: "var(--border)" }}>
        <button
          type="button"
          className="px-3 py-2 text-[12.5px] font-semibold transition-colors"
          style={{
            borderBottom: activeTab === "info" ? "2px solid var(--accent)" : "2px solid transparent",
            color: activeTab === "info" ? "var(--accent)" : "var(--text3)",
          }}
          onClick={() => setActiveTab("info")}
        >
          {t("detail.tabInfo", "Info")}
        </button>
        <button
          type="button"
          className="px-3 py-2 text-[12.5px] font-semibold transition-colors"
          style={{
            borderBottom: activeTab === "interactions" ? "2px solid var(--accent)" : "2px solid transparent",
            color: activeTab === "interactions" ? "var(--accent)" : "var(--text3)",
          }}
          onClick={() => setActiveTab("interactions")}
        >
          {t("detail.tabInteractions", "Interazioni")}
          {historyItems.length > 0 && (
            <span className="ml-1.5 rounded-full bg-surface2 px-1.5 py-0.5 text-[10px] font-mono">
              {historyItems.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "info" ? (
        <div className="space-y-3">
          <InfoRow label={t("detail.clientLabel", "Cliente")} value={contact.client ? clientName(contact.client) : "-"} />
          <InfoRow label={t("detail.roleLabel", "Ruolo")} value={contact.job_title || "-"} />
          <InfoRow label={t("detail.departmentLabel", "Reparto")} value={contact.department || "-"} />
          <InfoRow label={t("detail.emailLabel", "Email")} value={contact.email || "-"} />
          <InfoRow label={t("detail.phoneLabel", "Telefono")} value={contact.phone || "-"} />
          <InfoRow
            label={t("detail.primaryLabel", "Referente principale")}
            value={contact.is_primary ? t("portalBadge.active", "Si") : "No"}
          />
          <InfoRow
            label={t("detail.portalStatusLabel", "Accesso portale")}
            value={contact.portal_active ? t("detail.portalStatusActive", "Attivo") : t("detail.portalStatusInactive", "Nessuno")}
          />
          {contact.group_id && (
            <InfoRow label={t("detail.groupLabel", "Gruppo")} value={contact.group_name || contact.group_id} />
          )}
          {contact.availability_status && (
            <InfoRow
              label={t("detail.availabilityLabel", "Disponibilità")}
              value={
                av.status
                  ? `${contactAvailabilityLabel(contact.availability_status, t)}${contact.return_date ? ` (${t("availability.returnLabel", "Rientro: {{date}}").replace("{{date}}", new Date(contact.return_date).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }))})` : ""}`
                  : t("detail.availabilityNone", "-")
              }
            />
          )}
          <InfoRow
            label={t("detail.privateNoteLabel", "Nota privata")}
            value={contact.private_note || t("detail.privateNoteEmpty", "Nessuna")}
          />
        </div>
      ) : (
        <InteractionTimeline
          items={historyItems}
          isLoading={historyQuery.isLoading}
          emptyLabel={t("detail.interactionsEmpty", "Nessuna interazione registrata.")}
        />
      )}
    </Modal>
  );
}

function contactAvailabilityLabel(status: string, t: any): string {
  const labels: Record<string, string> = {
    vacation: t("availability.vacation", "In ferie"),
    sick_leave: t("availability.sickLeave", "In malattia"),
    unavailable: t("availability.unavailable", "Non disponibile"),
    available: t("availability.available", "Disponibile"),
  };
  return labels[status] || status;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="shrink-0 text-[11.5px] font-semibold text-text3 w-36">{label}</span>
      <span className="text-[13px] text-text2 break-words">{value}</span>
    </div>
  );
}

function InteractionTimeline({
  items,
  isLoading,
  emptyLabel,
}: {
  items: import("@/lib/queries/clients").ContactInteractionItem[];
  isLoading: boolean;
  emptyLabel: string;
}) {
  const { t } = useTranslation("contacts");

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex animate-pulse gap-3">
            <div className="h-8 w-8 rounded-full bg-surface2" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-surface2" />
              <div className="h-3 w-1/2 rounded bg-surface2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="py-10 text-center text-sm text-text3">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {items.map((item, i) => {
        const icon = interactionIcon(item.type);
        const ticketId = item.link?.startsWith('/tickets?id=') ? item.link.slice('/tickets?id='.length) : null;
        return (
          <div key={item.id} className="relative flex gap-3 pb-5">
            {/* Timeline connector */}
            {i < items.length - 1 && (
              <div
                className="absolute left-[15px] top-8 bottom-0 w-px"
                style={{ background: "var(--border)" }}
              />
            )}
            {/* Icon */}
            <div
              className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={{ background: "var(--surface2)" }}
            >
              {icon}
            </div>
            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[12.5px] font-semibold text-text2">{item.title}</span>
                  {item.description && (
                    <span className="ml-1.5 text-[11.5px] text-text3">{item.description}</span>
                  )}
                </div>
                <span className="shrink-0 text-[10.5px] text-text3 font-mono">
                  {fmtDateTime(item.created_at)}
                </span>
              </div>
              <div className="mt-0.5">
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{
                    background: "var(--surface2)",
                    color: interactionColor(item.type),
                  }}
                >
                  <span className="size-1.5 rounded-full" style={{ background: interactionColor(item.type) }} />
                  {interactionLabel(item.type, t as any)}
                </span>
                {ticketId && (
                  <button
                    type="button"
                    className="ml-2 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold transition-colors hover:bg-[var(--surface2)]"
                    style={{ borderColor: "var(--border)", color: "var(--accent)" }}
                    onClick={() => openTicketDetail(ticketId)}
                  >
                    <Ticket className="size-3" />
                    {t("detail.viewTicket", "Vedi ticket")}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function interactionIcon(type: string) {
  switch (type) {
    case "ticket_opened":
    case "ticket_closed":
      return <Ticket className="size-3.5" style={{ color: "var(--text3)" }} />;
    case "portal_login":
      return <LogIn className="size-3.5" style={{ color: "var(--text3)" }} />;
    case "email_sent":
      return <Send className="size-3.5" style={{ color: "var(--text3)" }} />;
    default:
      return <History className="size-3.5" style={{ color: "var(--text3)" }} />;
  }
}

function interactionColor(type: string): string {
  switch (type) {
    case "ticket_opened":
      return "#3B82F6";
    case "ticket_closed":
      return "#22C55E";
    case "portal_login":
      return "#8B5CF6";
    case "email_sent":
      return "#F59E0B";
    default:
      return "var(--text3)";
  }
}

function interactionLabel(
  type: string,
  t: (key: string, fallback?: string) => string,
): string {
  switch (type) {
    case "ticket_opened":
      return t("detail.ticketOpened", "Ticket aperto");
    case "ticket_closed":
      return t("detail.ticketClosed", "Ticket chiuso");
    case "portal_login":
      return t("detail.portalLogin", "Accesso portale");
    case "email_sent":
      return t("detail.emailSent", "Email inviata");
    default:
      return type;
  }
}

function fmtDateTime(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

const MERGE_FIELDS = [
  { key: "full_name", labelKey: "fullNameLabel", fallback: "Nome e cognome" },
  { key: "email", labelKey: "emailLabel", fallback: "Email" },
  { key: "phone", labelKey: "phoneLabel", fallback: "Telefono" },
  { key: "job_title", labelKey: "roleLabel", fallback: "Ruolo" },
  { key: "department", labelKey: "departmentLabel", fallback: "Reparto" },
  { key: "notes", labelKey: "notesLabel", fallback: "Note" },
  { key: "private_note", labelKey: "privateNoteLabel", fallback: "Nota privata" },
  { key: "is_primary", labelKey: "isPrimaryLabel", fallback: "Principale" },
  { key: "is_starred", labelKey: "isStarredLabel", fallback: "Preferito" },
  { key: "availability_status", labelKey: "availabilityLabel", fallback: "Disponibilità" },
  { key: "return_date", labelKey: "returnDateLabel", fallback: "Data rientro" },
];

function MergeDuplicatesWizard({
  open,
  clients,
  useDuplicateCandidates: useDupCandidates,
  useMergeContacts: useMerge,
  canEdit,
  onClose,
  onMerged,
}: {
  open: boolean;
  clients: { id: string; name: string; company_name: string | null }[];
  useDuplicateCandidates: (id: string | null) => { data?: any[]; isLoading: boolean };
  useMergeContacts: () => { mutateAsync: (params: any) => Promise<any>; isPending: boolean };
  canEdit: boolean;
  onClose: () => void;
  onMerged: () => void;
}) {
  const { t } = useTranslation("contacts");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedPairIdx, setSelectedPairIdx] = useState<number | null>(null);
  const [fieldChoices, setFieldChoices] = useState<Record<string, "a" | "b">>({});
  const [deleteSource, setDeleteSource] = useState(true);
  const [survivorIsA, setSurvivorIsA] = useState(true);

  const candidatesQuery = useDupCandidates(selectedClientId || null);
  const mergeMut = useMerge();
  const candidates = (candidatesQuery.data ?? []) as import("@/lib/queries/clients").DuplicateCandidate[];
  const selectedPair = selectedPairIdx != null ? candidates[selectedPairIdx] : null;

  // Reset pair when candidates change
  useEffect(() => {
    setSelectedPairIdx(null);
  }, [candidates]);

  // Reset choices and survivor when pair changes
  useEffect(() => {
    setFieldChoices({});
    setSurvivorIsA(true);
  }, [selectedPairIdx]);

  const handleMerge = useCallback(async () => {
    if (!selectedPair) return;
    const actualSurvivorId = survivorIsA ? selectedPair.contactA.id : selectedPair.contactB.id;
    const actualSourceId = survivorIsA ? selectedPair.contactB.id : selectedPair.contactA.id;
    try {
      await mergeMut.mutateAsync({
        survivorId: actualSurvivorId,
        sourceId: actualSourceId,
        fieldChoices,
        deleteSource,
      });
      toast.success(t("merge.success", "Contatti uniti con successo"));
      onMerged();
    } catch (error) {
      toast.error(errorMessage(error, t("toast.saveError", "Errore salvataggio referente")));
    }
  }, [selectedPair, fieldChoices, deleteSource, mergeMut, t, onMerged, survivorIsA]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("merge.title", "Unisci contatti duplicati")}
      size="xl"
      footer={
        selectedPair ? (
          <>
            <button className="pc-btn pc-btn-ghost" onClick={onClose} disabled={mergeMut.isPending}>
              {t("merge.cancel", "Annulla")}
            </button>
            <button
              className="pc-btn pc-btn-primary"
              onClick={handleMerge}
              disabled={mergeMut.isPending || !canEdit}
            >
              <GitMerge className="size-3" />{" "}
              {mergeMut.isPending
                ? t("merge.executing", "Unione in corso...")
                : t("merge.execute", "Unisci contatti")}
            </button>
          </>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        {/* Step 1: Select client */}
        <div>
          <label className="pc-label">{t("merge.clientLabel", "Seleziona un cliente")}</label>
          <select
            className="pc-input mt-1"
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            aria-label={t("merge.clientLabel", "Seleziona un cliente")}
          >
            <option value="">{t("merge.clientPlaceholder", "Scegli un cliente per cercare duplicati...")}</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {clientName(c as any)}
              </option>
            ))}
          </select>
        </div>

        {/* Step 2: Show duplicate candidates */}
        {selectedClientId && (
          <div>
            {candidatesQuery.isLoading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-text3">
                <div className="size-4 animate-spin rounded-full border-2 border-text3 border-t-transparent" />
                {t("loading", "Caricamento...")}
              </div>
            ) : candidates.length === 0 ? (
              <div
                className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-text3"
                style={{ borderColor: "var(--border)" }}
              >
                {t("merge.noCandidates", "Nessun duplicato trovato per questo cliente.")}
              </div>
            ) : (
              <>
                <div className="mb-2 text-sm font-semibold text-text2">
                  {t("merge.hasCandidates", "{{count}} coppie di duplicati trovate", { count: candidates.length })}
                </div>
                <div className="space-y-2">
                  {candidates.map((pair, idx) => {
                    const a = pair.contactA;
                    const b = pair.contactB;
                    const similarity = Math.round(pair.similarity * 100);
                    const isSelected = selectedPairIdx === idx;
                    return (
                      <button
                        key={`${a.id}-${b.id}`}
                        type="button"
                        className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-surface2"
                        style={{
                          borderColor: isSelected ? "var(--accent)" : "var(--border)",
                          background: isSelected ? "var(--accent2)" : "var(--surface)",
                        }}
                        onClick={() => setSelectedPairIdx(idx)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-[13px] font-semibold">
                              <span className="truncate">{contactLabel(a) || a.email}</span>
                              <GitCompare className="size-3 shrink-0 text-text3" />
                              <span className="truncate">{contactLabel(b) || b.email}</span>
                            </div>
                            <div className="mt-0.5 flex flex-wrap gap-2 text-[11px] text-text3">
                              {a.email && <span>{a.email}</span>}
                              {a.email && b.email && <span>·</span>}
                              {b.email && <span>{b.email}</span>}
                            </div>
                          </div>
                          <span
                            className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                            style={{
                              background: similarity >= 90 ? "rgba(22, 163, 74, .12)" : "rgba(245, 158, 11, .12)",
                              color: similarity >= 90 ? "#15803d" : "#B45309",
                            }}
                          >
                            {t("merge.similarity", "{{value}}% corrispondenza", { value: similarity })}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 3: Field-by-field merge UI */}
        {selectedPair && (
          <div>
            {/* Survivor-aware display contacts */}
            {(() => {
              const displayA = survivorIsA ? selectedPair.contactA : selectedPair.contactB;
              const displayB = survivorIsA ? selectedPair.contactB : selectedPair.contactA;
              return (
              <>
            <div
              className="-mx-1 mb-3 rounded-lg border p-3"
              style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
            >
              <div className="mb-2 text-xs font-semibold text-text3">
                {t("merge.chooseSurvivor", "Scegli quale contatto mantenere come principale:")}
              </div>
              <div className="flex items-center gap-3">
                <label
                  className="flex cursor-pointer items-center gap-2 text-sm font-bold"
                  style={{ color: survivorIsA ? "var(--text)" : "var(--text3)" }}
                >
                  <input
                    type="radio"
                    name="survivor-swap"
                    checked={survivorIsA}
                    onChange={() => setSurvivorIsA(true)}
                  />
                  <span>{contactLabel(selectedPair.contactA) || selectedPair.contactA.email}</span>
                  {survivorIsA && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                      style={{ background: "var(--accent2)", color: "var(--accent)" }}
                    >
                      {t("merge.survivor", "Conservato")}
                    </span>
                  )}
                </label>
                <GitCompare className="size-4 shrink-0 text-text3" />
                <label
                  className="flex cursor-pointer items-center gap-2 text-sm font-bold"
                  style={{ color: !survivorIsA ? "var(--text)" : "var(--text3)" }}
                >
                  <input
                    type="radio"
                    name="survivor-swap"
                    checked={!survivorIsA}
                    onChange={() => setSurvivorIsA(false)}
                  />
                  <span>{contactLabel(selectedPair.contactB) || selectedPair.contactB.email}</span>
                  {!survivorIsA && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                      style={{ background: "var(--accent2)", color: "var(--accent)" }}
                    >
                      {t("merge.survivor", "Conservato")}
                    </span>
                  )}
                </label>
              </div>
              <div className="mt-1 text-[11px] text-text3">
                {t("merge.keepHeaderA", "Survivor (conservato)")} →{" "}
                {t("merge.keepHeaderB", "Source (sorgente)")}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th className="py-2 pr-3 font-semibold text-text3">
                      {t("merge.fieldName", "Campo")}
                    </th>
                    <th className="py-2 pr-3 font-semibold text-accent">
                      {survivorIsA
                        ? t("merge.fieldValueSurvivor", "Conservato")
                        : t("merge.fieldValueA", "Contatto A")}
                    </th>
                    <th className="py-2 font-semibold text-text3">
                      {!survivorIsA
                        ? t("merge.fieldValueSurvivor", "Conservato")
                        : t("merge.fieldValueB", "Contatto B")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {MERGE_FIELDS.map((field) => {
                    const aVal = String((displayA as any)[field.key] ?? "");
                    const bVal = String((displayB as any)[field.key] ?? "");
                    const aEmpty = !aVal || aVal === "null" || aVal === "";
                    const bEmpty = !bVal || bVal === "null" || bVal === "";
                    const winner = fieldChoices[field.key] ?? "a";
                    // For boolean fields, show a readable label
                    const displayValA = field.key === "is_primary" || field.key === "is_starred"
                      ? (aVal === "true" ? t("portalBadge.active", "Si") : "No")
                      : aVal;
                    const displayValB = field.key === "is_primary" || field.key === "is_starred"
                      ? (bVal === "true" ? t("portalBadge.active", "Si") : "No")
                      : bVal;

                    return (
                      <tr
                        key={field.key}
                        style={{ borderBottom: "1px solid var(--border)" }}
                      >
                        <td
                          className="py-2.5 pr-3 font-medium text-text2"
                          style={{
                            color: winner === "a" ? "var(--accent)" : "var(--text2)",
                          }}
                        >
                          {t(`editModal.${field.labelKey}`, field.fallback)}
                        </td>
                        <td className="py-2.5 pr-3">
                          <label className="flex cursor-pointer items-center gap-2">
                            <input
                              type="radio"
                              name={`field-${field.key}`}
                              checked={winner === "a"}
                              onChange={() =>
                                setFieldChoices((prev) => ({ ...prev, [field.key]: "a" }))
                              }
                            />
                            <span className={aEmpty ? "text-text3 italic" : "text-text"}>
                              {aEmpty ? "—" : displayValA}
                            </span>
                            {winner === "a" && !aEmpty && (
                              <span className="text-[10px] font-bold text-accent">
                                {t("merge.winner", "✓ Conservato")}
                              </span>
                            )}
                          </label>
                        </td>
                        <td className="py-2.5">
                          <label className="flex cursor-pointer items-center gap-2">
                            <input
                              type="radio"
                              name={`field-${field.key}`}
                              checked={winner === "b"}
                              onChange={() =>
                                setFieldChoices((prev) => ({ ...prev, [field.key]: "b" }))
                              }
                            />
                            <span className={bEmpty ? "text-text3 italic" : "text-text"}>
                              {bEmpty ? "—" : displayValB}
                            </span>
                            {winner === "b" && !bEmpty && (
                              <span className="text-[10px] font-bold text-accent">
                                {t("merge.winner", "✓ Conservato")}
                              </span>
                            )}
                          </label>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Delete source option */}
            <div
              className="mt-4 rounded-lg border p-3"
              style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
            >
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={deleteSource}
                  onChange={(e) => setDeleteSource(e.target.checked)}
                />
                <div>
                  <div className="text-[12.5px] font-semibold text-text2">
                    {t("merge.deleteSource", "Elimina il contatto sorgente dopo l'unione")}
                  </div>
                  <div className="text-[11px] text-text3">
                    {t("merge.deleteSourceHint", "Se non selezionato, il contatto sorgente verrà conservato ma marcato come unito.")}
                  </div>
                </div>
              </label>
            </div>
              </>
              );
            })()}
          </div>
        )}
      </div>
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
  private_note: "",
  availability_status: "",
  return_date: "",
  group_id: "",
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

function contactAvailability(contact: GlobalContactRow, t: any): {
  status: string;
  badge: { label: string; color: string } | null;
  returnText: string | null;
} {
  const status = contact.availability_status;
  const returnDate = contact.return_date;
  if (!status) return { status: "", badge: null, returnText: null };

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const isPastReturn = returnDate && new Date(returnDate).getTime() <= now.getTime();

  if (isPastReturn) return { status: "", badge: null, returnText: null };

  const labels: Record<string, string> = {
    vacation: t("availability.vacation", "In ferie"),
    sick_leave: t("availability.sickLeave", "In malattia"),
    unavailable: t("availability.unavailable", "Non disponibile"),
  };
  const colors: Record<string, string> = {
    vacation: "#F59E0B",
    sick_leave: "#EF4444",
    unavailable: "#6B7280",
  };

  const label = labels[status] ?? status;
  const color = colors[status] ?? "#6B7280";
  const returnText = returnDate
    ? t("availability.returnLabel", "Rientro: {{date}}").replace("{{date}}", new Date(returnDate).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }))
    : null;

  return { status, badge: { label, color }, returnText };
}
