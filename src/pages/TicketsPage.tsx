import { useCallback, useMemo, useState, useEffect } from 'react';
import '../styles/tickets.css';
import { useLocation, useParams } from 'react-router-dom';
import TicketDetailDrawer from '../components/tickets/TicketDetailDrawer';
import TicketFiltersComponent from '../components/tickets/TicketFilters';
import TicketFormModal from '../components/tickets/TicketFormModal';
import TicketTable from '../components/tickets/TicketTable';
import { useTicketRealtime } from '../hooks/useTicketRealtime';
import { useTickets } from '../hooks/useTickets';
import { useTicketFilters } from '../hooks/useTicketFilters';
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

  const { filters, filteredTickets, clientOptions, assigneeOptions, handleFiltersChange, handleFiltersReset } = useTicketFilters(tickets);
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

  
  // filters, filteredTickets, clientOptions, assigneeOptions,
  // handleFiltersChange and handleFiltersReset are provided by
  // useTicketFilters to keep TicketsPage lean.


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
    <section className="tickets-page">
      <div className="tickets-header">
        <div>
          <h1 className="tickets-title">Tickets</h1>
          <p className="tickets-subtitle">{pageSubtitle}</p>
        </div>

        <div className="tickets-header-actions">
          <button
            type="button"
            onClick={() => void refetch()}
            className="btn--secondary-tickets"
          >
            Refresh
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            disabled={!canEdit}
            className={"btn--primary-tickets" + (!canEdit ? ' btn--disabled' : '')}
          >
            New ticket
          </button>
        </div>
      </div>

      <div className="tickets-panel">
        <TicketFiltersComponent
          filters={filters}
          onChange={handleFiltersChange}
          clientOptions={clientOptions}
          assigneeOptions={assigneeOptions}
          onReset={handleFiltersReset}
        />
      </div>

  <div className="tickets-panel">
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