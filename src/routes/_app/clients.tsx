import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ListSkeleton } from "@/components/page-states";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ClientSchema,
  ContactSchema,
  type ClientInput,
  type ContactInput,
} from "@/lib/schemas/clients";
import { supabase } from "@/integrations/supabase/client";
import queries from "@/lib/queries/clients";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth-context";
import { openDeviceDetail, openTicketDetail } from "@/lib/use-detail";
import { useTickets } from "@/lib/use-tickets";
import { fmtDate } from "@/lib/pcready";
import { Modal } from "@/components/pcready/Modal";
import {
  Building2,
  CheckCircle2,
  Copy,
  Download,
  FileDown,
  FileUp,
  HardDrive,
  Link2,
  Pencil,
  Plus,
  Save,
  Search,
  Star,
  Trash2,
  Ticket,
  Upload,
  Users,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { generatePortalAccessLink, revokePortalAccessLink } from "@/lib/portal-auth";
import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm-dialog";

export const Route = createFileRoute("/_app/clients")({
  validateSearch: (search: Record<string, unknown>) => ({
    clientId: typeof search.clientId === "string" ? search.clientId : undefined,
    tab:
      search.tab === "info" ||
      search.tab === "contacts" ||
      search.tab === "tickets" ||
      search.tab === "devices"
        ? search.tab
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Clienti - PCReady" },
      { name: "description", content: "Anagrafica clienti e referenti aziendali." },
    ],
  }),
  component: ClientsPage,
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => <LoadingSkeleton />,
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

type ClientTab = "info" | "contacts" | "tickets" | "devices";
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
  "id, name, company_name, vat_number, fiscal_code, email, phone, website_url, address, notes, updated_at";

function ClientsPage() {
  const { canEdit, profile, session } = useAuth();
  const navigate = useNavigate();
  const routeSearch = Route.useSearch();
  const qc = useQueryClient();
  const { openCreate, openAddDevice } = useTickets();
  const canDelete = profile?.role === "admin";
  const canManagePortalAccess = profile?.role === "admin" || profile?.role === "tech";
  const generatePortalLink = useServerFn(generatePortalAccessLink);
  const revokePortalLink = useServerFn(revokePortalAccessLink);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [q, setQ] = useState("");
  const [listFilter, setListFilter] = useState<ClientListFilter>("all");
  const [activeTab, setActiveTab] = useState<ClientTab>("info");
  const [exportBusy, setExportBusy] = useState(false);
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
    useClientsList,
    useClientContacts,
    useClientStats,
    useContactPortalAccess,
    useClientTickets,
    useClientDevices,
    fetchAllClientsForExport,
  } = queries as any;
  const listQuery = useClientsList({ q, page, pageSize: PAGE_SIZE });
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
  const clientIds = useMemo(() => clients.map((client) => client.id), [clients]);
  const statsQuery = useClientStats(clientIds);

  useEffect(() => {
    if (listQuery.data) {
      const arr = listQuery.data.data as ClientRow[];
      setClients(arr);
      setTotal(listQuery.data.count ?? 0);
      setSelectedId((cur) => {
        if (routeSearch.clientId && arr.some((c) => c.id === routeSearch.clientId)) {
          return routeSearch.clientId;
        }
        return cur && arr.some((c) => c.id === cur) ? cur : arr[0]?.id || null;
      });
      setSelectedIds((current) => {
        const pageIds = new Set(arr.map((c) => c.id));
        const next = new Set<string>();
        for (const id of current) {
          if (pageIds.has(id)) next.add(id);
        }
        return next;
      });
    }
  }, [listQuery.data, routeSearch.clientId]);

  useEffect(() => {
    if (routeSearch.tab) setActiveTab(routeSearch.tab as ClientTab);
  }, [routeSearch.tab]);

  useEffect(() => {
    if (!routeSearch.clientId || clients.some((client) => client.id === routeSearch.clientId)) return;
    let cancelled = false;
    supabase
      .from("clients")
      .select(CLIENT_SELECT)
      .eq("id", routeSearch.clientId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        setClients((current) =>
          current.some((client) => client.id === data.id)
            ? current
            : ([data, ...current] as ClientRow[]),
        );
        setSelectedId(data.id);
      });
    return () => {
      cancelled = true;
    };
  }, [clients, routeSearch.clientId]);

  useEffect(() => {
    setPage(0);
  }, [q, listFilter]);

  useEffect(() => {
    setActiveTab((routeSearch.tab as ClientTab | undefined) ?? "info");
    setContactModalOpen(false);
    setEditingContactId(null);
    contactForm.reset(emptyContact as ContactInput);
  }, [selectedId, contactForm, routeSearch.tab]);

  const contactsQuery = useClientContacts(selectedId);
  const contactIds = useMemo(() => contacts.map((contact) => contact.id), [contacts]);
  const portalAccessQuery = useContactPortalAccess(contactIds);
  const ticketsQuery = useClientTickets(selectedId);
  const devicesQuery = useClientDevices(selectedId);
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
  const editingContact = contacts.find((contact) => contact.id === editingContactId) || null;
  const stats = (statsQuery.data ?? {}) as Record<string, import("@/lib/queries/clients").ClientStats>;
  const selectedStats = selected?.id
    ? stats[selected.id] ?? { openTickets: 0, devices: 0, contacts: contacts.length, portalActive: false }
    : { openTickets: 0, devices: 0, contacts: contacts.length, portalActive: false };
  const portalAccess = (portalAccessQuery.data ?? {}) as Record<string, boolean>;
  const tickets = ((ticketsQuery.data ?? []) as TicketRow[]).slice().sort(compareTickets);
  const devices = (devicesQuery.data ?? []) as DeviceRow[];
  const displayedClients = clients.filter((client) => {
    const clientStats = stats[client.id] ?? { openTickets: 0, devices: 0, contacts: 0, portalActive: false };
    if (listFilter === "openTickets") return clientStats.openTickets > 0;
    if (listFilter === "portalActive") return Boolean(client.portal_enabled) || clientStats.portalActive;
    return true;
  });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const listLoading = listQuery.isLoading;
  const allPageSelected = displayedClients.length > 0 && displayedClients.every((c) => selectedIds.has(c.id));

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
          website_url: normalizeOptionalUrl(values.website_url || ""),
          address: clean(values.address || ""),
          notes: clean(values.notes || ""),
        };
        await updateClientMut.mutateAsync({ id: selected!.id, payload: patch });
        toast.success("Cliente aggiornato");
      } else {
        const insert: TablesInsert<"clients"> = {
          name: companyName,
          company_name: companyName,
          vat_number: clean(values.vat_number || ""),
          fiscal_code: clean(values.fiscal_code || ""),
          email: clean(values.email || ""),
          phone: clean(values.phone || ""),
          website_url: normalizeOptionalUrl(values.website_url || ""),
          address: clean(values.address || ""),
          notes: clean(values.notes || ""),
        };
        const data = await createClientMut.mutateAsync(insert);
        setSelectedId(data.id);
        toast.success("Cliente creato");
      }
      // list will refresh via invalidation
    } catch (e) {
      toast.error(errorMessage(e, "Errore salvataggio cliente"));
    } finally {
      setBusy(false);
    }
  });

  async function deleteClient() {
    if (!selected || !canDelete) return toast.error("Solo admin puo' eliminare clienti");
    await deleteClientMut.mutateAsync(selected.id);
    toast.success("Cliente eliminato");
    setSelectedId(null);
  }

  async function bulkDelete() {
    if (!canDelete) return toast.error("Solo admin puo' eliminare clienti");
    const ids = Array.from(selectedIds);
    if (!ids.length) return toast.error("Seleziona almeno un cliente");
    await bulkDeleteMut.mutateAsync(ids);
    toast.success(`${ids.length} clienti eliminati`);
    if (selectedId && selectedIds.has(selectedId)) {
      setSelectedId(null);
    }
    setSelectedIds(new Set());
  }

  async function exportCsv() {
    setExportBusy(true);
    try {
      const { fetchAllClientsForExport } = queries as any;
      const allClients = await fetchAllClientsForExport();
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
      for (const client of displayedClients) {
        if (checked) next.add(client.id);
        else next.delete(client.id);
      }
      return next;
    });
  }

  function openNewContactModal() {
    if (!selectedId) return toast.error("Seleziona prima un cliente");
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
        await updateContactMut.mutateAsync({ id: editingContactId, clientId: selectedId, payload: base });
        toast.success("Referente aggiornato");
      } else {
        await createContactMut.mutateAsync({ clientId: selectedId, payload: base });
        toast.success("Referente aggiunto");
      }
      setContactModalOpen(false);
      resetContactForm();
      // contacts query will refresh via invalidation
    } catch (e) {
      toast.error(errorMessage(e, "Errore salvataggio referente"));
    } finally {
      setBusy(false);
    }
  });

  async function deleteContact(contact: ContactRow) {
    if (!canDelete) return toast.error("Solo admin puo' eliminare referenti");
    await deleteContactMut.mutateAsync({ id: contact.id, clientId: contact.client_id });
    toast.success("Referente eliminato");
  }

  async function generateContactPortalLink(contact: ContactRow) {
    if (!session?.access_token) return toast.error("Sessione non valida");
    if (!canManagePortalAccess) return toast.error("Permessi insufficienti");
    setPortalBusyContactId(contact.id);
    setCopiedPortalLink(false);
    try {
      const result = await generatePortalLink({
        data: { accessToken: session.access_token, contactId: contact.id, ttlHours: 24 },
      });
      setPortalLink(result);
      void qc.invalidateQueries({ queryKey: ['clients'] });
      toast.success("Link portale generato");
    } catch (error) {
      toast.error(errorMessage(error, "Errore generazione link portale"));
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
      toast.error("Impossibile copiare il link");
    }
  }

  async function revokeContactPortalAccess(contact: ContactRow) {
    if (!session?.access_token) return toast.error("Sessione non valida");
    if (!canManagePortalAccess) return toast.error("Permessi insufficienti");
    setPortalRevokingContactId(contact.id);
    try {
      const result = await revokePortalLink({
        data: { accessToken: session.access_token, contactId: contact.id },
      });
      void qc.invalidateQueries({ queryKey: ['clients'] });
      toast.success(
        result.revokedCount
          ? `${result.revokedCount} link portale revocati`
          : "Nessun link attivo da revocare",
      );
    } catch (error) {
      toast.error(errorMessage(error, "Errore revoca accesso portale"));
    } finally {
      setPortalRevokingContactId(null);
    }
  }

  async function confirmDestructiveAction() {
    if (!destructiveAction) return;
    if (destructiveAction.type === "client") {
      if (!canDelete) {
        toast.error("Solo admin puo' eliminare clienti");
        return;
      }
      await deleteClientMut.mutateAsync(destructiveAction.client.id);
      toast.success("Cliente eliminato");
      if (selectedId === destructiveAction.client.id) setSelectedId(null);
    } else if (destructiveAction.type === "bulkClients") {
      if (!canDelete) {
        toast.error("Solo admin puo' eliminare clienti");
        return;
      }
      await bulkDeleteMut.mutateAsync(destructiveAction.ids);
      toast.success(`${destructiveAction.ids.length} clienti eliminati`);
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
          <div className="pc-card-title">Clienti</div>
          <button className="pc-btn pc-btn-primary pc-btn-sm" onClick={startNewClient}>
            <Plus className="w-3 h-3" /> Nuovo
          </button>
        </div>
        <div className="space-y-3 border-b p-3" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-text3" />
            <input
              className="pc-input"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Cerca per nome, P.IVA, codice fiscale o email..."
            />
          </div>
          <div className="grid grid-cols-3 gap-1">
            {[
              ["all", "Tutti"],
              ["openTickets", "Ticket aperti"],
              ["portalActive", "Portale attivo"],
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
          <div className="flex items-center justify-between gap-2 text-xs text-text3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                aria-label="Seleziona pagina"
                checked={allPageSelected}
                onChange={(event) => togglePageSelected(event.target.checked)}
              />
              Seleziona
            </label>
            <span className="font-mono">
              {displayedClients.length}/{total}
            </span>
          </div>
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between rounded-md px-3 py-2" style={{ background: "var(--surface2)" }}>
              <span className="text-xs text-text2">{selectedIds.size} selezionati</span>
              <button className="pc-btn pc-btn-ghost pc-btn-xs" disabled={!canDelete} onClick={() => setDestructiveAction({ type: "bulkClients", ids: Array.from(selectedIds) })}>
                <Trash2 className="w-3 h-3" /> Elimina
              </button>
            </div>
          )}
        </div>
        <div className="max-h-[calc(100vh-285px)] space-y-2 overflow-y-auto p-3">
          {listLoading ? (
            <ListSkeleton rows={8} variant="app" className="gap-2" />
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
                      void navigate({ to: "/clients", search: { clientId: client.id, tab: undefined } });
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        aria-label={`Seleziona ${name}`}
                        checked={selectedIds.has(client.id)}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => toggleSelected(client.id, event.target.checked)}
                      />
                      <Building2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-text3" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-bold">{name}</div>
                        <div className="mt-0.5 truncate font-mono text-[11px] text-text3">
                          {client.vat_number || client.email || client.phone || "Anagrafica da completare"}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <SmallMetric
                        tone={clientStats.openTickets > 0 ? "danger" : "muted"}
                        icon={<Ticket className="h-3 w-3" />}
                        label={`${clientStats.openTickets} ticket`}
                      />
                      <SmallMetric
                        tone="muted"
                        icon={<HardDrive className="h-3 w-3" />}
                        label={`${clientStats.devices} dispositivi`}
                      />
                      <SmallMetric
                        tone="muted"
                        icon={<Users className="h-3 w-3" />}
                        label={`${clientStats.contacts} referenti`}
                      />
                    </div>
                  </button>
                );
              })}
              {!displayedClients.length && (
                <div className="py-8 text-center text-sm text-text3">Nessun cliente trovato</div>
              )}
            </>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t px-3 py-2" style={{ borderColor: "var(--border)" }}>
          <button className="pc-btn pc-btn-ghost pc-btn-sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            Precedente
          </button>
          <span className="font-mono text-xs text-text3">Pagina {page + 1} di {pageCount}</span>
          <button className="pc-btn pc-btn-ghost pc-btn-sm" disabled={page + 1 >= pageCount} onClick={() => setPage((p) => p + 1)}>
            Successiva
          </button>
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
                    <h2 className="truncate text-lg font-bold">{selected.company_name || selected.name}</h2>
                    <div className="mt-1 truncate text-sm text-text3">
                      {[selected.email, selected.phone].filter(Boolean).join(" · ") || "Contatti cliente non compilati"}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <HeaderCounter label="ticket aperti" value={selectedStats.openTickets} onClick={() => setActiveTab("tickets")} />
                  <HeaderCounter label="dispositivi" value={selectedStats.devices} onClick={() => setActiveTab("devices")} />
                  <HeaderCounter label="referenti" value={selectedStats.contacts || contacts.length} onClick={() => setActiveTab("contacts")} />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5 border-b-0">
                {[
                  ["info", "Informazioni"],
                  ["contacts", "Referenti"],
                  ["tickets", "Ticket"],
                  ["devices", "Dispositivi"],
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

            {activeTab === "info" && (
              <div className="pc-card-body">
                <div className="mb-4 flex flex-wrap justify-end gap-2">
                  <button className="pc-btn pc-btn-ghost pc-btn-sm" disabled={!canDelete} onClick={() => setDestructiveAction({ type: "client", client: selected })}>
                    <Trash2 className="w-3 h-3" /> Elimina
                  </button>
                  <button className="pc-btn pc-btn-primary pc-btn-sm" disabled={busy || !canEdit} onClick={onSaveClient}>
                    <Save className="w-3 h-3" /> Salva cliente
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-[14px] md:grid-cols-2">
                  <Field label="Ragione sociale *">
                    <input className="pc-input" {...clientForm.register("company_name")} />
                    {clientForm.formState.errors.company_name && (
                      <p className="mt-1 text-sm text-destructive">{clientForm.formState.errors.company_name.message}</p>
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
                  </Field>
                  <Field label="Telefono">
                    <input className="pc-input" {...clientForm.register("phone")} />
                  </Field>
                  <Field label="Sito web">
                    <input className="pc-input" type="url" placeholder="https://azienda.it" {...clientForm.register("website_url")} />
                    {clientForm.formState.errors.website_url && (
                      <p className="mt-1 text-sm text-destructive">{clientForm.formState.errors.website_url.message}</p>
                    )}
                    {selected.website_url && (
                      <a className="mt-1 inline-flex text-xs font-semibold text-accent" href={selected.website_url} target="_blank" rel="noreferrer">
                        Apri sito web
                      </a>
                    )}
                  </Field>
                  <Field label="Indirizzo">
                    <input className="pc-input" {...clientForm.register("address")} />
                  </Field>
                  <div className="md:col-span-2">
                    <Field label="Note">
                      <textarea className="pc-input min-h-[92px]" {...clientForm.register("notes")} />
                    </Field>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "contacts" && (
              <div className="pc-card-body">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm text-text3">{contacts.length} referenti registrati</div>
                  <div className="flex flex-wrap gap-2">
                    <button className="pc-btn pc-btn-ghost pc-btn-sm" disabled={!canEdit} onClick={() => setContactImportOpen(true)}>
                      <FileUp className="w-3 h-3" /> Importa da CSV
                    </button>
                    <button className="pc-btn pc-btn-primary pc-btn-sm" disabled={!canEdit} onClick={openNewContactModal}>
                      <Plus className="w-3 h-3" /> Nuovo referente
                    </button>
                  </div>
                </div>
                <ResponsiveTable
                  empty="Nessun referente associato."
                  headers={["Nome", "Ruolo", "Reparto", "Email", "Telefono", "Portale", "Azioni"]}
                  rows={contacts.map((contact) => [
                    <span className="inline-flex items-center gap-1 font-semibold">
                      {contact.is_primary && <Star className="h-3 w-3" style={{ color: "var(--warn)" }} />}
                      {contactLabel(contact)}
                    </span>,
                    contact.job_title || "-",
                    contact.department || "-",
                    contact.email || "-",
                    contact.phone || "-",
                    <PortalBadge active={!!portalAccess[contact.id]} />,
                    <div className="flex flex-wrap justify-end gap-1">
                      <button className="pc-btn pc-btn-ghost pc-btn-xs" onClick={() => openEditContactModal(contact)}>
                        <Pencil className="h-3 w-3" /> Modifica
                      </button>
                      <button className="pc-btn pc-btn-ghost pc-btn-xs" disabled={!canManagePortalAccess || portalBusyContactId === contact.id} onClick={() => generateContactPortalLink(contact)}>
                        <Link2 className="h-3 w-3" /> Link
                      </button>
                      {portalAccess[contact.id] && (
                        <button className="pc-btn pc-btn-ghost pc-btn-xs" disabled={!canManagePortalAccess || portalRevokingContactId === contact.id} onClick={() => setDestructiveAction({ type: "revokePortal", contact })}>
                          Revoca
                        </button>
                      )}
                      <button className="pc-btn-icon" disabled={!canDelete} onClick={() => setDestructiveAction({ type: "contact", contact })} title="Elimina referente">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>,
                  ])}
                />
              </div>
            )}

            {activeTab === "tickets" && (
              <div className="pc-card-body">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm text-text3">{tickets.length} ticket collegati</div>
                  <button className="pc-btn pc-btn-primary pc-btn-sm" onClick={openCreate}>
                    <Plus className="w-3 h-3" /> Nuovo ticket
                  </button>
                </div>
                <ResponsiveTable
                  empty="Nessun ticket per questo cliente."
                  emptyAction={<button className="pc-btn pc-btn-primary pc-btn-sm" onClick={openCreate}><Plus className="w-3 h-3" /> Crea primo ticket</button>}
                  headers={["ID", "Titolo", "Stato", "Priorita", "Assegnatario", "Apertura"]}
                  rows={tickets.map((ticket) => [
                    <button className="font-mono text-[12px] font-semibold text-accent" onClick={() => openTicketDetail(ticket.id)}>
                      {ticket.ticket_code}
                    </button>,
                    ticket.software || ticket.requester || "-",
                    <StatusPill value={ticket.status} />,
                    <PriorityPill value={ticket.priority} />,
                    ticket.assignee?.full_name || "Non assegnato",
                    fmtDate(ticket.created_at),
                  ])}
                />
              </div>
            )}

            {activeTab === "devices" && (
              <div className="pc-card-body">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <DeviceSummary devices={devices} />
                  <button className="pc-btn pc-btn-primary pc-btn-sm" onClick={() => openAddDevice()}>
                    <Plus className="w-3 h-3" /> Aggiungi dispositivo
                  </button>
                </div>
                <ResponsiveTable
                  empty="Nessun dispositivo per questo cliente."
                  emptyAction={<button className="pc-btn pc-btn-primary pc-btn-sm" onClick={() => openAddDevice()}><Plus className="w-3 h-3" /> Aggiungi primo dispositivo</button>}
                  headers={["Modello", "Seriale", "OS", "Stato", "Assegnato a", "Inserito"]}
                  rows={devices.map((device) => [
                    <button className="font-semibold text-accent" onClick={() => openDeviceDetail(device.id)}>
                      {device.model}
                    </button>,
                    <span className="font-mono text-[12px]">{device.serial || "-"}</span>,
                    device.os || "-",
                    <DeviceStatusPill status={device.status} />,
                    device.assigned_to || "-",
                    fmtDate(device.created_at),
                  ])}
                />
              </div>
            )}
          </>
        ) : (
          <div className="pc-card-body">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="pc-card-title">Nuovo cliente</div>
                <p className="mt-1 text-sm text-text3">Compila l'anagrafica per creare una nuova scheda cliente.</p>
              </div>
              <button className="pc-btn pc-btn-primary pc-btn-sm" disabled={busy || !canEdit} onClick={onSaveClient}>
                <Save className="w-3 h-3" /> Salva cliente
              </button>
            </div>
            <div className="grid grid-cols-1 gap-[14px] md:grid-cols-2">
              <Field label="Ragione sociale *">
                <input className="pc-input" {...clientForm.register("company_name")} />
              </Field>
              <Field label="P.IVA">
                <input className="pc-input" {...clientForm.register("vat_number")} />
              </Field>
              <Field label="Codice fiscale">
                <input className="pc-input" {...clientForm.register("fiscal_code")} />
              </Field>
              <Field label="Email">
                <input className="pc-input" type="email" {...clientForm.register("email")} />
              </Field>
              <Field label="Telefono">
                <input className="pc-input" {...clientForm.register("phone")} />
              </Field>
              <Field label="Sito web">
                <input className="pc-input" type="url" placeholder="https://azienda.it" {...clientForm.register("website_url")} />
                {clientForm.formState.errors.website_url && (
                  <p className="mt-1 text-sm text-destructive">{clientForm.formState.errors.website_url.message}</p>
                )}
              </Field>
              <Field label="Indirizzo">
                <input className="pc-input" {...clientForm.register("address")} />
              </Field>
              <div className="md:col-span-2">
                <Field label="Note">
                  <textarea className="pc-input min-h-[92px]" {...clientForm.register("notes")} />
                </Field>
              </div>
            </div>
          </div>
        )}
      </div>

      <ContactModal
        open={contactModalOpen}
        title={editingContactId ? "Modifica referente" : "Nuovo referente"}
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
        loadingLabel="Operazione in corso..."
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
      title: "Confermare l'azione?",
      description: "Questa azione e' distruttiva e non puo' essere annullata.",
      confirmLabel: "Conferma",
    };
  }

  if (action.type === "client") {
    const name = action.client.company_name || action.client.name;
    return {
      title: "Eliminare questo cliente?",
      description: `Il cliente "${name}" verra' rimosso insieme ai dati collegati gestiti dalle policy database. L'azione non puo' essere annullata.`,
      confirmLabel: "Elimina cliente",
    };
  }

  if (action.type === "bulkClients") {
    return {
      title: "Eliminare i clienti selezionati?",
      description: `${action.ids.length} clienti verranno rimossi insieme ai dati collegati gestiti dalle policy database. L'azione non puo' essere annullata.`,
      confirmLabel: "Elimina clienti",
    };
  }

  if (action.type === "contact") {
    return {
      title: "Eliminare questo referente?",
      description: `Il referente "${contactLabel(action.contact)}" verra' rimosso dal cliente. L'azione non puo' essere annullata.`,
      confirmLabel: "Elimina referente",
    };
  }

  return {
    title: "Revocare l'accesso portale?",
    description: `Tutti i link portale attivi per "${contactLabel(action.contact)}" verranno revocati. Il referente non potra' piu' usarli per accedere.`,
    confirmLabel: "Revoca accesso",
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
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button className="pc-btn pc-btn-ghost" onClick={onClose} disabled={busy}>
            Annulla
          </button>
          <button className="pc-btn pc-btn-primary" disabled={busy || !canEdit} onClick={onSave}>
            <Save className="w-3 h-3" /> {busy ? "Salvataggio..." : "Salva referente"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Nome e cognome *">
          <input className="pc-input" {...form.register("full_name")} />
          {form.formState.errors.full_name && (
            <p className="mt-1 text-sm text-destructive">{form.formState.errors.full_name.message}</p>
          )}
        </Field>
        <Field label="Email">
          <input className="pc-input" type="email" {...form.register("email")} />
          {form.formState.errors.email && (
            <p className="mt-1 text-sm text-destructive">{form.formState.errors.email.message}</p>
          )}
        </Field>
        <Field label="Telefono">
          <input className="pc-input" {...form.register("phone")} />
        </Field>
        <Field label="Ruolo aziendale">
          <input className="pc-input" {...form.register("job_title")} />
        </Field>
        <Field label="Reparto">
          <input className="pc-input" {...form.register("department")} />
        </Field>
        <label className="flex items-center gap-2 pt-6 text-[12px] text-text2">
          <input type="checkbox" {...form.register("is_primary")} />
          Referente principale
        </label>
        <div className="md:col-span-2">
          <Field label="Note">
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
  portalLink: { contactName: string; clientName: string; loginUrl: string; expiresAt: string } | null;
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
        <div className="flex flex-col gap-4">
          <div>
            <div className="pc-label">Referente</div>
            <div className="text-[13px] font-semibold">{portalLink.contactName}</div>
            <div className="text-[12px] text-text3">{portalLink.clientName}</div>
          </div>
          <div>
            <div className="pc-label">Link</div>
            <div
              className="break-all rounded-md border px-3 py-2 font-mono text-[12px]"
              style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
            >
              {portalLink.loginUrl}
            </div>
          </div>
          <div className="rounded-md border px-3 py-2 text-[12.5px] text-text2" style={{ borderColor: "var(--border)" }}>
            Scade il <span className="font-semibold text-text">{formatPortalExpiry(portalLink.expiresAt)}</span>
          </div>
          <div
            className="rounded-md border px-3 py-2 text-[12.5px]"
            style={{ borderColor: "var(--warn)", background: "rgba(239, 152, 39, .08)" }}
          >
            Condividi questo link direttamente con il cliente. Chiunque lo riceva potra'
            accedere al portale come questo referente fino alla scadenza o alla revoca.
          </div>
        </div>
      )}
    </Modal>
  );
}

function SmallMetric({ icon, label, tone }: { icon: React.ReactNode; label: string; tone: "danger" | "muted" }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
      style={{
        background: tone === "danger" ? "rgba(220, 38, 38, .12)" : "var(--surface2)",
        color: tone === "danger" ? "#b91c1c" : "var(--text3)",
      }}
    >
      {icon}
      {label}
    </span>
  );
}

function HeaderCounter({ value, label, onClick }: { value: number; label: string; onClick: () => void }) {
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
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-md border text-center" style={{ borderColor: "var(--border)" }}>
        <div className="text-sm text-text3">{empty}</div>
        {emptyAction}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-md border" style={{ borderColor: "var(--border)" }}>
      <table className="w-full text-[12.5px]">
        <thead style={{ background: "var(--surface2)" }}>
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-3 py-2 text-left text-[10.5px] font-bold uppercase text-text3">
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

function StatusPill({ value }: { value: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: "In attesa", color: "#92400e", bg: "rgba(245, 158, 11, .14)" },
    "in-progress": { label: "In corso", color: "#1d4ed8", bg: "rgba(37, 99, 235, .12)" },
    testing: { label: "Test", color: "#7c3aed", bg: "rgba(124, 58, 237, .12)" },
    ready: { label: "Pronto", color: "#15803d", bg: "rgba(22, 163, 74, .12)" },
    completed: { label: "Completato", color: "#166534", bg: "rgba(22, 101, 52, .12)" },
    archived: { label: "Archiviato", color: "var(--text3)", bg: "var(--surface2)" },
  };
  const meta = map[value] ?? { label: value, color: "var(--text3)", bg: "var(--surface2)" };
  return <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ color: meta.color, background: meta.bg }}>{meta.label}</span>;
}

function PriorityPill({ value }: { value: string }) {
  const label = value === "high" ? "Alta" : value === "med" ? "Media" : value === "low" ? "Bassa" : value;
  return <span className="rounded-full bg-surface2 px-2 py-0.5 text-[10.5px] font-bold text-text3">{label}</span>;
}

function DeviceStatusPill({ status }: { status: DeviceRow["status"] }) {
  const map = {
    available: ["Disponibile", "#15803d", "rgba(22, 163, 74, .12)"],
    assigned: ["Assegnato", "#1d4ed8", "rgba(37, 99, 235, .12)"],
    maintenance: ["Manutenzione", "#92400e", "rgba(245, 158, 11, .14)"],
    retired: ["Dismesso", "var(--text3)", "var(--surface2)"],
  } as const;
  const [label, color, bg] = map[status] ?? map.available;
  return <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ color, background: bg }}>{label}</span>;
}

function DeviceSummary({ devices }: { devices: DeviceRow[] }) {
  const count = (status: DeviceRow["status"]) => devices.filter((device) => device.status === status).length;
  return (
    <div className="flex flex-wrap gap-1.5 text-[11px]">
      <SmallMetric tone="muted" icon={<HardDrive className="h-3 w-3" />} label={`Disponibili: ${count("available")}`} />
      <SmallMetric tone="muted" icon={<HardDrive className="h-3 w-3" />} label={`Assegnati: ${count("assigned")}`} />
      <SmallMetric tone="muted" icon={<HardDrive className="h-3 w-3" />} label={`Manutenzione: ${count("maintenance")}`} />
      <SmallMetric tone="muted" icon={<HardDrive className="h-3 w-3" />} label={`Dismessi: ${count("retired")}`} />
    </div>
  );
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
      if (!preview.length) toast.error("CSV vuoto o senza righe valide");
    } catch (error) {
      toast.error(errorMessage(error, "Errore lettura CSV"));
    } finally {
      setBusy(false);
    }
  }

  function downloadTemplate() {
    downloadCsv(
      [
        ["nome", "cognome", "email", "telefono", "ruolo_aziendale", "reparto", "referente_principale"],
        ["Mario", "Rossi", "mario@azienda.it", "0123456789", "IT Manager", "IT", "true"],
      ],
      "template-referenti-pcready.csv",
    );
  }

  async function confirmImport() {
    if (!canEdit) return toast.error("Permessi insufficienti");
    if (!clientId) return toast.error("Seleziona prima un cliente");
    if (!stats.valid) return toast.error("Nessuna riga valida da importare");
    setBusy(true);
    setStep(3);
    try {
      const importResult = await importContactsFromPreview(clientId, rows);
      setResult(importResult);
      onImported();
      toast.success("Import referenti completato");
    } catch (error) {
      toast.error(errorMessage(error, "Errore import referenti"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={resetAndClose}
      title="Import CSV referenti"
      size="lg"
      footer={
        <>
          <button className="pc-btn pc-btn-ghost" onClick={resetAndClose} disabled={busy}>
            Chiudi
          </button>
          {step === 2 && (
            <button className="pc-btn pc-btn-primary" onClick={confirmImport} disabled={busy || !stats.valid}>
              Importa righe valide
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
                <div className="text-sm font-semibold">Carica file .csv</div>
                <div className="text-xs text-text3">
                  {busy ? "Lettura in corso..." : fileName || "nome,cognome,email,telefono,ruolo_aziendale,reparto,referente_principale"}
                </div>
              </div>
              <input type="file" accept=".csv,text/csv" className="hidden" disabled={busy} onChange={(event) => void handleFile(event.target.files?.[0] ?? null)} />
            </label>
            <button className="pc-btn pc-btn-ghost self-start" onClick={downloadTemplate}>
              <Download className="w-3 h-3" /> Scarica template CSV
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="grid grid-cols-5 gap-2 text-xs">
                <SummaryBox label="Insert" value={stats.inserts} />
                <SummaryBox label="Update" value={stats.updates} />
                <SummaryBox label="Saltati" value={stats.skipped} />
                <SummaryBox label="Errori" value={stats.errors} />
                <SummaryBox label="Righe" value={rows.length} />
              </div>
              <select className="pc-input w-auto text-xs" value={duplicateMode} onChange={(event) => applyDuplicateMode(event.target.value as ContactDuplicateMode)}>
                <option value="ask">Duplicati: chiedi</option>
                <option value="skip">Duplicati: salta</option>
                <option value="overwrite">Duplicati: sovrascrivi</option>
              </select>
            </div>
            <div className="max-h-[360px] overflow-auto rounded-md border" style={{ borderColor: "var(--border)" }}>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: "var(--surface2)" }}>
                    {["Riga", "Nome", "Email", "Ruolo", "Reparto", "Azione", "Validazione"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-bold uppercase text-text3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${row.rowNumber}-${row.email}-${row.full_name}`} className="border-t" style={{ borderColor: "var(--border)" }}>
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
                                    ? { ...item, action: event.target.value as ContactImportRow["action"] }
                                    : item,
                                ),
                              )
                            }
                          >
                            <option value="skip">Salta</option>
                            <option value="update">Sovrascrivi</option>
                          </select>
                        ) : (
                          row.action
                        )}
                      </td>
                      <td className={row.errors.length ? "px-3 py-2 text-destructive" : "px-3 py-2 text-text3"}>
                        {row.errors.join(", ") || (row.existingId ? "Email gia' presente" : "OK")}
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
              <div className="grid grid-cols-4 gap-2">
                <SummaryBox label="Inseriti" value={result.inserted} />
                <SummaryBox label="Aggiornati" value={result.updated} />
                <SummaryBox label="Saltati" value={result.skipped} />
                <SummaryBox label="Errori" value={result.errors.length} />
              </div>
            ) : (
              <div className="text-sm text-text2">Import in corso...</div>
            )}
            {result?.errors.length ? (
              <div className="rounded-md border p-3 text-xs text-destructive" style={{ borderColor: "var(--border)" }}>
                {result.errors.map((error) => (
                  <div key={`${error.rowNumber}-${error.name}`}>Riga {error.rowNumber} ({error.name || "-"}): {error.error}</div>
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
    website_url: c.website_url || "",
    address: c.address || "",
    notes: c.notes || "",
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

function cleanSearchTerm(value: string) {
  return value.trim().replace(/[,%]/g, "");
}

// fetchAllClientsForExport moved to queries/clients

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
    const existingId = emailKey ? existingByEmail.get(emailKey) ?? null : null;
    const row: ContactImportRow = {
      rowNumber: record.rowNumber,
      full_name: fullName,
      email,
      phone: pickCsvValue(record.values, ["telefono", "phone", "tel"]),
      job_title: pickCsvValue(record.values, ["ruolo_aziendale", "ruolo", "role", "job_title"]),
      department: pickCsvValue(record.values, ["reparto", "department"]),
      is_primary: parseCsvBoolean(pickCsvValue(record.values, ["referente_principale", "principale", "is_primary"])),
      existingId,
      action: existingId && duplicateMode !== "overwrite" ? "skip" : existingId ? "update" : "insert",
      errors: [],
    };

    if (!row.full_name.trim()) row.errors.push("Nome obbligatorio");
    if (!row.email.trim()) row.errors.push("Email obbligatoria");
    else if (!isValidEmail(row.email)) row.errors.push("Email non valida");
    if (emailKey && seenEmails.has(emailKey)) row.errors.push("Duplicato nel CSV");
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
        await supabase.from("client_contacts").update({ is_primary: false }).eq("client_id", clientId);
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
          .update(payload as TablesUpdate<"client_contacts">)
          .eq("id", row.existingId);
        if (error) throw error;
        result.updated += 1;
      } else {
        const { error } = await supabase
          .from("client_contacts")
          .insert(payload as TablesInsert<"client_contacts">);
        if (error) throw error;
        result.inserted += 1;
      }
    } catch (error) {
      result.errors.push({
        rowNumber: row.rowNumber,
        name: row.full_name,
        error: errorMessage(error, "Errore import riga"),
      });
    }
  }

  return result;
}

function parseCsvBoolean(value: string) {
  return ["true", "1", "si", "sì", "yes", "y"].includes(value.trim().toLowerCase());
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
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

function formatPortalExpiry(value: string) {
  return new Date(value).toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
