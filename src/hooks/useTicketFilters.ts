import { useCallback, useMemo, useState } from 'react';
import type { TicketFilters, TicketListItem } from '../types/ticket';

type SelectOption = { value: string; label: string };

function matchesSearch(ticket: TicketListItem, search?: string): boolean {
  if (!search) return true;

  const term = search.trim().toLowerCase();
  if (!term) return true;

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
  if (!matchesSearch(ticket, filters.search)) return false;

  if (filters.status && filters.status !== 'all' && ticket.status !== filters.status) {
    return false;
  }

  if (filters.priority && filters.priority !== 'all' && ticket.priority !== filters.priority) {
    return false;
  }

  if (filters.client && filters.client !== 'all' && ticket.client !== filters.client) {
    return false;
  }

  if (filters.assigned_to && filters.assigned_to !== 'all') {
    if (filters.assigned_to === 'unassigned') {
      if (ticket.assigned_to) return false;
    } else if (ticket.assigned_to !== filters.assigned_to) {
      return false;
    }
  }

  return true;
}

export function useTicketFilters(tickets: TicketListItem[]) {
  const [filters, setFilters] = useState<TicketFilters>({});

  const filteredTickets = useMemo(
    () => tickets.filter((t) => matchesFilters(t, filters)),
    [tickets, filters]
  );

  const clientOptions = useMemo<SelectOption[]>(() => {
    return [...new Set(tickets.map((t) => t.client).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b as string))
      .map((c) => ({ value: c as string, label: c as string }));
  }, [tickets]);

  const assigneeOptions = useMemo<SelectOption[]>(() => {
    return [...new Set(tickets.map((t) => t.assigned_to).filter(Boolean) as string[])]
      .sort((a, b) => a.localeCompare(b))
      .map((a) => ({ value: a, label: a }));
  }, [tickets]);

  const handleFiltersChange = useCallback((next: TicketFilters) => setFilters(next), []);
  const handleFiltersReset = useCallback(() => setFilters({}), []);

  return { filters, filteredTickets, clientOptions, assigneeOptions, handleFiltersChange, handleFiltersReset };
}
