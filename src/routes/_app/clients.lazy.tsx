import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Building2,
  Bell,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  FileUp,
  FileText,
  HardDrive,
  History,
  Link2,
  Pencil,
  Plus,
  Save,
  Search,
  Star,
  Tags,
  Trash2,
  Ticket,
  Upload,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ListSkeleton, PageFetchError } from "@/components/page-states";
import { Modal } from "@/components/pcready/Modal";
import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm-dialog";
import { Field } from "@/components/ui/form-field";
import OverflowTable from "@/components/ui/overflow-table";
import { useTickets } from "@/hooks/use-tickets";
import { useVirtualList } from "@/hooks/useVirtualList";
import i18n from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { openDeviceDetail, openTicketDetail } from "@/lib/detail-navigation";
import { downloadCsv } from "@/lib/downloads";
import { errorMessage } from "@/lib/errors";
import { formatMoney } from "@/lib/format";
import { fmtDate } from "@/lib/pcready";
import { generatePortalAccessLink, revokePortalAccessLink } from "@/lib/portal-auth";
import queries from "@/lib/queries/clients";
import { LIST_PAGE_SIZE } from "@/lib/queries/list-config";
import {
  ClientSchema,
  ContactSchema,
  type ClientInput,
  type ContactInput,
} from "@/lib/schemas/clients";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export const Route = createLazyFileRoute("/_app/clients")({
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
  website_url: string | null;
  address: string | null;
  notes: string | null;
  portal_enabled?: boolean;
  portal_logo_url?: string | null;
  portal_primary_color?: string | null;
  portal_welcome_message?: string | null;
  portal_name?: string | null;
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
  website_url: string;
  address: string;
  notes: string;
  portal_logo_url: string;
  portal_primary_color: string;
  portal_welcome_message: string;
  portal_name: string;
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

type ClientTab = "overview" | "info" | "notes" | "contacts" | "tickets" | "devices" | "activity" | "documents" | "settings";
type ClientListFilter = "all" | "openTickets" | "portalActive";
type DestructiveAction =
  | { type: "client"; client: ClientRow }
  | { type: "bulkClients"; ids: string[] }
  | { type: "contact"; contact: ContactRow }
  | { type: "revokePortal"; contact: ContactRow };

type TicketRow = {
  id: string;
  ticket_code: string;
  requester: string | null;
  software: string | null;
  status: string;
  priority: string;
  created_at: string;
  assignee?: { full_name: string | null; initials: string | null } | null;
};

type DeviceRow = {
  id: string;
  asset_tag: string | null;
  model: string;
  serial: string | null;
  os: string | null;
  status: "available" | "assigned" | "maintenance" | "retired";
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
};

const emptyClient: ClientForm = {
  company_name: "",
  vat_number: "",
  fiscal_code: "",
  email: "",
  phone: "",
  website_url: "",
  address: "",
  notes: "",
  portal_logo_url: "",
  portal_primary_color: "#1B4FD8",
  portal_welcome_message: "",
  portal_name: "",
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

const PAGE_SIZE = LIST_PAGE_SIZE;
const EXPORT_CHUNK_SIZE = 1000;
const CLIENT_SELECT =
  "id, name, company_name, vat_number, fiscal_code, email, phone, website_url, address, notes, portal_logo_url, portal_primary_color, portal_welcome_message, portal_name, updated_at";

function ClientsPage() {
  const { canEdit, profile, session } = useAuth();
  const { t } = useTranslation("clients");
  const navigate = useNavigate();
  const routeSearch = Route.useSearch();
  const qc = useQueryClient();
  const { openCreate, openAddDevice } = useTickets();
  const canDelete = profile?.role === "admin";
  const canManagePortalAccess = profile?.role === "admin" || profile?.role === "tech";
  const generatePortalLink = useServerFn(generatePortalAccessLink);
  const revokePortalLink = useServerFn(revokePortalAccessLink);
  const [extraClients, setExtraClients] = useState<ClientRow[]>([]);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [q, setQ] = useState("");
  const [listFilter, setListFilter] = useState<ClientListFilter>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<ClientTab>("overview");
  const [importOpen, setImportOpen] = useState(false);
  const [contactImportOpen, setContactImportOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [destructiveAction, setDestructiveAction] = useState<DestructiveAction | null>(null);
  const [portalLink, setPortalLink] = useState<{
    contactName: string;
    clientName: string;
    loginUrl: string;
    expiresAt: string;
  } | null>(null);
  const [copiedPortalLink, setCopiedPortalLink] = useState(false);
  const [portalBusyContactId, setPortalBusyContactId] = useState<string | null>(null);
  const [portalRevokingContactId, setPortalRevokingContactId] = useState<string | null>(null);
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

  const {
    useClientsInfiniteList,
    useClientContacts,
    useClientStats,
    useContactPortalAccess,
    useClientTickets,
    useClientDevices,
    useClientTags,
    useClientTagAssignments,
    useClientOverview,
  } = queries as any;
  const listQuery = useClientsInfiniteList({ q, pageSize: PAGE_SIZE });
  const {
    useCreateClient,
    useUpdateClient,
    useDeleteClient,
    useBulkDeleteClients,
    useCreateContact,
    useUpdateContact,
    useDeleteContact,
  } = queries as any;

  const createClientMut = useCreateClient();
  const updateClientMut = useUpdateClient();
  const deleteClientMut = useDeleteClient();
  const bulkDeleteMut = useBulkDeleteClients();
  const createContactMut = useCreateContact();
  const updateContactMut = useUpdateContact();
  const deleteContactMut = useDeleteContact();
  const clients = useMemo(() => {
    const fromPages = (listQuery.data?.pages ?? []).flatMap(
      (p) => (p.data ?? []) as ClientRow[],
    );
    if (!extraClients.length) return fromPages;
    const pageIds = new Set(fromPages.map((c) => c.id));
    const uniqueExtras = extraClients.filter((c) => !pageIds.has(c.id));
    return [...uniqueExtras, ...fromPages];
  }, [listQuery.data, extraClients]);
  const total = useMemo(
    () => listQuery.data?.pages[0]?.count ?? 0,
    [listQuery.data],
  );
  const hasNextPage = listQuery.hasNextPage;
  const isFetchingNextPage = listQuery.isFetchingNextPage;
  const clientIds = useMemo(() => clients.map((client) => client.id), [clients]);
  const statsQuery = useClientStats(clientIds);
  const tagsQuery = useClientTags();
  const tagAssignmentsQuery = useClientTagAssignments(clientIds);

  useEffect(() => {
    if (!clients.length) return;
    setSelectedId((cur) => {
      if (routeSearch.clientId && clients.some((c) => c.id === routeSearch.clientId)) {
        return routeSearch.clientId;
      }
      return cur && clients.some((c) => c.id === cur) ? cur : clients[0]?.id || null;
    });
    setSelectedIds((current) => {
      const loadedIds = new Set(clients.map((c) => c.id));
      const next = new Set<string>();
      for (const id of current) {
        if (loadedIds.has(id)) next.add(id);
      }
      return next;
    });
  }, [clients, routeSearch.clientId]);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          void listQuery.fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, listQuery.fetchNextPage]);

  useEffect(() => {
    setExtraClients([]);
  }, [q]);

  useEffect(() => {
    if (routeSearch.tab) setActiveTab(routeSearch.tab as ClientTab);
  }, [routeSearch.tab]);

  useEffect(() => {
    if (!routeSearch.clientId || clients.some((client) => client.id === routeSearch.clientId))
      return;
    let cancelled = false;
    (supabase as any)
      .from("clients")
      .select(CLIENT_SELECT)
      .eq("id", routeSearch.clientId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        const row = data as ClientRow;
        setExtraClients((current) =>
          current.some((c) => c.id === row.id) ? current : [row, ...current],
        );
        setSelectedId(row.id);
      });
    return () => {
      cancelled = true;
    };
  }, [clients, routeSearch.clientId]);

  useEffect(() => {
    setActiveTab((routeSearch.tab as ClientTab | undefined) ?? "overview");
    setContactModalOpen(false);
    setEditingContactId(null);
    contactForm.reset(emptyContact as ContactInput);
  }, [selectedId, contactForm, routeSearch.tab]);

  const contactsQuery = useClientContacts(selectedId);
  const contactIds = useMemo(() => contacts.map((contact) => contact.id), [contacts]);
  const portalAccessQuery = useContactPortalAccess(contactIds);
  const ticketsQuery = useClientTickets(selectedId);
  const devicesQuery = useClientDevices(selectedId);
  const overviewQuery = useClientOverview(selectedId);
  useEffect(() => {
    if (!selectedId) {
      setContacts([]);
      clientForm.reset(emptyClient as ClientInput);
      return;
    }
    const client = clients.find((c) => c.id === selectedId);
    if (client) clientForm.reset(toClientForm(client) as ClientInput);
    if (contactsQuery.data) setContacts(contactsQuery.data as ContactRow[]);
  }, [selectedId, clients, clientForm, contactsQuery.data]);

  const selected = clients.find((c) => c.id === selectedId) || null;
  const stats = (statsQuery.data ?? {}) as Record<
    string,
    import("@/lib/queries/clients").ClientStats
  >;
  const selectedStats = selected?.id
    ? (stats[selected.id] ?? {
        openTickets: 0,
        devices: 0,
        contacts: contacts.length,
        portalActive: false,
      })
    : { openTickets: 0, devices: 0, contacts: contacts.length, portalActive: false };
  const portalAccess = (portalAccessQuery.data ?? {}) as Record<string, boolean>;
  const tickets = ((ticketsQuery.data ?? []) as TicketRow[]).slice().sort(compareTickets);
  const devices = (devicesQuery.data ?? []) as DeviceRow[];
  const tagAssignments = (tagAssignmentsQuery.data ?? {}) as Record<string, import("@/lib/queries/clients").ClientTag[]>;
  const allTags = (tagsQuery.data ?? []) as import("@/lib/queries/clients").ClientTag[];
  const selectedOverview = overviewQuery.data as import("@/lib/queries/clients").ClientOverview | null | undefined;
  const selectedTags = selectedId ? tagAssignments[selectedId] ?? [] : [];
  const displayedClients = clients.filter((client) => {
    const clientStats = stats[client.id] ?? {
      openTickets: 0,
      devices: 0,
      contacts: 0,
      portalActive: false,
    };
    const tagMatch = tagFilter === "all" || (tagAssignments[client.id] ?? []).some((tag) => tag.id === tagFilter);
    if (!tagMatch) return false;
    if (listFilter === "openTickets") return clientStats.openTickets > 0;
    if (listFilter === "portalActive")
      return Boolean(client.portal_enabled) || clientStats.portalActive;
    return true;
  });
  const listLoading = listQuery.isLoading;
  const allPageSelected =
    displayedClients.length > 0 && displayedClients.every((c) => selectedIds.has(c.id));
  const { containerRef: cardContainerRef, virtualizer: cardVirtualizer, virtualItems: virtualCards, totalSize: cardTotalSize } = useVirtualList({
    count: displayedClients.length,
    estimateSize: 130,
    overscan: 5,
    threshold: 50,
  });

  function openAddDeviceForSelectedClient() {
    if (!selected) return toast.error(t("errors.selectClientFirst", "Seleziona prima un cliente"));
    openAddDevice({
      client: {
        id: selected.id,
        name: selected.company_name || selected.name,
        lockClient: true,
      },
    });
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
    setActiveTab("info");
    setContactModalOpen(false);
    clientForm.reset(emptyClient as ClientInput);
    setContacts([]);
    resetContactForm();
  }

  function resetContactForm() {
    setEditingContactId(null);
    contactForm.reset(emptyContact as ContactInput);
  }

  const onSaveClient = clientForm.handleSubmit(async (values) => {
    if (!canEdit) return toast.error(t("errors.insufficientPermissions", "Permessi insufficienti"));
    setBusy(true);
    try {
      const companyName = values.company_name.trim();
      if (selected) {
        const patch: TablesUpdate<"clients"> & Record<string, unknown> = {
          name: companyName,
          company_name: companyName,
          vat_number: clean(values.vat_number || ""),
          fiscal_code: clean(values.fiscal_code || ""),
          email: clean(values.email || ""),
          phone: clean(values.phone || ""),
          website_url: normalizeOptionalUrl(values.website_url || ""),
          address: clean(values.address || ""),
          notes: clean(values.notes || ""),
          portal_logo_url: clean(values.portal_logo_url || ""),
          portal_primary_color: clean(values.portal_primary_color || "") || "#1B4FD8",
          portal_welcome_message: clean(values.portal_welcome_message || ""),
          portal_name: clean(values.portal_name || ""),
        };
        await updateClientMut.mutateAsync({ id: selected!.id, payload: patch });
        toast.success(t("toasts.clientUpdated", "Cliente aggiornato"));
      } else {
        const insert: TablesInsert<"clients"> & Record<string, unknown> = {
          name: companyName,
          company_name: companyName,
          vat_number: clean(values.vat_number || ""),
          fiscal_code: clean(values.fiscal_code || ""),
          email: clean(values.email || ""),
          phone: clean(values.phone || ""),
          website_url: normalizeOptionalUrl(values.website_url || ""),
          address: clean(values.address || ""),
          notes: clean(values.notes || ""),
          portal_logo_url: clean(values.portal_logo_url || ""),
          portal_primary_color: clean(values.portal_primary_color || "") || "#1B4FD8",
          portal_welcome_message: clean(values.portal_welcome_message || ""),
          portal_name: clean(values.portal_name || ""),
        };
        const data = await createClientMut.mutateAsync(insert);
        setSelectedId(data.id);
        toast.success(t("toasts.clientCreated", "Cliente creato"));
      }
    } catch (e) {
      toast.error(errorMessage(e, t("toasts.saveClientError", "Errore salvataggio cliente")));
    } finally {
      setBusy(false);
    }
  });

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
      for (const client of displayedClients) {
        if (checked) next.add(client.id);
        else next.delete(client.id);
      }
      return next;
    });
  }

  function openNewContactModal() {
    if (!selectedId) return toast.error(t("errors.selectClientFirst", "Seleziona prima un cliente"));
    setEditingContactId(null);
    contactForm.reset(emptyContact as ContactInput);
    setContactModalOpen(true);
  }

  function openEditContactModal(contact: ContactRow) {
    setEditingContactId(contact.id);
    contactForm.reset({
      full_name: contactLabel(contact),
      email: contact.email || null,
      phone: contact.phone || null,
      job_title: contact.job_title || null,
      department: contact.department || null,
      is_primary: contact.is_primary,
      notes: contact.notes || null,
    } as ContactInput);
    setContactModalOpen(true);
  }

  const onSaveContact = contactForm.handleSubmit(async (values) => {
    if (!canEdit) return toast.error(t("errors.insufficientPermissions", "Permessi insufficienti"));
    if (!selectedId) return toast.error(t("errors.saveClientFirst", "Salva prima il cliente"));
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
        await updateContactMut.mutateAsync({
          id: editingContactId,
          clientId: selectedId,
          payload: base,
        });
        toast.success(t("toasts.contactUpdated", "Referente aggiornato"));
      } else {
        await createContactMut.mutateAsync({ clientId: selectedId, payload: base });
        toast.success(t("toasts.contactAdded", "Referente aggiunto"));
      }
      setContactModalOpen(false);
      resetContactForm();
    } catch (e) {
      toast.error(errorMessage(e, t("toasts.saveContactError", "Errore salvataggio referente")));
    } finally {
      setBusy(false);
    }
  });

  async function deleteContact(contact: ContactRow) {
    if (!canDelete) return toast.error(t("errors.adminOnlyDeleteContacts", "Solo admin puo' eliminare referenti"));
    await deleteContactMut.mutateAsync({ id: contact.id, clientId: contact.client_id });
    toast.success(t("toasts.contactDeleted", "Referente eliminato"));
  }

  async function generateContactPortalLink(contact: ContactRow) {
    if (!session?.access_token) return toast.error(t("errors.sessionInvalid", "Sessione non valida"));
    if (!canManagePortalAccess) return toast.error(t("errors.insufficientPermissions", "Permessi insufficienti"));
    setPortalBusyContactId(contact.id);
    setCopiedPortalLink(false);
    try {
      const result = await generatePortalLink({
        data: { accessToken: session.access_token, contactId: contact.id, ttlHours: 24 },
      });
      setPortalLink(result);
      void qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success(t("toasts.portalLinkGenerated", "Link portale generato"));
    } catch (error) {
      toast.error(errorMessage(error, t("toasts.portalLinkError", "Errore generazione link portale")));
    } finally {
      setPortalBusyContactId(null);
    }
  }

  async function copyPortalLink() {
    if (!portalLink?.loginUrl) return;
    try {
      await navigator.clipboard.writeText(portalLink.loginUrl);
      setCopiedPortalLink(true);
      setTimeout(() => setCopiedPortalLink(false), 2000);
    } catch {
      toast.error(t("errors.cannotCopyLink", "Impossibile copiare il link"));
    }
  }

  async function revokeContactPortalAccess(contact: ContactRow) {
    if (!session?.access_token) return toast.error(t("errors.sessionInvalid", "Sessione non valida"));
    if (!canManagePortalAccess) return toast.error(t("errors.insufficientPermissions", "Permessi insufficienti"));
    setPortalRevokingContactId(contact.id);
    try {
      const result = await revokePortalLink({
        data: { accessToken: session.access_token, contactId: contact.id },
      });
      void qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success(
        result.revokedCount
          ? t("toasts.clientsDeleted", { defaultValue: "{{count}} link portale revocati", count: result.revokedCount })
          : t("errors.noActiveLinks", "Nessun link attivo da revocare"),
      );
    } catch (error) {
      toast.error(errorMessage(error, t("toasts.portalLinkRevokeError", "Errore revoca accesso portale")));
    } finally {
      setPortalRevokingContactId(null);
    }
  }

  async function confirmDestructiveAction() {
    if (!destructiveAction) return;
    if (destructiveAction.type === "client") {
      if (!canDelete) {
        toast.error(t("errors.adminOnlyDeleteClients", "Solo admin puo' eliminare clienti"));
        return;
      }
      await deleteClientMut.mutateAsync(destructiveAction.client.id);
      toast.success(t("toasts.clientDeleted", "Cliente eliminato"));
      if (selectedId === destructiveAction.client.id) setSelectedId(null);
    } else if (destructiveAction.type === "bulkClients") {
      if (!canDelete) {
        toast.error(t("errors.adminOnlyDeleteClients", "Solo admin puo' eliminare clienti"));
        return;
      }
      await bulkDeleteMut.mutateAsync(destructiveAction.ids);
      toast.success(t("toasts.clientsDeleted", { defaultValue: "{{count}} clienti eliminati", count: destructiveAction.ids.length }));
      if (selectedId && destructiveAction.ids.includes(selectedId)) setSelectedId(null);
      setSelectedIds(new Set());
    } else if (destructiveAction.type === "contact") {
      await deleteContact(destructiveAction.contact);
    } else {
      await revokeContactPortalAccess(destructiveAction.contact);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="pc-card overflow-hidden">
        <div className="pc-card-hd">
          <div className="pc-card-title">{t("list.title", "Clienti")}</div>
          <button className="pc-btn pc-btn-primary pc-btn-sm" onClick={startNewClient}>
            <Plus className="size-3" /> {t("list.new", "Nuovo")}
          </button>
        </div>
        <div className="space-y-3 border-b p-3" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <Search className="size-4 text-text3" />
            <input
              className="pc-input"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder={t("filters.searchExtended", "Cerca per nome, P.IVA, codice fiscale o email...")}
            />
          </div>
          <div className="grid grid-cols-3 gap-1">
            {[
              ["all", t("list.filterAll", "Tutti")],
              ["openTickets", t("list.filterOpenTickets", "Ticket aperti")],
              ["portalActive", t("list.filterPortalActive", "Portale attivo")],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className="rounded-md border px-2 py-1 text-[11px] font-semibold"
                style={{
                  borderColor: listFilter === value ? "var(--accent)" : "var(--border)",
                  background: listFilter === value ? "var(--accent2)" : "var(--surface2)",
                  color: listFilter === value ? "var(--accent)" : "var(--text2)",
                }}
                onClick={() => setListFilter(value as ClientListFilter)}
              >
                {label}
              </button>
            ))}
          </div>
          {allTags.length > 0 && (
            <div className="flex items-center gap-2">
              <Tags className="size-4 text-text3" />
              <select
                aria-label={t("tags.filterLabel", "Filtra per tag")}
                className="pc-input h-9 text-xs"
                value={tagFilter}
                onChange={(event) => setTagFilter(event.target.value)}
              >
                <option value="all">{t("tags.filterAll", "Tutti i tag")}</option>
                {allTags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center justify-between gap-2 text-xs text-text3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                aria-label={t("list.selectPage", "Seleziona pagina")}
                checked={allPageSelected}
                onChange={(event) => togglePageSelected(event.target.checked)}
              />
              {t("list.selectLabel", "Seleziona")}
            </label>
            <span className="font-mono">
              {displayedClients.length}/{total}
            </span>
          </div>
          {selectedIds.size > 0 && (
            <div
              className="flex items-center justify-between rounded-md px-3 py-2"
              style={{ background: "var(--surface2)" }}
            >
              <span className="text-xs text-text2">{t("list.selectedCount", { defaultValue: "{{count}} selezionati", count: selectedIds.size })}</span>
              <button
                className="pc-btn pc-btn-ghost pc-btn-xs"
                disabled={!canDelete}
                onClick={() =>
                  setDestructiveAction({ type: "bulkClients", ids: Array.from(selectedIds) })
                }
              >
                <Trash2 className="size-3" /> {t("list.delete", "Elimina")}
              </button>
            </div>
          )}
        </div>
        <div ref={cardContainerRef} className="max-h-[calc(100vh-285px)] space-y-2 overflow-y-auto p-3">
          {listQuery.isError ? (
            <PageFetchError
              message={t("list.error", "Impossibile caricare i clienti. Controlla la connessione e riprova.")}
              onRetry={() => listQuery.refetch()}
            />
          ) : listLoading ? (
            <ListSkeleton rows={8} variant="app" className="gap-2" />
          ) : displayedClients.length > 50 ? (
            <div style={{ height: cardTotalSize, position: 'relative' }}>
              {virtualCards.map((virtualCard) => {
                const client = displayedClients[virtualCard.index];
                const clientStats = stats[client.id] ?? {
                  openTickets: 0,
                  devices: 0,
                  contacts: 0,
                  portalActive: false,
                };
                const name = client.company_name || client.name;
                return (
                  <div
                    key={virtualCard.key}
                    ref={cardVirtualizer.measureElement}
                    data-index={virtualCard.index}
                    style={{
                      position: 'absolute',
                      top: 0,
                      transform: `translateY(${virtualCard.start}px)`,
                      left: 0,
                      right: 0,
                    }}
                  >
                    <button
                      type="button"
                      className="w-full rounded-md border p-3 text-left transition-colors hover:bg-surface2"
                      style={{
                        borderColor: client.id === selectedId ? "var(--accent)" : "var(--border)",
                        background: client.id === selectedId ? "var(--accent2)" : "var(--surface)",
                      }}
                      onClick={() => {
                        setSelectedId(client.id);
                        void navigate({
                          to: "/clients",
                          search: { clientId: client.id, tab: undefined },
                        });
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          aria-label={t("list.selectClient", { defaultValue: "Seleziona {{name}}", name })}
                          checked={selectedIds.has(client.id)}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => toggleSelected(client.id, event.target.checked)}
                        />
                        <Building2 className="mt-0.5 size-4 flex-shrink-0 text-text3" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-bold">{name}</div>
                          <div className="mt-0.5 truncate font-mono text-[11px] text-text3">
                            {client.vat_number || client.email || client.phone || t("list.incompleteProfile", "Anagrafica da completare")}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <SmallMetric
                          tone={clientStats.openTickets > 0 ? "danger" : "muted"}
                          icon={<Ticket className="size-3" />}
                          label={t("list.ticketCount", { defaultValue: "{{count}} ticket", count: clientStats.openTickets })}
                        />
                        <SmallMetric
                          tone="muted"
                          icon={<HardDrive className="size-3" />}
                          label={t("list.deviceCount", { defaultValue: "{{count}} dispositivi", count: clientStats.devices })}
                        />
                        <SmallMetric
                          tone="muted"
                          icon={<Users className="size-3" />}
                          label={t("list.contactCount", { defaultValue: "{{count}} referenti", count: clientStats.contacts })}
                        />
                      </div>
                      <ClientTagBadges tags={tagAssignments[client.id] ?? []} compact />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              {displayedClients.map((client) => {
                const clientStats = stats[client.id] ?? {
                  openTickets: 0,
                  devices: 0,
                  contacts: 0,
                  portalActive: false,
                };
                const name = client.company_name || client.name;
                return (
                  <button
                    key={client.id}
                    type="button"
                    className="w-full rounded-md border p-3 text-left transition-colors hover:bg-surface2"
                    style={{
                      borderColor: client.id === selectedId ? "var(--accent)" : "var(--border)",
                      background: client.id === selectedId ? "var(--accent2)" : "var(--surface)",
                    }}
                    onClick={() => {
                      setSelectedId(client.id);
                      void navigate({
                        to: "/clients",
                        search: { clientId: client.id, tab: undefined },
                      });
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        aria-label={t("list.selectClient", { defaultValue: "Seleziona {{name}}", name })}
                        checked={selectedIds.has(client.id)}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => toggleSelected(client.id, event.target.checked)}
                      />
                      <Building2 className="mt-0.5 size-4 flex-shrink-0 text-text3" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-bold">{name}</div>
                        <div className="mt-0.5 truncate font-mono text-[11px] text-text3">
                          {client.vat_number || client.email || client.phone || t("list.incompleteProfile", "Anagrafica da completare")}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <SmallMetric
                        tone={clientStats.openTickets > 0 ? "danger" : "muted"}
                        icon={<Ticket className="size-3" />}
                        label={t("list.ticketCount", { defaultValue: "{{count}} ticket", count: clientStats.openTickets })}
                      />
                      <SmallMetric
                        tone="muted"
                        icon={<HardDrive className="size-3" />}
                        label={t("list.deviceCount", { defaultValue: "{{count}} dispositivi", count: clientStats.devices })}
                      />
                      <SmallMetric
                        tone="muted"
                        icon={<Users className="size-3" />}
                        label={t("list.contactCount", { defaultValue: "{{count}} referenti", count: clientStats.contacts })}
                      />
                    </div>
                    <ClientTagBadges tags={tagAssignments[client.id] ?? []} compact />
                  </button>
                );
              })}
              {!displayedClients.length && (
                <div className="py-8 text-center text-sm text-text3">{t("list.empty", "Nessun cliente trovato")}</div>
              )}
            </>
          )}
        </div>
        <div
          className="flex items-center justify-between gap-2 border-t px-3 py-2"
          style={{ borderColor: "var(--border)" }}
        >
          <span className="font-mono text-xs text-text3">
            {displayedClients.length}/{total}
          </span>
          {isFetchingNextPage && (
            <span className="text-xs text-text3">
              {t("list.loadingMore", "Caricamento...")}
            </span>
          )}
          <div ref={sentinelRef} className="h-px w-full" />
        </div>
      </div>

      <div className="pc-card overflow-hidden">
        {selected ? (
          <>
            <div className="border-b px-5 py-4" style={{ borderColor: "var(--border)" }}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md bg-surface2 text-sm font-bold text-text2">
                    {clientInitials(selected)}
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold">
                      {selected.company_name || selected.name}
                    </h2>
                    <div className="mt-1 truncate text-sm text-text3">
                      {[selected.email, selected.phone].filter(Boolean).join(" · ") ||
                        t("detail.contactInfoEmpty", "Contatti cliente non compilati")}
                    </div>
                    <ClientTagBadges tags={selectedTags} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <HeaderCounter
                    label={t("detail.openTickets", "ticket aperti")}
                    value={selectedStats.openTickets}
                    onClick={() => setActiveTab("tickets")}
                  />
                  <HeaderCounter
                    label={t("detail.devices", "dispositivi")}
                    value={selectedStats.devices}
                    onClick={() => setActiveTab("devices")}
                  />
                  <HeaderCounter
                    label={t("detail.contacts", "referenti")}
                    value={selectedStats.contacts || contacts.length}
                    onClick={() => setActiveTab("contacts")}
                  />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5 border-b-0">
                {[
                  ["overview", t("tabs.overview", "Overview")],
                  ["info", t("tabs.info", "Informazioni")],
                  ["notes", t("tabs.notes", "Note")],
                  ["contacts", t("tabs.contacts", "Referenti")],
                  ["tickets", t("tabs.tickets", "Ticket")],
                  ["devices", t("tabs.devices", "Dispositivi")],
                  ["activity", t("tabs.activity", "Attivita'")],
                  ["documents", t("tabs.documents", "Documenti")],
                  ["settings", t("tabs.settings", "SLA e tag")],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className="rounded-md px-3 py-2 text-[12.5px] font-semibold"
                    style={{
                      background: activeTab === value ? "var(--accent2)" : "transparent",
                      color: activeTab === value ? "var(--accent)" : "var(--text3)",
                    }}
                    onClick={() => setActiveTab(value as ClientTab)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === "overview" && (
              <ClientOverviewPanel
                overview={selectedOverview}
                loading={overviewQuery.isLoading}
                contactsCount={selectedStats.contacts || contacts.length}
                devicesCount={selectedStats.devices}
                onOpenTickets={() => setActiveTab("tickets")}
                onOpenDocuments={() => setActiveTab("documents")}
                onOpenSettings={() => setActiveTab("settings")}
              />
            )}

            {activeTab === "info" && (
              <div className="pc-card-body">
                <div className="mb-4 flex flex-wrap justify-end gap-2">
                  <button
                    className="pc-btn pc-btn-ghost pc-btn-sm"
                    disabled={!canDelete}
                    onClick={() => setDestructiveAction({ type: "client", client: selected })}
                  >
                    <Trash2 className="size-3" /> {t("form.delete", "Elimina")}
                  </button>
                  <button
                    className="pc-btn pc-btn-primary pc-btn-sm"
                    disabled={busy || !canEdit}
                    onClick={onSaveClient}
                  >
                    <Save className="size-3" /> {t("form.saveClient", "Salva cliente")}
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-[14px] md:grid-cols-2">
                  <Field label={t("form.ragioneSociale", "Ragione sociale *")}>
                    <input className="pc-input" {...clientForm.register("company_name")} />
                    {clientForm.formState.errors.company_name && (
                      <p className="mt-1 text-sm text-destructive">
                        {clientForm.formState.errors.company_name.message}
                      </p>
                    )}
                  </Field>
                  <Field label={t("form.partitaIva", "P.IVA")}>
                    <input className="pc-input" {...clientForm.register("vat_number")} />
                  </Field>
                  <Field label={t("form.codiceFiscale", "Codice fiscale")}>
                    <input className="pc-input" {...clientForm.register("fiscal_code")} />
                  </Field>
                  <Field label={t("form.emailField", "Email")}>
                    <input className="pc-input" type="email" {...clientForm.register("email")} />
                  </Field>
                  <Field label={t("form.telefono", "Telefono")}>
                    <input className="pc-input" {...clientForm.register("phone")} />
                  </Field>
                  <Field label={t("form.sitoWeb", "Sito web")}>
                    <input
                      className="pc-input"
                      type="url"
                      placeholder={t("form.websitePlaceholder", "https://azienda.it")}
                      {...clientForm.register("website_url")}
                    />
                    {clientForm.formState.errors.website_url && (
                      <p className="mt-1 text-sm text-destructive">
                        {clientForm.formState.errors.website_url.message}
                      </p>
                    )}
                    {selected.website_url && (
                      <a
                        className="mt-1 inline-flex text-xs font-semibold text-accent"
                        href={selected.website_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t("form.openWebsite", "Apri sito web")}
                      </a>
                    )}
                  </Field>
                  <Field label={t("form.indirizzo", "Indirizzo")}>
                    <input className="pc-input" {...clientForm.register("address")} />
                  </Field>
                  <div className="md:col-span-2">
                    <Field label={t("form.note", "Note")}>
                      <textarea
                        className="pc-input min-h-[92px]"
                        {...clientForm.register("notes")}
                      />
                    </Field>
                  </div>
                  <div
                    className="md:col-span-2 mt-2 rounded-lg border p-3"
                    style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
                  >
                    <div className="mb-3 text-sm font-semibold">{t("form.portalBranding", "Branding portale cliente")}</div>
                    <div className="grid grid-cols-1 gap-[14px] md:grid-cols-2">
                      <Field label={t("form.portalName", "Nome portale")}>
                        <input
                          className="pc-input"
                          placeholder={t("form.portalNamePlaceholder", "Portale IT - Rossi S.r.l.")}
                          {...clientForm.register("portal_name")}
                        />
                      </Field>
                      <Field label={t("form.portalColor", "Colore principale")}>
                        <input
                          className="pc-input"
                          type="color"
                          {...clientForm.register("portal_primary_color")}
                        />
                      </Field>
                      <Field label={t("form.portalLogoUrl", "URL logo cliente")}>
                        <input
                          className="pc-input"
                          placeholder={t("form.portalLogoPlaceholder", "https://.../logo.png")}
                          {...clientForm.register("portal_logo_url")}
                        />
                      </Field>
                      <Field label={t("form.portalWelcomeMessage", "Messaggio di benvenuto")}>
                        <input
                          className="pc-input"
                          placeholder={t("form.portalWelcomePlaceholder", "Benvenuto nel portale assistenza")}
                          {...clientForm.register("portal_welcome_message")}
                        />
                      </Field>
                    </div>
                    <p className="mt-2 text-xs text-text3">
                      {t("form.portalInfo", "Puoi caricare il logo nel bucket pubblico client-portal-branding e incollare qui l'URL pubblico.")}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "notes" && (
              <ClientNotesPanel
                clientId={selected.id}
                canEdit={canEdit}
                canDelete={canDelete}
                userId={profile?.id ?? null}
              />
            )}

            {activeTab === "contacts" && (
              <div className="pc-card-body">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm text-text3">{t("contacts.count", { defaultValue: "{{count}} referenti registrati", count: contacts.length })}</div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="pc-btn pc-btn-ghost pc-btn-sm"
                      disabled={!canEdit}
                      onClick={() => setContactImportOpen(true)}
                    >
                      <FileUp className="size-3" /> {t("contacts.importCsv", "Importa da CSV")}
                    </button>
                    <button
                      className="pc-btn pc-btn-primary pc-btn-sm"
                      disabled={!canEdit}
                      onClick={openNewContactModal}
                    >
                      <Plus className="size-3" /> {t("contacts.newContact", "Nuovo referente")}
                    </button>
                  </div>
                </div>
                <ResponsiveTable
                  empty={t("contacts.empty", "Nessun referente associato.")}
                  headers={[
                    t("contacts.headers.name", "Nome"),
                    t("contacts.headers.role", "Ruolo"),
                    t("contacts.headers.department", "Reparto"),
                    t("contacts.headers.email", "Email"),
                    t("contacts.headers.phone", "Telefono"),
                    t("contacts.headers.portal", "Portale"),
                    t("contacts.headers.actions", "Azioni"),
                  ]}
                  rows={contacts.map((contact) => [
                    <span className="inline-flex items-center gap-1 font-semibold">
                      {contact.is_primary && (
                        <Star className="size-3" style={{ color: "var(--warn)" }} />
                      )}
                      {contactLabel(contact)}
                    </span>,
                    contact.job_title || "-",
                    contact.department || "-",
                    contact.email || "-",
                    contact.phone || "-",
                    <PortalBadge active={!!portalAccess[contact.id]} />,
                    <div className="flex flex-wrap justify-end gap-1">
                      <button
                        className="pc-btn pc-btn-ghost pc-btn-xs"
                        onClick={() => openEditContactModal(contact)}
                      >
                        <Pencil className="size-3" /> {t("contacts.edit", "Modifica")}
                      </button>
                      <button
                        className="pc-btn pc-btn-ghost pc-btn-xs"
                        disabled={!canManagePortalAccess || portalBusyContactId === contact.id}
                        onClick={() => generateContactPortalLink(contact)}
                      >
                        <Link2 className="size-3" /> {t("contacts.link", "Link")}
                      </button>
                      {portalAccess[contact.id] && (
                        <button
                          className="pc-btn pc-btn-ghost pc-btn-xs"
                          disabled={
                            !canManagePortalAccess || portalRevokingContactId === contact.id
                          }
                          onClick={() => setDestructiveAction({ type: "revokePortal", contact })}
                        >
                          {t("contacts.revoke", "Revoca")}
                        </button>
                      )}
                      <button
                        className="pc-btn-icon touch-target"
                        disabled={!canDelete}
                        onClick={() => setDestructiveAction({ type: "contact", contact })}
                        title={t("contacts.deleteTitle", "Elimina referente")}
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>,
                  ])}
                />
              </div>
            )}

            {activeTab === "tickets" && (
              <div className="pc-card-body">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm text-text3">{t("tickets.count", { defaultValue: "{{count}} ticket collegati", count: tickets.length })}</div>
                  <button className="pc-btn pc-btn-primary pc-btn-sm" onClick={openCreate}>
                    <Plus className="size-3" /> {t("tickets.newTicket", "Nuovo ticket")}
                  </button>
                </div>
                <ResponsiveTable
                  empty={t("tickets.empty", "Nessun ticket per questo cliente.")}
                  emptyAction={
                    <button className="pc-btn pc-btn-primary pc-btn-sm" onClick={openCreate}>
                      <Plus className="size-3" /> {t("tickets.createFirst", "Crea primo ticket")}
                    </button>
                  }
                  headers={[
                    t("tickets.headers.id", "ID"),
                    t("tickets.headers.title", "Titolo"),
                    t("tickets.headers.status", "Stato"),
                    t("tickets.headers.priority", "Priorita"),
                    t("tickets.headers.assignee", "Assegnatario"),
                    t("tickets.headers.date", "Apertura"),
                  ]}
                  rows={tickets.map((ticket) => [
                    <button
                      className="font-mono text-[12px] font-semibold text-accent"
                      onClick={() => openTicketDetail(ticket.id)}
                    >
                      {ticket.ticket_code}
                    </button>,
                    ticket.software || ticket.requester || "-",
                    <StatusPill value={ticket.status} />,
                    <PriorityPill value={ticket.priority} />,
                    ticket.assignee?.full_name || t("tickets.unassigned", "Non assegnato"),
                    fmtDate(ticket.created_at),
                  ])}
                />
              </div>
            )}

            {activeTab === "devices" && (
              <div className="pc-card-body">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <DeviceSummary devices={devices} />
                  <button
                    className="pc-btn pc-btn-primary pc-btn-sm"
                    onClick={openAddDeviceForSelectedClient}
                  >
                    <Plus className="size-3" /> {t("devices.addDevice", "Aggiungi dispositivo")}
                  </button>
                </div>
                <ResponsiveTable
                  empty={t("devices.empty", "Nessun dispositivo per questo cliente.")}
                  emptyAction={
                    <button
                      className="pc-btn pc-btn-primary pc-btn-sm"
                      onClick={openAddDeviceForSelectedClient}
                    >
                      <Plus className="size-3" /> {t("devices.addFirstDevice", "Aggiungi primo dispositivo")}
                    </button>
                  }
                  headers={[
                    t("devices.headers.model", "Modello"),
                    t("devices.headers.assetTag", "Asset tag"),
                    t("devices.headers.serial", "Seriale produttore"),
                    t("devices.headers.os", "OS"),
                    t("devices.headers.status", "Stato"),
                    t("devices.headers.assignedTo", "Assegnato a"),
                    t("devices.headers.date", "Inserito"),
                  ]}
                  rows={devices.map((device) => [
                    <button
                      className="font-semibold text-accent"
                      onClick={() => openDeviceDetail(device.id)}
                    >
                      {device.model}
                    </button>,
                    <span className="font-mono text-[12px]">{device.asset_tag || "-"}</span>,
                    <span className="font-mono text-[12px]">{device.serial || "-"}</span>,
                    device.os || "-",
                    <DeviceStatusPill status={device.status} />,
                    device.assigned_to || "-",
                    fmtDate(device.created_at),
                  ])}
                />
              </div>
            )}

            {activeTab === "activity" && <ClientActivityTimeline clientId={selected.id} />}

            {activeTab === "documents" && (
              <ClientDocumentsPanel
                clientId={selected.id}
                canEdit={canEdit}
                canDelete={canDelete}
                userId={profile?.id ?? null}
              />
            )}

            {activeTab === "settings" && (
              <ClientSettingsPanel
                clientId={selected.id}
                canEdit={canEdit}
                userId={profile?.id ?? null}
                overview={selectedOverview}
              />
            )}
          </>
        ) : (
          <div className="pc-card-body">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="pc-card-title">{t("form.newClientTitle", "Nuovo cliente")}</div>
                <p className="mt-1 text-sm text-text3">
                  {t("form.newClientDescription", "Compila l'anagrafica per creare una nuova scheda cliente.")}
                </p>
              </div>
              <button
                className="pc-btn pc-btn-primary pc-btn-sm"
                disabled={busy || !canEdit}
                onClick={onSaveClient}
              >
                <Save className="size-3" /> {t("form.saveClient", "Salva cliente")}
              </button>
            </div>
            <div className="grid grid-cols-1 gap-[14px] md:grid-cols-2">
              <Field label={t("form.ragioneSociale", "Ragione sociale *")}>
                <input className="pc-input" {...clientForm.register("company_name")} />
              </Field>
              <Field label={t("form.partitaIva", "P.IVA")}>
                <input className="pc-input" {...clientForm.register("vat_number")} />
              </Field>
              <Field label={t("form.codiceFiscale", "Codice fiscale")}>
                <input className="pc-input" {...clientForm.register("fiscal_code")} />
              </Field>
              <Field label={t("form.emailField", "Email")}>
                <input className="pc-input" type="email" {...clientForm.register("email")} />
              </Field>
              <Field label={t("form.telefono", "Telefono")}>
                <input className="pc-input" {...clientForm.register("phone")} />
              </Field>
              <Field label={t("form.sitoWeb", "Sito web")}>
                <input
                  className="pc-input"
                  type="url"
                  placeholder={t("form.websitePlaceholder", "https://azienda.it")}
                  {...clientForm.register("website_url")}
                />
                {clientForm.formState.errors.website_url && (
                  <p className="mt-1 text-sm text-destructive">
                    {clientForm.formState.errors.website_url.message}
                  </p>
                )}
              </Field>
              <Field label={t("form.indirizzo", "Indirizzo")}>
                <input className="pc-input" {...clientForm.register("address")} />
              </Field>
              <div className="md:col-span-2">
                <Field label={t("form.note", "Note")}>
                  <textarea className="pc-input min-h-[92px]" {...clientForm.register("notes")} />
                </Field>
              </div>
            </div>
          </div>
        )}
      </div>

      <ContactModal
        open={contactModalOpen}
        title={editingContactId ? t("contacts.modalTitleEdit", "Modifica referente") : t("contacts.modalTitleNew", "Nuovo referente")}
        canEdit={canEdit}
        busy={busy}
        form={contactForm}
        onClose={() => {
          setContactModalOpen(false);
          resetContactForm();
        }}
        onSave={onSaveContact}
      />
      <PortalLinkModal
        portalLink={portalLink}
        copied={copiedPortalLink}
        onClose={() => setPortalLink(null)}
        onCopy={copyPortalLink}
      />
      <DestructiveConfirmDialog
        open={!!destructiveAction}
        {...destructiveDialogCopy(destructiveAction)}
        loadingLabel={t("destructiveDialog.loading", "Operazione in corso...")}
        onOpenChange={(open) => !open && setDestructiveAction(null)}
        onConfirm={confirmDestructiveAction}
      />
      <ImportContactsCsvDialog
        open={contactImportOpen}
        clientId={selectedId}
        existingContacts={contacts}
        onClose={() => setContactImportOpen(false)}
        onImported={() => {
          if (selectedId) void loadContacts(selectedId);
          void qc.invalidateQueries({ queryKey: ["clients"] });
        }}
      />
      <ImportClientsCsvDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          setSelectedIds(new Set());
          void listQuery.refetch();
        }}
      />
    </div>
  );
}

function destructiveDialogCopy(action: DestructiveAction | null) {
  if (!action) {
    return {
      title: i18n.t("destructiveDialog.defaultTitle", "Confermare l'azione?"),
      description: i18n.t("destructiveDialog.defaultDescription", "Questa azione e' distruttiva e non puo' essere annullata."),
      confirmLabel: i18n.t("destructiveDialog.defaultConfirm", "Conferma"),
    };
  }

  if (action.type === "client") {
    const name = action.client.company_name || action.client.name;
    return {
      title: i18n.t("destructiveDialog.deleteClientTitle", "Eliminare questo cliente?"),
      description: i18n.t("destructiveDialog.deleteClientDescription", { defaultValue: "Il cliente \"{{name}}\" verra' rimosso insieme ai dati collegati gestiti dalle policy database. L'azione non puo' essere annullata.", name }),
      confirmLabel: i18n.t("destructiveDialog.deleteClientConfirm", "Elimina cliente"),
    };
  }

  if (action.type === "bulkClients") {
    return {
      title: i18n.t("destructiveDialog.deleteClientsTitle", "Eliminare i clienti selezionati?"),
      description: i18n.t("destructiveDialog.deleteClientsDescription", { defaultValue: "{{count}} clienti verranno rimossi insieme ai dati collegati gestiti dalle policy database. L'azione non puo' essere annullata.", count: action.ids.length }),
      confirmLabel: i18n.t("destructiveDialog.deleteClientsConfirm", "Elimina clienti"),
    };
  }

  if (action.type === "contact") {
    const name = contactLabel(action.contact);
    return {
      title: i18n.t("destructiveDialog.deleteContactTitle", "Eliminare questo referente?"),
      description: i18n.t("destructiveDialog.deleteContactDescription", { defaultValue: "Il referente \"{{name}}\" verra' rimosso dal cliente. L'azione non puo' essere annullata.", name }),
      confirmLabel: i18n.t("destructiveDialog.deleteContactConfirm", "Elimina referente"),
    };
  }

  const name = contactLabel(action.contact);
  return {
    title: i18n.t("destructiveDialog.revokePortalTitle", "Revocare l'accesso portale?"),
    description: i18n.t("destructiveDialog.revokePortalDescription", { defaultValue: "Tutti i link portale attivi per \"{{name}}\" verranno revocati. Il referente non potra' piu' usarli per accedere.", name }),
    confirmLabel: i18n.t("destructiveDialog.revokePortalConfirm", "Revoca accesso"),
  };
}

function ContactModal({
  open,
  title,
  canEdit,
  busy,
  form,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  canEdit: boolean;
  busy: boolean;
  form: UseFormReturn<ContactInput>;
  onClose: () => void;
  onSave: () => void;
}) {
  const { t } = useTranslation("clients");
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button className="pc-btn pc-btn-ghost" onClick={onClose} disabled={busy}>
            {t("form.cancel", "Annulla")}
          </button>
          <button className="pc-btn pc-btn-primary" disabled={busy || !canEdit} onClick={onSave}>
            <Save className="size-3" /> {busy ? t("contacts.saving", "Salvataggio...") : t("contacts.save", "Salva referente")}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label={t("contacts.formName", "Nome e cognome *")}>
          <input className="pc-input" {...form.register("full_name")} />
          {form.formState.errors.full_name && (
            <p className="mt-1 text-sm text-destructive">
              {form.formState.errors.full_name.message}
            </p>
          )}
        </Field>
        <Field label={t("contacts.formEmail", "Email")}>
          <input className="pc-input" type="email" {...form.register("email")} />
          {form.formState.errors.email && (
            <p className="mt-1 text-sm text-destructive">{form.formState.errors.email.message}</p>
          )}
        </Field>
        <Field label={t("contacts.formPhone", "Telefono")}>
          <input className="pc-input" {...form.register("phone")} />
        </Field>
        <Field label={t("contacts.formRole", "Ruolo aziendale")}>
          <input className="pc-input" {...form.register("job_title")} />
        </Field>
        <Field label={t("contacts.formDepartment", "Reparto")}>
          <input className="pc-input" {...form.register("department")} />
        </Field>
        <label className="flex items-center gap-2 pt-6 text-[12px] text-text2">
          <input type="checkbox" {...form.register("is_primary")} />
          {t("contacts.formPrimary", "Referente principale")}
        </label>
        <div className="md:col-span-2">
          <Field label={t("contacts.formNotes", "Note")}>
            <textarea className="pc-input min-h-[82px]" {...form.register("notes")} />
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
  const { t } = useTranslation("clients");
  return (
    <Modal
      open={!!portalLink}
      onClose={onClose}
      title={t("portal.modalTitle", "Link accesso portale")}
      footer={
        <>
          <button className="pc-btn pc-btn-ghost" onClick={onClose}>
            {t("portal.close", "Chiudi")}
          </button>
          <button className="pc-btn pc-btn-primary" onClick={onCopy}>
            {copied ? (
              <>
                <CheckCircle2 className="size-3" /> {t("portal.copied", "Copiato")}
              </>
            ) : (
              <>
                <Copy className="size-3" /> {t("portal.copyLink", "Copia link")}
              </>
            )}
          </button>
        </>
      }
    >
      {portalLink && (
        <div className="flex flex-col gap-4">
          <div>
            <div className="pc-label">{t("portal.contact", "Referente")}</div>
            <div className="text-[13px] font-semibold">{portalLink.contactName}</div>
            <div className="text-[12px] text-text3">{portalLink.clientName}</div>
          </div>
          <div>
            <div className="pc-label">{t("portal.link", "Link")}</div>
            <div
              className="break-all rounded-md border px-3 py-2 font-mono text-[12px]"
              style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
            >
              {portalLink.loginUrl}
            </div>
          </div>
          <div
            className="rounded-md border px-3 py-2 text-[12.5px] text-text2"
            style={{ borderColor: "var(--border)" }}
          >
            {t("portal.expiresOn", { defaultValue: "Scade il {{date}}", date: formatPortalExpiry(portalLink.expiresAt) })}
          </div>
          <div
            className="rounded-md border px-3 py-2 text-[12.5px]"
            style={{ borderColor: "var(--warn)", background: "rgba(239, 152, 39, .08)" }}
          >
            {t("portal.warning", "Condividi questo link direttamente con il cliente. Chiunque lo riceva potra' accedere al portale come questo referente fino alla scadenza o alla revoca.")}
          </div>
        </div>
      )}
    </Modal>
  );
}

function ClientOverviewPanel({
  overview,
  loading,
  contactsCount,
  devicesCount,
  onOpenTickets,
  onOpenDocuments,
  onOpenSettings,
}: {
  overview: import("@/lib/queries/clients").ClientOverview | null | undefined;
  loading: boolean;
  contactsCount: number;
  devicesCount: number;
  onOpenTickets: () => void;
  onOpenDocuments: () => void;
  onOpenSettings: () => void;
}) {
  const { t } = useTranslation("clients");
  const bundle = overview?.activeBundle;
  return (
    <div className="pc-card-body space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <button type="button" className="rounded-md border p-3 text-left" style={{ borderColor: "var(--border)" }} onClick={onOpenTickets}>
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase text-text3">
            <Ticket className="h-3.5 w-3.5" /> {t("overview.openTickets", "Ticket aperti")}
          </div>
          <div className="mt-2 font-mono text-2xl font-bold">{loading ? "..." : overview?.openTickets ?? 0}</div>
        </button>
        <div className="rounded-md border p-3" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase text-text3">
            <Clock className="h-3.5 w-3.5" /> {t("overview.avgResolution", "Tempo medio risoluzione")}
          </div>
          <div className="mt-2 font-mono text-2xl font-bold">
            {loading ? "..." : formatHours(overview?.avgResolutionHours)}
          </div>
        </div>
        <div className="rounded-md border p-3" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase text-text3">
            <FileText className="h-3.5 w-3.5" /> {t("overview.totalBilled", "Fatturato")}
          </div>
          <div className="mt-2 font-mono text-2xl font-bold">{loading ? "..." : formatMoney(overview?.totalBilled ?? 0)}</div>
        </div>
        <button type="button" className="rounded-md border p-3 text-left" style={{ borderColor: "var(--border)" }} onClick={onOpenSettings}>
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase text-text3">
            <Bell className="h-3.5 w-3.5" /> {t("overview.contractExpiry", "Scadenza contratto")}
          </div>
          <div className="mt-2 font-mono text-2xl font-bold">
            {loading ? "..." : overview?.contractDaysLeft == null ? "-" : `${overview.contractDaysLeft}g`}
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="rounded-md border p-4" style={{ borderColor: "var(--border)", background: "var(--surface2)" }}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-bold">{t("overview.bundleTitle", "Bundle assistenza attivo")}</div>
              <div className="text-xs text-text3">{t("overview.bundleSubtitle", "SLA effettivi e scadenza contratto")}</div>
            </div>
            <button className="pc-btn pc-btn-ghost pc-btn-sm" type="button" onClick={onOpenSettings}>
              <Pencil className="size-3" /> {t("overview.configure", "Configura")}
            </button>
          </div>
          {bundle ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-md border px-3 py-2" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <div className="text-[10px] uppercase text-text3">{t("overview.bundleName", "Nome")}</div>
                <div className="truncate text-sm font-semibold">{bundle.bundle_name ?? bundle.name ?? "-"}</div>
              </div>
              <div className="rounded-md border px-3 py-2" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <div className="text-[10px] uppercase text-text3">{t("overview.responseSla", "Risposta")}</div>
                <div className="font-mono text-sm font-semibold">{formatHours(bundle.effective_sla_response_hours)}</div>
              </div>
              <div className="rounded-md border px-3 py-2" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <div className="text-[10px] uppercase text-text3">{t("overview.resolutionSla", "Risoluzione")}</div>
                <div className="font-mono text-sm font-semibold">{formatHours(bundle.effective_sla_resolution_hours)}</div>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-dashed px-3 py-5 text-sm text-text3" style={{ borderColor: "var(--border)" }}>
              {t("overview.noBundle", "Nessun bundle attivo collegato a questo cliente.")}
            </div>
          )}
        </div>
        <div className="rounded-md border p-4" style={{ borderColor: "var(--border)" }}>
          <div className="text-sm font-bold">{t("overview.quickStats", "Scheda cliente")}</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <SummaryBox label={t("overview.contacts", "Referenti")} value={contactsCount} />
            <SummaryBox label={t("overview.devices", "Device")} value={devicesCount} />
          </div>
          <button className="pc-btn pc-btn-primary pc-btn-sm mt-3 w-full" type="button" onClick={onOpenDocuments}>
            <Upload className="size-3" /> {t("overview.uploadDocument", "Carica documento")}
          </button>
        </div>
      </div>
    </div>
  );
}

function ClientTagBadges({
  tags,
  compact,
}: {
  tags: import("@/lib/queries/clients").ClientTag[];
  compact?: boolean;
}) {
  if (!tags.length) return null;
  return (
    <div className={compact ? "mt-2 flex flex-wrap gap-1" : "mt-2 flex flex-wrap gap-1.5"}>
      {tags.slice(0, compact ? 3 : 8).map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-bold"
          style={{
            borderColor: tag.color || "var(--border)",
            background: "var(--surface2)",
            color: tag.color || "var(--text3)",
          }}
        >
          {tag.name}
        </span>
      ))}
      {compact && tags.length > 3 && (
        <span className="rounded-full bg-surface2 px-2 py-0.5 text-[10.5px] font-bold text-text3">
          +{tags.length - 3}
        </span>
      )}
    </div>
  );
}

function ClientNotesPanel({
  clientId,
  canEdit,
  canDelete,
  userId,
}: {
  clientId: string;
  canEdit: boolean;
  canDelete: boolean;
  userId: string | null;
}) {
  const { t } = useTranslation("clients");
  const qc = useQueryClient();
  const notesQuery = (queries as any).useClientNotes(clientId);
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [historyNoteId, setHistoryNoteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const revisionsQuery = (queries as any).useClientNoteRevisions(historyNoteId);
  const notes = (notesQuery.data ?? []) as import("@/lib/queries/clients").ClientNote[];

  async function saveNote() {
    if (!canEdit || !content.trim()) return;
    setBusy(true);
    try {
      if (editingId) await (queries as any).updateClientNote(editingId, content, userId);
      else await (queries as any).createClientNote(clientId, content, userId);
      setContent("");
      setEditingId(null);
      void qc.invalidateQueries({ queryKey: ["clients", clientId, "notes"] });
      void qc.invalidateQueries({ queryKey: ["clients", clientId, "activity"] });
      toast.success(t("notes.saved", "Nota salvata"));
    } catch (error) {
      toast.error(errorMessage(error, t("notes.saveError", "Errore salvataggio nota")));
    } finally {
      setBusy(false);
    }
  }

  async function removeNote(noteId: string) {
    if (!canDelete) return;
    setBusy(true);
    try {
      await (queries as any).deleteClientNote(noteId);
      void qc.invalidateQueries({ queryKey: ["clients", clientId, "notes"] });
      toast.success(t("notes.deleted", "Nota eliminata"));
    } catch (error) {
      toast.error(errorMessage(error, t("notes.deleteError", "Errore eliminazione nota")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pc-card-body space-y-4">
      <div className="rounded-md border p-3" style={{ borderColor: "var(--border)", background: "var(--surface2)" }}>
        <Field label={t("notes.editorLabel", "Nota interna")}>
          <textarea
            className="pc-input min-h-[110px]"
            value={content}
            disabled={!canEdit || busy}
            maxLength={5000}
            onChange={(event) => setContent(event.target.value)}
          />
        </Field>
        <div className="mt-3 flex justify-end gap-2">
          {editingId && (
            <button className="pc-btn pc-btn-ghost pc-btn-sm" type="button" onClick={() => { setEditingId(null); setContent(""); }}>
              {t("form.cancel", "Annulla")}
            </button>
          )}
          <button className="pc-btn pc-btn-primary pc-btn-sm" type="button" disabled={!canEdit || busy || !content.trim()} onClick={() => void saveNote()}>
            <Save className="size-3" /> {editingId ? t("notes.update", "Aggiorna nota") : t("notes.add", "Aggiungi nota")}
          </button>
        </div>
      </div>
      <div className="space-y-2">
        {notesQuery.isLoading ? (
          <ListSkeleton rows={3} variant="app" />
        ) : notes.length ? (
          notes.map((note) => (
            <div key={note.id} className="rounded-md border p-3" style={{ borderColor: "var(--border)" }}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="text-xs text-text3">
                  {note.author?.full_name || t("notes.unknownAuthor", "Autore non disponibile")} - {fmtDate(note.updated_at)}
                </div>
                <div className="flex gap-1">
                  <button className="pc-btn pc-btn-ghost pc-btn-xs" type="button" onClick={() => setHistoryNoteId(note.id)}>
                    <History className="size-3" /> {t("notes.history", "Storico")}
                  </button>
                  <button className="pc-btn pc-btn-ghost pc-btn-xs" type="button" disabled={!canEdit} onClick={() => { setEditingId(note.id); setContent(note.content); }}>
                    <Pencil className="size-3" /> {t("form.edit", "Modifica")}
                  </button>
                  <button className="pc-btn pc-btn-ghost pc-btn-xs" type="button" disabled={!canDelete} onClick={() => void removeNote(note.id)}>
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-text2">{note.content}</p>
            </div>
          ))
        ) : (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-text3" style={{ borderColor: "var(--border)" }}>
            {t("notes.empty", "Nessuna nota interna per questo cliente.")}
          </div>
        )}
      </div>
      <Modal open={!!historyNoteId} onClose={() => setHistoryNoteId(null)} title={t("notes.historyTitle", "Storico modifiche")}>
        <div className="space-y-2">
          {revisionsQuery.isLoading ? (
            <ListSkeleton rows={3} variant="app" />
          ) : ((revisionsQuery.data ?? []) as import("@/lib/queries/clients").ClientNoteRevision[]).length ? (
            ((revisionsQuery.data ?? []) as import("@/lib/queries/clients").ClientNoteRevision[]).map((revision) => (
              <div key={revision.id} className="rounded-md border p-3" style={{ borderColor: "var(--border)" }}>
                <div className="text-xs text-text3">{revision.author?.full_name || "-"} - {fmtDate(revision.changed_at)}</div>
                <div className="mt-2 text-xs text-text3">{t("notes.previous", "Prima")}</div>
                <p className="whitespace-pre-wrap text-sm text-text2">{revision.previous_content}</p>
              </div>
            ))
          ) : (
            <div className="text-sm text-text3">{t("notes.noRevisions", "Nessuna modifica registrata.")}</div>
          )}
        </div>
      </Modal>
    </div>
  );
}

function ClientActivityTimeline({ clientId }: { clientId: string }) {
  const { t } = useTranslation("clients");
  const activityQuery = (queries as any).useClientActivity(clientId);
  const items = (activityQuery.data ?? []) as import("@/lib/queries/clients").ClientActivityItem[];
  return (
    <div className="pc-card-body">
      {activityQuery.isLoading ? (
        <ListSkeleton rows={5} variant="app" />
      ) : items.length ? (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex gap-3 rounded-md border p-3" style={{ borderColor: "var(--border)" }}>
              <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-surface2 text-text3">
                <History className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold">{item.title}</div>
                  <div className="font-mono text-xs text-text3">{fmtDate(item.created_at)}</div>
                </div>
                {item.description && <p className="mt-1 line-clamp-2 text-xs text-text3">{item.description}</p>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-text3" style={{ borderColor: "var(--border)" }}>
          {t("activity.empty", "Nessuna attivita' disponibile.")}
        </div>
      )}
    </div>
  );
}

function ClientDocumentsPanel({
  clientId,
  canEdit,
  canDelete,
  userId,
}: {
  clientId: string;
  canEdit: boolean;
  canDelete: boolean;
  userId: string | null;
}) {
  const { t } = useTranslation("clients");
  const qc = useQueryClient();
  const documentsQuery = (queries as any).useClientDocuments(clientId);
  const [documentType, setDocumentType] = useState<import("@/lib/queries/clients").ClientDocument["document_type"]>("contract");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const documents = (documentsQuery.data ?? []) as import("@/lib/queries/clients").ClientDocument[];

  async function upload(file: File | null) {
    if (!file || !canEdit) return;
    setBusy(true);
    try {
      await (queries as any).uploadClientDocument({ clientId, file, documentType, description, userId });
      setDescription("");
      void qc.invalidateQueries({ queryKey: ["clients", clientId, "documents"] });
      void qc.invalidateQueries({ queryKey: ["clients", clientId, "activity"] });
      toast.success(t("documents.uploaded", "Documento caricato"));
    } catch (error) {
      toast.error(errorMessage(error, t("documents.uploadError", "Errore upload documento")));
    } finally {
      setBusy(false);
    }
  }

  async function openDocument(document: import("@/lib/queries/clients").ClientDocument) {
    try {
      const url = await (queries as any).getClientDocumentSignedUrl(document);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(errorMessage(error, t("documents.openError", "Errore apertura documento")));
    }
  }

  async function removeDocument(document: import("@/lib/queries/clients").ClientDocument) {
    if (!canDelete) return;
    setBusy(true);
    try {
      await (queries as any).deleteClientDocument(document);
      void qc.invalidateQueries({ queryKey: ["clients", clientId, "documents"] });
      toast.success(t("documents.deleted", "Documento eliminato"));
    } catch (error) {
      toast.error(errorMessage(error, t("documents.deleteError", "Errore eliminazione documento")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pc-card-body space-y-4">
      <div className="grid grid-cols-1 gap-3 rounded-md border p-3 md:grid-cols-[180px_minmax(0,1fr)_auto]" style={{ borderColor: "var(--border)", background: "var(--surface2)" }}>
        <select className="pc-input" value={documentType} disabled={!canEdit || busy} onChange={(event) => setDocumentType(event.target.value as any)} aria-label={t("documents.typeLabel", "Tipo documento")}>
          <option value="contract">{t("documents.typeContract", "Contratto")}</option>
          <option value="nda">{t("documents.typeNda", "NDA")}</option>
          <option value="technical">{t("documents.typeTechnical", "Tecnico")}</option>
          <option value="other">{t("documents.typeOther", "Altro")}</option>
        </select>
        <input className="pc-input" value={description} disabled={!canEdit || busy} placeholder={t("documents.description", "Descrizione documento")} onChange={(event) => setDescription(event.target.value)} aria-label={t("documents.descriptionLabel", "Descrizione documento")} />
        <label className="pc-btn pc-btn-primary pc-btn-sm justify-center">
          <Upload className="size-3" /> {busy ? t("documents.uploading", "Upload...") : t("documents.upload", "Carica")}
          <input type="file" className="hidden" disabled={!canEdit || busy} onChange={(event) => void upload(event.target.files?.[0] ?? null)} />
        </label>
      </div>
      <ResponsiveTable
        empty={t("documents.empty", "Nessun documento allegato al cliente.")}
        headers={[
          t("documents.headers.name", "Nome"),
          t("documents.headers.type", "Tipo"),
          t("documents.headers.size", "Dimensione"),
          t("documents.headers.uploaded", "Caricato"),
          t("documents.headers.actions", "Azioni"),
        ]}
        rows={documents.map((document) => [
          <button className="font-semibold text-accent" type="button" onClick={() => void openDocument(document)}>{document.file_name}</button>,
          documentTypeLabel(document.document_type),
          formatFileSize(document.file_size),
          fmtDate(document.uploaded_at),
          <div className="flex gap-1">
            <button className="pc-btn pc-btn-ghost pc-btn-xs" type="button" onClick={() => void openDocument(document)}>
              <Download className="size-3" />
            </button>
            <button className="pc-btn pc-btn-ghost pc-btn-xs" type="button" disabled={!canDelete || busy} onClick={() => void removeDocument(document)}>
              <Trash2 className="size-3" />
            </button>
          </div>,
        ])}
      />
    </div>
  );
}

function ClientSettingsPanel({
  clientId,
  canEdit,
  userId,
  overview,
}: {
  clientId: string;
  canEdit: boolean;
  userId: string | null;
  overview: import("@/lib/queries/clients").ClientOverview | null | undefined;
}) {
  const { t } = useTranslation("clients");
  const qc = useQueryClient();
  const tagsQuery = (queries as any).useClientTags();
  const assignmentsQuery = (queries as any).useClientTagAssignments([clientId]);
  const alertsQuery = (queries as any).useClientContractAlerts(clientId);
  const allTags = (tagsQuery.data ?? []) as import("@/lib/queries/clients").ClientTag[];
  const assigned = (((assignmentsQuery.data ?? {}) as Record<string, import("@/lib/queries/clients").ClientTag[]>)[clientId] ?? []);
  const assignedIds = new Set(assigned.map((tag) => tag.id));
  const bundle = overview?.activeBundle;
  const alert = ((alertsQuery.data ?? []) as any[])[0];
  const [newTag, setNewTag] = useState("");
  const [responseHours, setResponseHours] = useState("");
  const [resolutionHours, setResolutionHours] = useState("");
  const [daysBefore, setDaysBefore] = useState(30);
  const [channel, setChannel] = useState<"in_app" | "email">("in_app");
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setResponseHours(bundle?.effective_sla_response_hours != null ? String(bundle.effective_sla_response_hours) : "");
    setResolutionHours(bundle?.effective_sla_resolution_hours != null ? String(bundle.effective_sla_resolution_hours) : "");
  }, [bundle?.id, bundle?.effective_sla_response_hours, bundle?.effective_sla_resolution_hours]);

  useEffect(() => {
    if (!alert) return;
    setDaysBefore(alert.days_before ?? 30);
    setChannel(alert.channel ?? "in_app");
    setEnabled(Boolean(alert.enabled));
  }, [alert?.id, alert?.days_before, alert?.channel, alert?.enabled]);

  async function toggleTag(tag: import("@/lib/queries/clients").ClientTag) {
    if (!canEdit) return;
    setBusy(true);
    try {
      await (queries as any).toggleClientTag(clientId, tag.id, !assignedIds.has(tag.id), userId);
      void qc.invalidateQueries({ queryKey: ["clients", "tag-assignments"] });
      toast.success(t("tags.updated", "Tag aggiornati"));
    } catch (error) {
      toast.error(errorMessage(error, t("tags.updateError", "Errore aggiornamento tag")));
    } finally {
      setBusy(false);
    }
  }

  async function addTag() {
    if (!canEdit || !newTag.trim()) return;
    setBusy(true);
    try {
      const tag = await (queries as any).createClientTag(newTag);
      await (queries as any).toggleClientTag(clientId, tag.id, true, userId);
      setNewTag("");
      void qc.invalidateQueries({ queryKey: ["clients", "tags"] });
      void qc.invalidateQueries({ queryKey: ["clients", "tag-assignments"] });
      toast.success(t("tags.created", "Tag assegnato"));
    } catch (error) {
      toast.error(errorMessage(error, t("tags.createError", "Errore creazione tag")));
    } finally {
      setBusy(false);
    }
  }

  async function saveSla() {
    if (!canEdit || !bundle?.id) return;
    setBusy(true);
    try {
      const { error } = await (supabase as any)
        .from("client_bundle_assignments")
        .update({
          custom_sla_response_hours: responseHours ? Number(responseHours) : null,
          custom_sla_resolution_hours: resolutionHours ? Number(resolutionHours) : null,
        })
        .eq("id", bundle.id);
      if (error) throw error;
      void qc.invalidateQueries({ queryKey: ["clients", clientId, "overview"] });
      toast.success(t("sla.saved", "SLA cliente aggiornato"));
    } catch (error) {
      toast.error(errorMessage(error, t("sla.saveError", "Errore aggiornamento SLA")));
    } finally {
      setBusy(false);
    }
  }

  async function saveAlert() {
    if (!canEdit) return;
    setBusy(true);
    try {
      await (queries as any).upsertClientContractAlert({
        clientId,
        bundleAssignmentId: bundle?.id ?? null,
        daysBefore,
        channel,
        enabled,
        userId,
      });
      void qc.invalidateQueries({ queryKey: ["clients", clientId, "contract-alerts"] });
      toast.success(t("alerts.saved", "Alert scadenza aggiornato"));
    } catch (error) {
      toast.error(errorMessage(error, t("alerts.saveError", "Errore salvataggio alert")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pc-card-body space-y-4">
      <div className="rounded-md border p-4" style={{ borderColor: "var(--border)" }}>
        <div className="mb-3 flex items-center gap-2 text-sm font-bold">
          <Tags className="size-4" /> {t("tags.title", "Segmentazione cliente")}
        </div>
        <div className="flex flex-wrap gap-2">
          {allTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              className="rounded-full border px-3 py-1 text-xs font-bold"
              style={{
                borderColor: assignedIds.has(tag.id) ? tag.color || "var(--accent)" : "var(--border)",
                background: assignedIds.has(tag.id) ? "var(--accent2)" : "var(--surface2)",
                color: assignedIds.has(tag.id) ? tag.color || "var(--accent)" : "var(--text3)",
              }}
              disabled={!canEdit || busy}
              onClick={() => void toggleTag(tag)}
            >
              {tag.name}
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input className="pc-input" value={newTag} disabled={!canEdit || busy} placeholder={t("tags.newPlaceholder", "Nuovo tag, es. VIP")} onChange={(event) => setNewTag(event.target.value)} />
          <button className="pc-btn pc-btn-primary pc-btn-sm" type="button" disabled={!canEdit || busy || !newTag.trim()} onClick={() => void addTag()}>
            <Plus className="size-3" /> {t("tags.add", "Aggiungi")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-md border p-4" style={{ borderColor: "var(--border)" }}>
          <div className="mb-3 flex items-center gap-2 text-sm font-bold">
            <Clock className="size-4" /> {t("sla.title", "SLA personalizzato")}
          </div>
          {bundle ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label={t("sla.responseHours", "Risposta entro ore")}>
                <input className="pc-input" type="number" min={0} step={0.5} value={responseHours} disabled={!canEdit || busy} onChange={(event) => setResponseHours(event.target.value)} />
              </Field>
              <Field label={t("sla.resolutionHours", "Risoluzione entro ore")}>
                <input className="pc-input" type="number" min={0} step={0.5} value={resolutionHours} disabled={!canEdit || busy} onChange={(event) => setResolutionHours(event.target.value)} />
              </Field>
              <button className="pc-btn pc-btn-primary pc-btn-sm md:col-span-2" type="button" disabled={!canEdit || busy} onClick={() => void saveSla()}>
                <Save className="size-3" /> {t("sla.save", "Salva override SLA")}
              </button>
            </div>
          ) : (
            <div className="text-sm text-text3">{t("sla.noBundle", "Serve un bundle attivo per configurare uno SLA cliente.")}</div>
          )}
        </div>

        <div className="rounded-md border p-4" style={{ borderColor: "var(--border)" }}>
          <div className="mb-3 flex items-center gap-2 text-sm font-bold">
            <Bell className="size-4" /> {t("alerts.title", "Notifica scadenza contratto")}
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label={t("alerts.daysBefore", "Giorni prima")}>
              <input className="pc-input" type="number" min={1} value={daysBefore} disabled={!canEdit || busy} onChange={(event) => setDaysBefore(Number(event.target.value || 30))} />
            </Field>
            <Field label={t("alerts.channel", "Canale")}>
              <select className="pc-input" value={channel} disabled={!canEdit || busy} onChange={(event) => setChannel(event.target.value as any)} aria-label={t("alerts.channelLabel", "Canale notifica")}>
                <option value="in_app">{t("alerts.inApp", "In-app")}</option>
                <option value="email">{t("alerts.email", "Email")}</option>
              </select>
            </Field>
            <label className="flex items-center gap-2 text-sm text-text2 md:col-span-2">
              <input type="checkbox" checked={enabled} disabled={!canEdit || busy} onChange={(event) => setEnabled(event.target.checked)} />
              {t("alerts.enabled", "Alert attivo")}
            </label>
            <button className="pc-btn pc-btn-primary pc-btn-sm md:col-span-2" type="button" disabled={!canEdit || busy} onClick={() => void saveAlert()}>
              <Save className="size-3" /> {t("alerts.save", "Salva alert")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SmallMetric({
  icon,
  label,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  tone: "danger" | "muted";
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold"
      style={{
        background: tone === "danger" ? "var(--badge-danger-bg)" : "var(--surface2)",
        borderColor: tone === "danger" ? "var(--badge-danger-border)" : "transparent",
        color: tone === "danger" ? "var(--badge-danger-fg)" : "var(--text3)",
      }}
    >
      {icon}
      {label}
    </span>
  );
}

function HeaderCounter({
  value,
  label,
  onClick,
}: {
  value: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="rounded-md border px-3 py-2 text-left"
      style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
      onClick={onClick}
    >
      <div className="font-mono text-sm font-bold">{value}</div>
      <div className="text-[10.5px] uppercase text-text3">{label}</div>
    </button>
  );
}

function ResponsiveTable({
  headers,
  rows,
  empty,
  emptyAction,
}: {
  headers: string[];
  rows: React.ReactNode[][];
  empty: string;
  emptyAction?: React.ReactNode;
}) {
  if (!rows.length) {
    return (
      <div
        className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-md border text-center"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="text-sm text-text3">{empty}</div>
        {emptyAction}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-md border" style={{ borderColor: "var(--border)" }}>
      <OverflowTable>
        <table className="w-full text-[12.5px]">
          <thead style={{ background: "var(--surface2)" }}>
            <tr>
              {headers.map((header) => (
                <th
                  key={header}
                  className="px-3 py-2 text-left text-[10.5px] font-bold uppercase text-text3"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((cells, rowIndex) => (
              <tr key={rowIndex} className="border-t" style={{ borderColor: "var(--border)" }}>
                {cells.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-3 py-2 align-middle text-text2">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </OverflowTable>
    </div>
  );
}

function PortalBadge({ active }: { active: boolean }) {
  const { t } = useTranslation("clients");
  return (
    <span
      className="inline-flex rounded-full px-2 py-0.5 text-[10.5px] font-bold"
      style={{
        background: active ? "rgba(22, 163, 74, .12)" : "var(--surface2)",
        color: active ? "#15803d" : "var(--text3)",
      }}
    >
      {active ? t("portal.active", "Attivo") : t("portal.noAccess", "Nessun accesso")}
    </span>
  );
}

function StatusPill({ value }: { value: string }) {
  const { t } = useTranslation("clients");
  const map: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: t("statusPill.pending", "In attesa"), color: "#92400e", bg: "rgba(245, 158, 11, .14)" },
    "in-progress": { label: t("statusPill.inProgress", "In corso"), color: "#1d4ed8", bg: "rgba(37, 99, 235, .12)" },
    testing: { label: t("statusPill.testing", "Test"), color: "#7c3aed", bg: "rgba(124, 58, 237, .12)" },
    ready: { label: t("statusPill.ready", "Pronto"), color: "#15803d", bg: "rgba(22, 163, 74, .12)" },
    completed: { label: t("statusPill.completed", "Completato"), color: "#166534", bg: "rgba(22, 101, 52, .12)" },
    archived: { label: t("statusPill.archived", "Archiviato"), color: "var(--text3)", bg: "var(--surface2)" },
  };
  const meta = map[value] ?? { label: value, color: "var(--text3)", bg: "var(--surface2)" };
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10.5px] font-bold"
      style={{ color: meta.color, background: meta.bg }}
    >
      {meta.label}
    </span>
  );
}

function PriorityPill({ value }: { value: string }) {
  const { t } = useTranslation("clients");
  const label =
    value === "high" ? t("priority.high", "Alta") : value === "med" ? t("priority.medium", "Media") : value === "low" ? t("priority.low", "Bassa") : value;
  return (
    <span className="rounded-full bg-surface2 px-2 py-0.5 text-[10.5px] font-bold text-text3">
      {label}
    </span>
  );
}

function DeviceStatusPill({ status }: { status: DeviceRow["status"] }) {
  const { t } = useTranslation("clients");
  const map = {
    available: [t("deviceStatus.available", "Disponibile"), "#15803d", "rgba(22, 163, 74, .12)"],
    assigned: [t("deviceStatus.assigned", "Assegnato"), "#1d4ed8", "rgba(37, 99, 235, .12)"],
    maintenance: [t("deviceStatus.maintenance", "Manutenzione"), "#92400e", "rgba(245, 158, 11, .14)"],
    retired: [t("deviceStatus.retired", "Dismesso"), "var(--text3)", "var(--surface2)"],
  } as const;
  const [label, color, bg] = map[status] ?? map.available;
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10.5px] font-bold"
      style={{ color, background: bg }}
    >
      {label}
    </span>
  );
}

function DeviceSummary({ devices }: { devices: DeviceRow[] }) {
  const { t } = useTranslation("clients");
  const count = (status: DeviceRow["status"]) =>
    devices.filter((device) => device.status === status).length;
  return (
    <div className="flex flex-wrap gap-1.5 text-[11px]">
      <SmallMetric
        tone="muted"
        icon={<HardDrive className="h-3 w-3" />}
        label={t("deviceSummary.available", { defaultValue: "Disponibili: {{count}}", count: count("available") })}
      />
      <SmallMetric
        tone="muted"
        icon={<HardDrive className="h-3 w-3" />}
        label={t("deviceSummary.assigned", { defaultValue: "Assegnati: {{count}}", count: count("assigned") })}
      />
      <SmallMetric
        tone="muted"
        icon={<HardDrive className="h-3 w-3" />}
        label={t("deviceSummary.maintenance", { defaultValue: "Manutenzione: {{count}}", count: count("maintenance") })}
      />
      <SmallMetric
        tone="muted"
        icon={<HardDrive className="h-3 w-3" />}
        label={t("deviceSummary.retired", { defaultValue: "Dismessi: {{count}}", count: count("retired") })}
      />
    </div>
  );
}

function formatHours(value: number | string | null | undefined) {
  if (value == null || value === "") return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  if (n < 24) return `${n.toLocaleString("it-IT", { maximumFractionDigits: 1 })}h`;
  return `${(n / 24).toLocaleString("it-IT", { maximumFractionDigits: 1 })}g`;
}

function formatFileSize(value: number | null | undefined) {
  if (!value) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function documentTypeLabel(type: import("@/lib/queries/clients").ClientDocument["document_type"]) {
  const labels = {
    contract: "Contratto",
    nda: "NDA",
    technical: "Tecnico",
    other: "Altro",
  } as const;
  return labels[type] ?? type;
}

function clientInitials(client: ClientRow) {
  return (client.company_name || client.name)
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function compareTickets(a: TicketRow, b: TicketRow) {
  const openA = isOpenTicket(a.status) ? 0 : 1;
  const openB = isOpenTicket(b.status) ? 0 : 1;
  if (openA !== openB) return openA - openB;
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

function isOpenTicket(status: string) {
  return !["completed", "archived"].includes(status);
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

type ClientImportField =
  | "name"
  | "company_name"
  | "vat_number"
  | "fiscal_code"
  | "email"
  | "phone"
  | "address"
  | "notes";

type ClientImportMapping = Partial<Record<ClientImportField, string>>;

const CLIENT_IMPORT_FIELDS: ClientImportField[] = [
  "name",
  "company_name",
  "vat_number",
  "fiscal_code",
  "email",
  "phone",
  "address",
  "notes",
];

type ClientImportResult = {
  inserted: number;
  updated: number;
  errors: { rowNumber: number; name: string; error: string }[];
};

type ContactDuplicateMode = "ask" | "skip" | "overwrite";

type ContactImportRow = {
  rowNumber: number;
  full_name: string;
  email: string;
  phone: string;
  job_title: string;
  department: string;
  is_primary: boolean;
  existingId: string | null;
  action: "insert" | "update" | "skip";
  errors: string[];
};

type ContactImportResult = {
  inserted: number;
  updated: number;
  skipped: number;
  errors: { rowNumber: number; name: string; error: string }[];
};

function ImportContactsCsvDialog({
  open,
  clientId,
  existingContacts,
  onClose,
  onImported,
}: {
  open: boolean;
  clientId: string | null;
  existingContacts: ContactRow[];
  onClose: () => void;
  onImported: () => void;
}) {
  const { canEdit } = useAuth();
  const { t } = useTranslation("clients");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [rows, setRows] = useState<ContactImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [duplicateMode, setDuplicateMode] = useState<ContactDuplicateMode>("ask");
  const [result, setResult] = useState<ContactImportResult | null>(null);

  const stats = useMemo(
    () => ({
      inserts: rows.filter((row) => row.action === "insert").length,
      updates: rows.filter((row) => row.action === "update").length,
      skipped: rows.filter((row) => row.action === "skip" && !row.errors.length).length,
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
    setDuplicateMode("ask");
    setResult(null);
    onClose();
  }

  function applyDuplicateMode(nextMode: ContactDuplicateMode, sourceRows = rows) {
    setDuplicateMode(nextMode);
    setRows(
      sourceRows.map((row) => {
        if (!row.existingId || row.errors.length) return row;
        return { ...row, action: nextMode === "overwrite" ? "update" : "skip" };
      }),
    );
  }

  async function handleFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    setResult(null);
    setFileName(file.name);
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      const preview = buildContactImportPreview(parsed, existingContacts, duplicateMode);
      setRows(preview);
      setStep(2);
      if (!preview.length) toast.error(t("importContacts.validation.emptyCsv", "CSV vuoto o senza righe valide"));
    } catch (error) {
      toast.error(errorMessage(error, t("toasts.readCsvError", "Errore lettura CSV")));
    } finally {
      setBusy(false);
    }
  }

  function downloadTemplate() {
    downloadCsv(
      [
        [
          "nome",
          "cognome",
          "email",
          "telefono",
          "ruolo_aziendale",
          "reparto",
          "referente_principale",
        ],
        ["Mario", "Rossi", "mario@azienda.it", "0123456789", "IT Manager", "IT", "true"],
      ],
      t("importContacts.templateFileName", "pcready-template-referenti.csv"),
    );
  }

  async function confirmImport() {
    if (!canEdit) return toast.error(t("errors.insufficientPermissions", "Permessi insufficienti"));
    if (!clientId) return toast.error(t("errors.selectClientFirst", "Seleziona prima un cliente"));
    if (!stats.valid) return toast.error(t("importContacts.validation.noValidRows", "Nessuna riga valida da importare"));
    setBusy(true);
    setStep(3);
    try {
      const importResult = await importContactsFromPreview(clientId, rows);
      setResult(importResult);
      onImported();
      toast.success(t("toasts.importContactsCompleted", "Import referenti completato"));
    } catch (error) {
      toast.error(errorMessage(error, t("toasts.importContactsError", "Errore import referenti")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={resetAndClose}
      title={t("importContacts.title", "Import CSV referenti")}
      size="lg"
      footer={
        <>
          <button className="pc-btn pc-btn-ghost" onClick={resetAndClose} disabled={busy}>
            {t("importContacts.close", "Chiudi")}
          </button>
          {step === 2 && (
            <button
              className="pc-btn pc-btn-primary"
              onClick={confirmImport}
              disabled={busy || !stats.valid}
            >
              {t("importContacts.importValidRows", "Importa righe valide")}
            </button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {step === 1 && (
          <div className="flex flex-col gap-3">
            <label
              className="flex min-h-[150px] cursor-pointer flex-col items-center justify-center gap-3 rounded-md border border-dashed px-4 text-center"
              style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
            >
              <FileUp className="h-8 w-8 text-text3" />
              <div>
                <div className="text-sm font-semibold">{t("importContacts.uploadLabel", "Carica file .csv")}</div>
                <div className="text-xs text-text3">
                  {busy
                    ? t("importContacts.reading", "Lettura in corso...")
                    : fileName ||
                      t("importContacts.csvHint", "nome,cognome,email,telefono,ruolo_aziendale,reparto,referente_principale")}
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
              <Download className="w-3 h-3" /> {t("importContacts.downloadTemplate", "Scarica template CSV")}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="grid grid-cols-5 gap-2 text-xs">
                <SummaryBox label={t("importContacts.resultSummary.insert", "Insert")} value={stats.inserts} />
                <SummaryBox label={t("importContacts.resultSummary.update", "Update")} value={stats.updates} />
                <SummaryBox label={t("importContacts.resultSummary.skipped", "Saltati")} value={stats.skipped} />
                <SummaryBox label={t("importContacts.resultSummary.errors", "Errori")} value={stats.errors} />
                <SummaryBox label={t("importContacts.resultSummary.rows", "Righe")} value={rows.length} />
              </div>
              <select
                className="pc-input w-auto text-xs"
                value={duplicateMode}
                onChange={(event) => applyDuplicateMode(event.target.value as ContactDuplicateMode)}
              >
                <option value="ask">{t("importContacts.duplicateMode.ask", "Duplicati: chiedi")}</option>
                <option value="skip">{t("importContacts.duplicateMode.skip", "Duplicati: salta")}</option>
                <option value="overwrite">{t("importContacts.duplicateMode.overwrite", "Duplicati: sovrascrivi")}</option>
              </select>
            </div>
            <div
              className="max-h-[360px] overflow-auto rounded-md border"
              style={{ borderColor: "var(--border)" }}
            >
              <OverflowTable>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: "var(--surface2)" }}>
                      {[
                        t("importContacts.previewHeaders.row", "Riga"),
                        t("importContacts.previewHeaders.name", "Nome"),
                        t("importContacts.previewHeaders.email", "Email"),
                        t("importContacts.previewHeaders.role", "Ruolo"),
                        t("importContacts.previewHeaders.department", "Reparto"),
                        t("importContacts.previewHeaders.action", "Azione"),
                        t("importContacts.previewHeaders.validation", "Validazione"),
                      ].map(
                        (h) => (
                          <th
                            key={h}
                            className="px-3 py-2 text-left font-bold uppercase text-text3"
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={`${row.rowNumber}-${row.email}-${row.full_name}`}
                        className="border-t"
                        style={{ borderColor: "var(--border)" }}
                      >
                        <td className="px-3 py-2 font-mono">{row.rowNumber}</td>
                        <td className="px-3 py-2">{row.full_name || "-"}</td>
                        <td className="px-3 py-2">{row.email || "-"}</td>
                        <td className="px-3 py-2">{row.job_title || "-"}</td>
                        <td className="px-3 py-2">{row.department || "-"}</td>
                        <td className="px-3 py-2">
                          {duplicateMode === "ask" && row.existingId && !row.errors.length ? (
                            <select
                              className="pc-input h-8 w-auto text-xs"
                              value={row.action}
                              onChange={(event) =>
                                setRows((current) =>
                                  current.map((item) =>
                                    item.rowNumber === row.rowNumber
                                      ? {
                                          ...item,
                                          action: event.target.value as ContactImportRow["action"],
                                        }
                                      : item,
                                  ),
                                )
                              }
                            >
                              <option value="skip">{t("importContacts.actions.skip", "Salta")}</option>
                              <option value="update">{t("importContacts.actions.overwrite", "Sovrascrivi")}</option>
                            </select>
                          ) : (
                            row.action
                          )}
                        </td>
                        <td
                          className={
                            row.errors.length
                              ? "px-3 py-2 text-destructive"
                              : "px-3 py-2 text-text3"
                          }
                        >
                          {row.errors.join(", ") || (row.existingId ? t("importContacts.validation.emailExists", "Email gia' presente") : t("importContacts.validation.ok", "OK"))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </OverflowTable>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            {result ? (
              <div className="grid grid-cols-4 gap-2">
                <SummaryBox label={t("importContacts.resultSummary.inserts", "Inseriti")} value={result.inserted} />
                <SummaryBox label={t("importContacts.resultSummary.updates", "Aggiornati")} value={result.updated} />
                <SummaryBox label={t("importContacts.resultSummary.skipped", "Saltati")} value={result.skipped} />
                <SummaryBox label={t("importContacts.resultSummary.errors", "Errori")} value={result.errors.length} />
              </div>
            ) : (
              <div className="text-sm text-text2">{t("importContacts.importing", "Import in corso...")}</div>
            )}
            {result?.errors.length ? (
              <div
                className="rounded-md border p-3 text-xs text-destructive"
                style={{ borderColor: "var(--border)" }}
              >
                {result.errors.map((error) => (
                  <div key={`${error.rowNumber}-${error.name}`}>
                    {t("importContacts.resultRow", { defaultValue: "Riga {{rowNumber}} ({{name}}): {{error}}", rowNumber: error.rowNumber, name: error.name || "-", error: error.error })}
                  </div>
                ))}
              </div>
            ) : result ? (
              <div className="flex items-center gap-2 text-sm text-text2">
                <CheckCircle2 className="h-4 w-4 text-green-600" /> {t("importContacts.importCompleted", "Import completato")}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </Modal>
  );
}

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
  const { t } = useTranslation("clients");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [rows, setRows] = useState<ClientImportRow[]>([]);
  const [records, setRecords] = useState<CsvRecord[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ClientImportMapping>({});
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
    setRecords([]);
    setHeaders([]);
    setMapping({});
    setFileName("");
    setBusy(false);
    setResult(null);
    onClose();
  }

  async function rebuildPreview(nextMapping: ClientImportMapping, sourceRecords = records) {
    const existing = await loadClientImportKeys();
    const preview = buildClientImportPreview(sourceRecords, existing, nextMapping);
    setRows(preview);
    if (!preview.length) toast.error(t("importClients.validation.emptyCsv", "CSV vuoto o senza righe valide"));
  }

  async function handleFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    setResult(null);
    setFileName(file.name);
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      const parsedHeaders = Object.keys(parsed[0]?.values ?? {});
      const guessedMapping = guessClientImportMapping(parsedHeaders);
      setRecords(parsed);
      setHeaders(parsedHeaders);
      setMapping(guessedMapping);
      await rebuildPreview(guessedMapping, parsed);
      setStep(2);
    } catch (error) {
      toast.error(errorMessage(error, t("toasts.readCsvError", "Errore lettura CSV")));
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
    downloadCsv(template, t("importClients.templateFileName", "pcready-template-clienti.csv"));
  }

  async function confirmImport() {
    if (!canEdit) return toast.error(t("errors.insufficientPermissions", "Permessi insufficienti"));
    if (!stats.valid) return toast.error(t("importClients.validation.noValidRows", "Nessuna riga valida da importare"));
    setBusy(true);
    setStep(3);
    try {
      const importResult = await importClientsFromPreview(rows);
      setResult(importResult);
      onImported();
      toast.success(t("toasts.importCompleted", "Import CSV completato"));
    } catch (error) {
      toast.error(errorMessage(error, t("toasts.importCsvError", "Errore import CSV")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={resetAndClose}
      title={t("importClients.title", "Import CSV clienti")}
      size="lg"
      footer={
        <>
          <button className="pc-btn pc-btn-ghost" onClick={resetAndClose} disabled={busy}>
            {t("importClients.close", "Chiudi")}
          </button>
          {step === 2 && (
            <button
              className="pc-btn pc-btn-primary"
              onClick={confirmImport}
              disabled={busy || !stats.valid}
            >
              {t("importClients.confirmImport", "Conferma import")}
            </button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2 text-xs">
          {[
            ["1", t("importClients.steps.upload", "Upload")],
            ["2", t("importClients.steps.preview", "Preview")],
            ["3", t("importClients.steps.confirm", "Conferma")],
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
                <div className="text-sm font-semibold">{t("importClients.uploadLabel", "Carica file .csv")}</div>
                <div className="text-xs text-text3">
                  {busy ? t("importClients.reading", "Lettura in corso...") : fileName || t("importClients.csvHint", "nome, azienda, p.iva, email")}
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
              <Download className="w-3 h-3" /> {t("importClients.downloadTemplate", "Scarica template CSV")}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-3">
            <div className="rounded-md border p-3" style={{ borderColor: "var(--border)", background: "var(--surface2)" }}>
              <div className="mb-3 text-sm font-semibold">{t("importClients.mappingTitle", "Mapping colonne")}</div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                {CLIENT_IMPORT_FIELDS.map((field) => (
                  <Field key={field} label={clientImportFieldLabel(field)}>
                    <select
                      className="pc-input h-9 text-xs"
                      value={mapping[field] ?? ""}
                      disabled={busy}
                      onChange={(event) => setMapping((current) => ({ ...current, [field]: event.target.value || undefined }))}
                    >
                      <option value="">{t("importClients.mappingNone", "Non importare")}</option>
                      {headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </Field>
                ))}
              </div>
              <div className="mt-3 flex justify-end">
                <button className="pc-btn pc-btn-ghost pc-btn-sm" type="button" disabled={busy} onClick={() => void rebuildPreview(mapping)}>
                  <CheckCircle2 className="h-3 w-3" /> {t("importClients.applyMapping", "Applica mapping")}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 text-xs">
              <SummaryBox label={t("importClients.resultSummary.insert", "Insert")} value={stats.inserts} />
              <SummaryBox label={t("importClients.resultSummary.update", "Update")} value={stats.updates} />
              <SummaryBox label={t("importClients.resultSummary.errors", "Errori")} value={stats.errors} />
              <SummaryBox label={t("importClients.resultSummary.rows", "Righe")} value={rows.length} />
            </div>
            <div
              className="max-h-[360px] overflow-auto rounded-md border"
              style={{ borderColor: "var(--border)" }}
            >
              <OverflowTable>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: "var(--surface2)" }}>
                      {[
                        t("importClients.previewHeaders.row", "Riga"),
                        t("importClients.previewHeaders.name", "Nome"),
                        t("importClients.previewHeaders.company", "Azienda"),
                        t("importClients.previewHeaders.vat", "P.IVA"),
                        t("importClients.previewHeaders.email", "Email"),
                        t("importClients.previewHeaders.action", "Azione"),
                        t("importClients.previewHeaders.validation", "Validazione"),
                      ].map(
                        (h) => (
                          <th
                            key={h}
                            className="px-3 py-2 text-left font-bold uppercase text-text3"
                          >
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
                            row.errors.length
                              ? "px-3 py-2 text-destructive"
                              : "px-3 py-2 text-text3"
                          }
                        >
                          {row.errors.join(", ") || t("importClients.validation.ok", "OK")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </OverflowTable>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            {result ? (
              <div className="grid grid-cols-3 gap-2">
                <SummaryBox label={t("importClients.resultSummary.inserts", "Inseriti")} value={result.inserted} />
                <SummaryBox label={t("importClients.resultSummary.updates", "Aggiornati")} value={result.updated} />
                <SummaryBox label={t("importClients.resultSummary.errors", "Errori")} value={result.errors.length} />
              </div>
            ) : (
              <div className="text-sm text-text2">{t("importClients.importing", "Import in corso...")}</div>
            )}
            {result?.errors.length ? (
              <div
                className="rounded-md border p-3 text-xs text-destructive"
                style={{ borderColor: "var(--border)" }}
              >
                {result.errors.map((error) => (
                  <div key={`${error.rowNumber}-${error.name}`}>
                    {t("importClients.resultRow", { defaultValue: "Riga {{rowNumber}} ({{name}}): {{error}}", rowNumber: error.rowNumber, name: error.name || "-", error: error.error })}
                  </div>
                ))}
              </div>
            ) : result ? (
              <div className="flex items-center gap-2 text-sm text-text2">
                <CheckCircle2 className="h-4 w-4 text-green-600" /> {t("importClients.importCompleted", "Import completato")}
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

function toClientForm(c: ClientRow): ClientForm {
  return {
    company_name: c.company_name || c.name,
    vat_number: c.vat_number || "",
    fiscal_code: c.fiscal_code || "",
    email: c.email || "",
    phone: c.phone || "",
    website_url: c.website_url || "",
    address: c.address || "",
    notes: c.notes || "",
    portal_logo_url: c.portal_logo_url || "",
    portal_primary_color: c.portal_primary_color || "#1B4FD8",
    portal_welcome_message: c.portal_welcome_message || "",
    portal_name: c.portal_name || "",
  };
}

function clean(value: string) {
  const v = value.trim();
  return v || null;
}

function normalizeOptionalUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
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

function buildClientImportPreview(
  records: CsvRecord[],
  existing: ExistingClientKeys,
  mapping: ClientImportMapping = {},
) {
  const seenKeys = new Set<string>();

  return records.map((record) => {
    const name = getClientImportValue(record.values, mapping, "name", ["nome", "name", "ragione_sociale"]);
    const companyName =
      getClientImportValue(record.values, mapping, "company_name", ["azienda", "company", "company_name", "ragione_sociale"]) ||
      name;
    const vatNumber = getClientImportValue(record.values, mapping, "vat_number", ["p_iva", "piva", "partita_iva", "vat_number"]);
    const email = getClientImportValue(record.values, mapping, "email", ["email", "mail"]);
    const row: ClientImportRow = {
      rowNumber: record.rowNumber,
      name,
      company_name: companyName,
      vat_number: vatNumber,
      fiscal_code: getClientImportValue(record.values, mapping, "fiscal_code", ["codice_fiscale", "fiscal_code"]),
      email,
      phone: getClientImportValue(record.values, mapping, "phone", ["telefono", "phone", "tel"]),
      address: getClientImportValue(record.values, mapping, "address", ["indirizzo", "address"]),
      notes: getClientImportValue(record.values, mapping, "notes", ["note", "notes"]),
      existingId: null,
      action: "insert",
      errors: [],
    };

    if (!row.name.trim()) row.errors.push(i18n.t("clients:importClients.validation.nameRequired", "Nome obbligatorio"));
    const vatKey = normalizeKey(row.vat_number);
    const emailKey = normalizeKey(row.email);
    const dedupeKey = vatKey ? `vat:${vatKey}` : emailKey ? `email:${emailKey}` : "";
    if (dedupeKey && seenKeys.has(dedupeKey)) row.errors.push(i18n.t("clients:importClients.validation.duplicateInCsv", "Duplicato nel CSV"));
    if (dedupeKey) seenKeys.add(dedupeKey);

    row.existingId =
      (vatKey && existing.byVat.get(vatKey)) ||
      (emailKey && existing.byEmail.get(emailKey)) ||
      null;
    row.action = row.errors.length ? "skip" : row.existingId ? "update" : "insert";
    return row;
  });
}

function getClientImportValue(
  values: Record<string, string>,
  mapping: ClientImportMapping,
  field: ClientImportField,
  aliases: string[],
) {
  const mappedHeader = mapping[field];
  if (mappedHeader) return values[mappedHeader]?.trim() ?? "";
  return pickCsvValue(values, aliases);
}

function guessClientImportMapping(headers: string[]) {
  const mapping: ClientImportMapping = {};
  const aliases: Record<ClientImportField, string[]> = {
    name: ["nome", "name", "ragione_sociale"],
    company_name: ["azienda", "company", "company_name", "ragione_sociale"],
    vat_number: ["p_iva", "piva", "partita_iva", "vat_number"],
    fiscal_code: ["codice_fiscale", "fiscal_code"],
    email: ["email", "mail"],
    phone: ["telefono", "phone", "tel"],
    address: ["indirizzo", "address"],
    notes: ["note", "notes"],
  };
  for (const field of CLIENT_IMPORT_FIELDS) {
    const found = headers.find((header) => aliases[field].includes(normalizeCsvHeader(header)));
    if (found) mapping[field] = found;
  }
  return mapping;
}

function clientImportFieldLabel(field: ClientImportField) {
  const labels: Record<ClientImportField, string> = {
    name: "Nome *",
    company_name: "Azienda",
    vat_number: "P.IVA",
    fiscal_code: "Codice fiscale",
    email: "Email",
    phone: "Telefono",
    address: "Indirizzo",
    notes: "Note",
  };
  return labels[field];
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
        error: errorMessage(error, i18n.t("clients:toasts.importRowError", "Errore import riga")),
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

function buildContactImportPreview(
  records: CsvRecord[],
  existingContacts: ContactRow[],
  duplicateMode: ContactDuplicateMode,
) {
  const existingByEmail = new Map(
    existingContacts
      .map((contact) => [normalizeKey(contact.email), contact.id] as const)
      .filter(([email]) => Boolean(email)),
  );
  const seenEmails = new Set<string>();

  return records.map((record) => {
    const first = pickCsvValue(record.values, ["nome", "first_name"]);
    const last = pickCsvValue(record.values, ["cognome", "last_name"]);
    const fullName =
      pickCsvValue(record.values, ["nome_completo", "full_name", "name"]) ||
      [first, last].filter(Boolean).join(" ");
    const email = pickCsvValue(record.values, ["email", "mail"]);
    const emailKey = normalizeKey(email);
    const existingId = emailKey ? (existingByEmail.get(emailKey) ?? null) : null;
    const row: ContactImportRow = {
      rowNumber: record.rowNumber,
      full_name: fullName,
      email,
      phone: pickCsvValue(record.values, ["telefono", "phone", "tel"]),
      job_title: pickCsvValue(record.values, ["ruolo_aziendale", "ruolo", "role", "job_title"]),
      department: pickCsvValue(record.values, ["reparto", "department"]),
      is_primary: parseCsvBoolean(
        pickCsvValue(record.values, ["referente_principale", "principale", "is_primary"]),
      ),
      existingId,
      action:
        existingId && duplicateMode !== "overwrite" ? "skip" : existingId ? "update" : "insert",
      errors: [],
    };

    if (!row.full_name.trim()) row.errors.push(i18n.t("clients:importContacts.validation.nameRequired", "Nome obbligatorio"));
    if (!row.email.trim()) row.errors.push(i18n.t("clients:importContacts.validation.emailRequired", "Email obbligatoria"));
    else if (!isValidEmail(row.email)) row.errors.push(i18n.t("clients:importContacts.validation.emailInvalid", "Email non valida"));
    if (emailKey && seenEmails.has(emailKey)) row.errors.push(i18n.t("clients:importContacts.validation.duplicateInCsv", "Duplicato nel CSV"));
    if (emailKey) seenEmails.add(emailKey);
    if (row.errors.length) row.action = "skip";
    return row;
  });
}

async function importContactsFromPreview(clientId: string, rows: ContactImportRow[]) {
  const result: ContactImportResult = { inserted: 0, updated: 0, skipped: 0, errors: [] };

  for (const row of rows) {
    if (row.action === "skip") {
      if (!row.errors.length) result.skipped += 1;
      continue;
    }

    try {
      if (row.is_primary) {
        await supabase
          .from("client_contacts")
          .update({ is_primary: false })
          .eq("client_id", clientId);
      }
      const payload = {
        client_id: clientId,
        full_name: row.full_name.trim(),
        first_name: firstName(row.full_name),
        last_name: lastName(row.full_name),
        email: clean(row.email),
        phone: clean(row.phone),
        job_title: clean(row.job_title),
        role: clean(row.job_title),
        department: clean(row.department),
        is_primary: row.is_primary,
      };

      if (row.action === "update" && row.existingId) {
        const { error } = await supabase
          .from("client_contacts")
          .update(payload)
          .eq("id", row.existingId);
        if (error) throw error;
        result.updated += 1;
      } else {
        const { error } = await supabase
          .from("client_contacts")
          .insert(payload);
        if (error) throw error;
        result.inserted += 1;
      }
    } catch (error) {
      result.errors.push({
        rowNumber: row.rowNumber,
        name: row.full_name,
        error: errorMessage(error, i18n.t("clients:toasts.importRowError", "Errore import riga")),
      });
    }
  }

  return result;
}

function contactLabel(contact: { full_name: string | null }) {
  return contact.full_name || "";
}

function firstName(fullName: string) {
  return fullName.split(" ")[0] || fullName;
}

function lastName(fullName: string) {
  const parts = fullName.split(" ").slice(1);
  return parts.length ? parts.join(" ") : "";
}

function normalizeKey(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function normalizeCsvHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s.-]+/g, "_");
}

function pickCsvValue(values: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const v = values[key];
    if (v != null) return v;
    const lowerKey = key.toLowerCase();
    const lk = Object.keys(values).find((k) => k.toLowerCase() === lowerKey);
    if (lk != null) return values[lk];
  }
  return "";
}

function parseCsvBoolean(value: string): boolean {
  return ["true", "yes", "1", "si", "sì"].includes(value.trim().toLowerCase());
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function parseCsv(text: string): CsvRecord[] {
  const lines = text.split("\n").map((line) => line.trim()).filter((line) => line);
  if (!lines.length) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  if (!headers.length) return [];

  return lines.slice(1).map((line, index) => {
    const values = line.split(",").map((v) => v.trim());
    const record: Record<string, string> = {};
    headers.forEach((header, i) => {
      record[header] = values[i] ?? "";
    });
    return { rowNumber: index + 2, values: record };
  });
}

function formatPortalExpiry(expiresAt: string): string {
  try {
    return new Date(expiresAt).toLocaleDateString("it-IT", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return expiresAt;
  }
}
