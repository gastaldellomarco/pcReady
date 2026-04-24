import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type {
  CreateTicketInput,
  TicketComment,
  TicketDetail,
  TicketListItem,
  UpdateTicketInput,
} from '../types/ticket';

type UserRole = 'admin' | 'tech' | 'viewer';

type ProfileRow = {
  id: string;
  role: UserRole;
  isactive: boolean;
};

type TicketRow = {
  ticketref: string;
  clientid: string | null;
  model: string | null;
  serialnumber: string | null;
  requestername: string;
  endusername: string | null;
  priority: 'high' | 'med' | 'low';
  status: 'pending' | 'in-progress' | 'testing' | 'ready';
  assignedto: string | null;
  os: string | null;
  software: string | null;
  notes: string | null;
  createdat: string;
  updatedat: string;
};

type CommentRow = {
  id: string;
  ticketid: string;
  userid: string;
  content: string;
  isinternal: boolean;
  createdat: string;
  updatedat: string;
};

type UseTicketsState = {
  tickets: TicketListItem[];
  ticket: TicketDetail | null;
  loading: boolean;
  error: string | null;
};

type UseTicketsReturn = UseTicketsState & {
  fetchTickets: () => Promise<TicketListItem[]>;
  fetchTicketById: (id: string) => Promise<TicketDetail | null>;
  createTicket: (input: CreateTicketInput) => Promise<TicketDetail>;
  updateTicket: (id: string, input: UpdateTicketInput) => Promise<TicketDetail>;
  deleteTicket: (id: string) => Promise<void>;
  advanceTicketStatus: (id: string) => Promise<TicketDetail>;
  refetch: () => Promise<void>;
  clearTicket: () => void;
};

function mapTicketRowToListItem(row: TicketRow): TicketListItem {
  return {
    id: row.ticketref,
    client: row.clientid ?? '',
    model: row.model,
    serial: row.serialnumber,
    requester: row.requestername,
    end_user: row.endusername,
    priority: row.priority,
    status: row.status,
    assigned_to: row.assignedto,
    os: row.os,
    software: row.software,
    created_at: row.createdat,
    updated_at: row.updatedat,
  };
}

function mapCommentRow(row: CommentRow): TicketComment {
  return {
    id: row.id,
    ticket_id: row.ticketid,
    author_id: row.userid,
    body: row.content,
    is_internal: row.isinternal,
    created_at: row.createdat,
    updated_at: row.updatedat,
  };
}

function mapTicketRowToDetail(row: TicketRow, comments: TicketComment[] = []): TicketDetail {
  return {
    id: row.ticketref,
    client: row.clientid ?? '',
    model: row.model,
    serial: row.serialnumber,
    requester: row.requestername,
    end_user: row.endusername,
    priority: row.priority,
    status: row.status,
    assigned_to: row.assignedto,
    os: row.os,
    software: row.software,
    notes: row.notes,
    created_at: row.createdat,
    updated_at: row.updatedat,
    comments,
  };
}

function mapCreateInputToInsert(input: CreateTicketInput) {
  return {
    clientid: input.client,
    model: input.model ?? null,
    serialnumber: input.serial ?? null,
    requestername: input.requester,
    endusername: input.end_user ?? null,
    priority: input.priority,
    status: input.status ?? 'pending',
    assignedto: input.assigned_to ?? null,
    os: input.os ?? null,
    software: input.software ?? null,
    notes: input.notes ?? null,
  };
}

function mapUpdateInputToPatch(input: UpdateTicketInput) {
  const patch: Record<string, string | null | undefined> = {};

  if (input.client !== undefined) patch.clientid = input.client;
  if (input.model !== undefined) patch.model = input.model;
  if (input.serial !== undefined) patch.serialnumber = input.serial;
  if (input.requester !== undefined) patch.requestername = input.requester;
  if (input.end_user !== undefined) patch.endusername = input.end_user;
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.status !== undefined) patch.status = input.status;
  if (input.assigned_to !== undefined) patch.assignedto = input.assigned_to;
  if (input.os !== undefined) patch.os = input.os;
  if (input.software !== undefined) patch.software = input.software;
  if (input.notes !== undefined) patch.notes = input.notes;

  return patch;
}

async function getCurrentProfile(): Promise<ProfileRow | null> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    throw new Error(authError.message);
  }

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, isactive')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return data as ProfileRow;
}

async function ensureWriteAccess(): Promise<void> {
  const profile = await getCurrentProfile();

  if (!profile || !profile.isactive) {
    throw new Error('Utente non autorizzato.');
  }

  if (profile.role === 'viewer') {
    throw new Error('Permessi insufficienti: accesso in sola lettura.');
  }
}

async function getTicketRowByTicketRef(ticketRef: string): Promise<TicketRow> {
  const { data, error } = await supabase
    .from('tickets')
    .select(
      'ticketref, clientid, model, serialnumber, requestername, endusername, priority, status, assignedto, os, software, notes, createdat, updatedat'
    )
    .eq('ticketref', ticketRef)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as TicketRow;
}

async function getCommentsByTicketRef(ticketRef: string): Promise<TicketComment[]> {
  const ticketRow = await getTicketRowByTicketRef(ticketRef);

  const { data, error } = await supabase
    .from('comments')
    .select('id, ticketid, userid, content, isinternal, createdat, updatedat')
    .eq('ticketid', ticketRow.ticketref)
    .order('createdat', { ascending: true });

  if (error) {
    return [];
  }

  return ((data ?? []) as CommentRow[]).map(mapCommentRow);
}

export function useTickets(selectedTicketId?: string): UseTicketsReturn {
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTickets = useCallback(async (): Promise<TicketListItem[]> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('tickets')
        .select(
          'ticketref, clientid, model, serialnumber, requestername, endusername, priority, status, assignedto, os, software, notes, createdat, updatedat'
        )
        .order('createdat', { ascending: false });

      if (queryError) {
        throw new Error(queryError.message);
      }

      const mapped = ((data ?? []) as TicketRow[]).map(mapTicketRowToListItem);
      setTickets(mapped);
      return mapped;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore durante il caricamento dei ticket.';
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTicketById = useCallback(async (id: string): Promise<TicketDetail | null> => {
    setLoading(true);
    setError(null);

    try {
      const ticketRow = await getTicketRowByTicketRef(id);
      const comments = await getCommentsByTicketRef(id);
      const mapped = mapTicketRowToDetail(ticketRow, comments);

      setTicket(mapped);
      return mapped;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Errore durante il caricamento del ticket.';
      setError(message);
      setTicket(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const createTicket = useCallback(async (input: CreateTicketInput): Promise<TicketDetail> => {
    setLoading(true);
    setError(null);

    try {
      await ensureWriteAccess();

      const payload = mapCreateInputToInsert(input);

      const { data, error: insertError } = await supabase
        .from('tickets')
        .insert(payload)
        .select(
          'ticketref, clientid, model, serialnumber, requestername, endusername, priority, status, assignedto, os, software, notes, createdat, updatedat'
        )
        .single();

      if (insertError) {
        throw new Error(insertError.message);
      }

      const created = mapTicketRowToDetail(data as TicketRow, []);
      setTicket(created);
      await fetchTickets();

      return created;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore durante la creazione del ticket.';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, [fetchTickets]);

  const updateTicket = useCallback(
    async (id: string, input: UpdateTicketInput): Promise<TicketDetail> => {
      setLoading(true);
      setError(null);

      try {
        await ensureWriteAccess();

        const patch = mapUpdateInputToPatch(input);

        const { data, error: updateError } = await supabase
          .from('tickets')
          .update(patch)
          .eq('ticketref', id)
          .select(
            'ticketref, clientid, model, serialnumber, requestername, endusername, priority, status, assignedto, os, software, notes, createdat, updatedat'
          )
          .single();

        if (updateError) {
          throw new Error(updateError.message);
        }

        const comments = ticket?.id === id ? ticket.comments : await getCommentsByTicketRef(id);
        const updated = mapTicketRowToDetail(data as TicketRow, comments);

        setTicket(updated);
        await fetchTickets();

        return updated;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Errore durante l’aggiornamento del ticket.';
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [fetchTickets, ticket]
  );

    const advanceTicketStatus = useCallback(
      async (id: string): Promise<TicketDetail> => {
        // Fetch current ticket detail (use cached if available)
        const current = ticket?.id === id ? ticket : await fetchTicketById(id);

        if (!current) {
          throw new Error('Ticket not found');
        }

        const order: TicketDetail['status'][] = ['pending', 'in-progress', 'testing', 'ready'];
        const idx = order.indexOf(current.status);
        const nextStatus = idx === -1 || idx === order.length - 1 ? current.status : order[idx + 1];

        const updated = await updateTicket(id, { status: nextStatus });
        return updated;
      },
      [ticket, fetchTicketById, updateTicket]
    );

  const deleteTicket = useCallback(
    async (id: string): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        await ensureWriteAccess();

        const { error: deleteError } = await supabase.from('tickets').delete().eq('ticketref', id);

        if (deleteError) {
          throw new Error(deleteError.message);
        }

        setTicket((current) => (current?.id === id ? null : current));
        await fetchTickets();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Errore durante l’eliminazione del ticket.';
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [fetchTickets]
  );

  const refetch = useCallback(async (): Promise<void> => {
    if (selectedTicketId) {
      await fetchTicketById(selectedTicketId);
      return;
    }

    await fetchTickets();
  }, [fetchTicketById, fetchTickets, selectedTicketId]);

  const clearTicket = useCallback(() => {
    setTicket(null);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    tickets,
    ticket,
    loading,
    error,
    fetchTickets,
    fetchTicketById,
    createTicket,
    updateTicket,
  advanceTicketStatus,
    deleteTicket,
    refetch,
    clearTicket,
  };
}