import { useCallback, useMemo, useState, useEffect, type CSSProperties } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import TicketDetailDrawer from '../components/tickets/TicketDetailDrawer';
import TicketFiltersComponent from '../components/tickets/TicketFilters';
import TicketFormModal from '../components/tickets/TicketFormModal';
import TicketTable from '../components/tickets/TicketTable';
import { useTicketRealtime } from '../hooks/useTicketRealtime';
import { useTickets } from '../hooks/useTickets';
import { useAuth } from '../context/AuthContext';
import type {
  CreateTicketInput,
  TicketDetail,
  TicketFilters,
  TicketListItem,
  UpdateTicketInput,
} from '../types/ticket';

type SelectOption = {
  value: string;
  label: string;
};

type FormMode = 'create' | 'edit';

function getTicketDisplayAssignee(ticket: TicketListItem | TicketDetail): string | null {
  return ticket.assigned_to ?? null;
}

function matchesSearch(ticket: TicketListItem, search?: string): boolean {
  if (!search) {
    return true;
  }

  const term = search.trim().toLowerCase();

  if (!term) {
    return true;
  }

  const searchableFields = [
    ticket.id,
    ticket.model ?? '',
    ticket.serial ?? '',
    ticket.requester,
    ticket.end_user ?? '',
    ticket.client,
    ticket.assigned_to ?? '',
    ticket.os ?? '',
    ticket.software ?? '',
  ];

  return searchableFields.some((field) => field.toLowerCase().includes(term));
}

function matchesFilters(ticket: TicketListItem, filters: TicketFilters): boolean {
  if (!matchesSearch(ticket, filters.search)) {
    return false;
  }

  if (filters.status && filters.status !== 'all' && ticket.status !== filters.status) {
    return false;
  }

  if (
    filters.priority &&
    filters.priority !== 'all' &&
    ticket.priority !== filters.priority
  ) {
    return false;
  }

  if (filters.client && filters.client !== 'all' && ticket.client !== filters.client) {
    return false;
  }

  if (filters.assigned_to && filters.assigned_to !== 'all') {
    if (filters.assigned_to === 'unassigned') {
      if (ticket.assigned_to) {
        return false;
      }
    } else if (ticket.assigned_to !== filters.assigned_to) {
      return false;
    }
  }

  return true;
}

function toFormInitialValues(ticket: TicketDetail | null): Partial<TicketDetail> | undefined {
  if (!ticket) {
    return undefined;
  }

  return ticket;
}

function TicketsPage(): JSX.Element {
  const { profile } = useAuth();
  const {
    tickets,
  ticket: selectedTicket,
  loading,
    createTicket,
    updateTicket,
    deleteTicket,
    fetchTicketById,
    advanceTicketStatus,
    refetch,
  } = useTickets();

  // ✅ FIX #2: Role da AuthContext, non hardcoded
  const role = profile?.role ?? 'viewer';
  const canEdit = role === 'admin' || role === 'tech';
  const isViewer = role === 'viewer';

  const [filters, setFilters] = useState<TicketFilters>({});
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);
  const [editingTicket, setEditingTicket] = useState<TicketDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState<boolean>(false);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);

  const handleRealtimeRefresh = useCallback((): void => {
    void refetch();
  }, [refetch]);

  useTicketRealtime({ onRefetch: handleRealtimeRefresh });

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket: TicketListItem) => matchesFilters(ticket, filters));
  }, [tickets, filters]);

  const clientOptions = useMemo<SelectOption[]>(() => {
    const uniqueClients = Array.from(
      new Set(
        tickets
          .map((ticket) => ticket.client)
          .filter((value): value is string => value.trim().length > 0)
      )
    ).sort((a, b) => a.localeCompare(b));

    return uniqueClients.map((client) => ({
      value: client,
      label: client,
    }));
  }, [tickets]);

  const assigneeOptions = useMemo<SelectOption[]>(() => {
    const uniqueAssignees = Array.from(
      new Set(
        tickets
          .map((ticket) => getTicketDisplayAssignee(ticket))
          .filter((value): value is string => Boolean(value && value.trim().length > 0))
      )
    ).sort((a, b) => a.localeCompare(b));

    return uniqueAssignees.map((assignee) => ({
      value: assignee,
      label: assignee,
    }));
  }, [tickets]);

  const handleFiltersChange = useCallback((next: TicketFilters): void => {
    setFilters(next);
  }, []);

  const handleFiltersReset = useCallback((): void => {
    setFilters({});
  }, []);

  const handleOpenCreate = useCallback((): void => {
    if (!canEdit) {
      return;
    }

    setEditingTicket(null);
    setFormMode('create');
    setFormOpen(true);
  }, [canEdit]);

  // Open modal based on route (e.g. /tickets/new or /tickets/:id/edit)
  const location = useLocation();
  const params = useParams();

  useEffect(() => {
    if (location.pathname.endsWith('/new')) {
      if (canEdit) {
        setEditingTicket(null);
        setFormMode('create');
        setFormOpen(true);
      }
    } else if (params.id && location.pathname.includes('/tickets/') && location.pathname.endsWith('/edit')) {
      // editing
      (async () => {
        if (!canEdit) return;
        const fetched = await fetchTicketById(params.id as string);
        setEditingTicket(fetched);
        setFormMode('edit');
        setFormOpen(true);
      })();
    }
    // only respond to location changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, params.id, canEdit]);

  const handleOpenDetail = useCallback(
    async (ticketId: string): Promise<void> => {
      setActiveTicketId(ticketId);
      setDetailOpen(true);
      await fetchTicketById(ticketId);
    },
    [fetchTicketById]
  );

  const handleCloseDetail = useCallback((): void => {
    setDetailOpen(false);
    setActiveTicketId(null);
  }, []);

  const handleOpenEdit = useCallback(
    (ticket: TicketDetail): void => {
      if (!canEdit) {
        return;
      }

      setEditingTicket(ticket);
      setFormMode('edit');
      setFormOpen(true);
    },
    [canEdit]
  );

  const handleCloseForm = useCallback((): void => {
    if (formSubmitting) {
      return;
    }

    setFormOpen(false);
    setEditingTicket(null);
    setFormMode('create');
  }, [formSubmitting]);

  const handleFormSubmit = useCallback(
    async (values: CreateTicketInput | UpdateTicketInput): Promise<void> => {
      if (!canEdit) {
        return;
      }

      setFormSubmitting(true);

      try {
        if (formMode === 'create') {
          await createTicket(values as CreateTicketInput);
        } else if (editingTicket) {
          // ✅ FIX #3: Ricarca il ticket prima di salvare per evitare race condition
          // Se il ticket è stato modificato da un altro utente, abbiamo i dati freshi
          const freshTicket = await fetchTicketById(editingTicket.id);
          
          if (!freshTicket) {
            // Il ticket è stato cancellato
            setFormOpen(false);
            setEditingTicket(null);
            await refetch();
            return;
          }

          // Merge: valori dal form + campi dal fresh ticket per evitare data loss
          const merged: UpdateTicketInput = {
            ...freshTicket,
            ...values,
          };

          await updateTicket(editingTicket.id, merged);
          if (detailOpen) {
            await fetchTicketById(editingTicket.id);
          }
        }

        setFormOpen(false);
        setEditingTicket(null);
        setFormMode('create');
        await refetch();
      } finally {
        setFormSubmitting(false);
      }
    },
    [
      canEdit,
      createTicket,
      detailOpen,
      editingTicket,
      fetchTicketById,
      formMode,
      refetch,
      updateTicket,
    ]
  );

  const handleDelete = useCallback(
    async (ticketId: string): Promise<void> => {
      if (!canEdit) {
        return;
      }

      const confirmed = window.confirm(
        `Sei sicuro di voler eliminare il ticket ${ticketId}?`
      );

      if (!confirmed) {
        return;
      }

      await deleteTicket(ticketId);

      if (activeTicketId === ticketId) {
        setDetailOpen(false);
        setActiveTicketId(null);
      }

      await refetch();
    },
    [activeTicketId, canEdit, deleteTicket, refetch]
  );

  const handleAdvanceStatus = useCallback(
    async (ticketId: string): Promise<void> => {
      if (!canEdit) {
        return;
      }

      await advanceTicketStatus(ticketId);
      await refetch();

      if (detailOpen && activeTicketId === ticketId) {
        await fetchTicketById(ticketId);
      }
    },
    [activeTicketId, advanceTicketStatus, canEdit, detailOpen, fetchTicketById, refetch]
  );

  const detailTicket = useMemo<TicketDetail | null>(() => {
    if (!detailOpen) {
      return null;
    }

    if (selectedTicket && activeTicketId && selectedTicket.id === activeTicketId) {
      return selectedTicket;
    }

    return null;
  }, [activeTicketId, detailOpen, selectedTicket]);

  const pageSubtitle = useMemo(() => {
    if (isViewer) {
      return 'Consultazione ticket in sola lettura.';
    }

    return 'Gestione ticket con creazione, modifica, dettaglio e aggiornamenti realtime.';
  }, [isViewer]);

  return (
    <section style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={titleStyle}>Tickets</h1>
          <p style={subtitleStyle}>{pageSubtitle}</p>
        </div>

        <div style={headerActionsStyle}>
          <button
            type="button"
            onClick={() => void refetch()}
            style={secondaryButtonStyle}
          >
            Refresh
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            disabled={!canEdit}
            style={{
              ...primaryButtonStyle,
              ...(!canEdit ? disabledButtonStyle : {}),
            }}
          >
            New ticket
          </button>
        </div>
      </div>

      <div style={panelStyle}>
        <TicketFiltersComponent
          filters={filters}
          onChange={handleFiltersChange}
          clientOptions={clientOptions}
          assigneeOptions={assigneeOptions}
          onReset={handleFiltersReset}
        />
      </div>

      <div style={panelStyle}>
        <TicketTable
          tickets={filteredTickets}
          loading={loading}
          canEdit={canEdit}
          onRowClick={(ticketId) => void handleOpenDetail(ticketId)}
          onAdvanceStatus={
            canEdit ? (ticketId) => void handleAdvanceStatus(ticketId) : undefined
          }
          onDelete={canEdit ? (ticketId) => void handleDelete(ticketId) : undefined}
        />
      </div>

      <TicketFormModal
        open={formOpen}
        mode={formMode}
        initialValues={toFormInitialValues(editingTicket)}
        submitting={formSubmitting}
        onClose={handleCloseForm}
        onSubmit={(values) => void handleFormSubmit(values)}
        assigneeOptions={assigneeOptions}
        clientOptions={clientOptions}
      />

      <TicketDetailDrawer
        open={detailOpen}
        ticket={loading ? null : detailTicket}
        canEdit={canEdit}
        onClose={handleCloseDetail}
        onEdit={canEdit ? handleOpenEdit : undefined}
        onDelete={canEdit ? (ticketId) => void handleDelete(ticketId) : undefined}
        onAdvanceStatus={
          canEdit ? (ticketId) => void handleAdvanceStatus(ticketId) : undefined
        }
      />
    </section>
  );
}

export default TicketsPage;

const pageStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '20px',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '16px',
  flexWrap: 'wrap',
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: '1.75rem',
  fontWeight: 700,
  color: '#111827',
};

const subtitleStyle: CSSProperties = {
  margin: '8px 0 0',
  fontSize: '0.95rem',
  color: '#6B7280',
};

const headerActionsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  flexWrap: 'wrap',
};

const panelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};

const primaryButtonStyle: CSSProperties = {
  minHeight: '40px',
  padding: '10px 14px',
  border: '1px solid #2563EB',
  borderRadius: '8px',
  backgroundColor: '#2563EB',
  color: '#FFFFFF',
  fontSize: '0.95rem',
  fontWeight: 600,
  cursor: 'pointer',
};

const secondaryButtonStyle: CSSProperties = {
  minHeight: '40px',
  padding: '10px 14px',
  border: '1px solid #D1D5DB',
  borderRadius: '8px',
  backgroundColor: '#FFFFFF',
  color: '#111827',
  fontSize: '0.95rem',
  fontWeight: 600,
  cursor: 'pointer',
};

const disabledButtonStyle: CSSProperties = {
  opacity: 0.6,
  cursor: 'not-allowed',
};