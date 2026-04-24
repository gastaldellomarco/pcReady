export type TicketStatus = 'pending' | 'in-progress' | 'testing' | 'ready';

export type TicketPriority = 'high' | 'med' | 'low';

export type TicketStatusLabelMap = Record<TicketStatus, string>;
export type TicketPriorityLabelMap = Record<TicketPriority, string>;

export type TicketStatusColor = {
  bg: string;
  text: string;
  border: string;
};

export type TicketPriorityColor = {
  bg: string;
  text: string;
  border: string;
};

export type TicketStatusColorMap = Record<TicketStatus, TicketStatusColor>;
export type TicketPriorityColorMap = Record<TicketPriority, TicketPriorityColor>;

export const TICKET_STATUS_LABELS: TicketStatusLabelMap = {
  pending: 'Pending',
  'in-progress': 'In Progress',
  testing: 'Testing',
  ready: 'Ready',
};

export const TICKET_PRIORITY_LABELS: TicketPriorityLabelMap = {
  high: 'High',
  med: 'Medium',
  low: 'Low',
};

export const TICKET_STATUS_COLORS: TicketStatusColorMap = {
  pending: {
    bg: '#FEF3C7',
    text: '#92400E',
    border: '#FCD34D',
  },
  'in-progress': {
    bg: '#DBEAFE',
    text: '#1E40AF',
    border: '#93C5FD',
  },
  testing: {
    bg: '#EDE9FE',
    text: '#6D28D9',
    border: '#C4B5FD',
  },
  ready: {
    bg: '#D1FAE5',
    text: '#065F46',
    border: '#6EE7B7',
  },
};

export const TICKET_PRIORITY_COLORS: TicketPriorityColorMap = {
  high: {
    bg: '#FEE2E2',
    text: '#991B1B',
    border: '#FCA5A5',
  },
  med: {
    bg: '#FEF3C7',
    text: '#92400E',
    border: '#FCD34D',
  },
  low: {
    bg: '#DCFCE7',
    text: '#166534',
    border: '#86EFAC',
  },
};

export type TicketListItem = {
  id: string;
  client: string;
  model: string | null;
  serial: string | null;
  requester: string;
  end_user: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  assigned_to: string | null;
  os: string | null;
  software: string | null;
  created_at: string;
  updated_at: string;
};

export type TicketComment = {
  id: string;
  ticket_id: string;
  author_id: string;
  body: string;
  is_internal: boolean;
  created_at: string;
  updated_at: string;
};

export type TicketDetail = {
  id: string;
  client: string;
  model: string | null;
  serial: string | null;
  requester: string;
  end_user: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  assigned_to: string | null;
  os: string | null;
  software: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  comments: TicketComment[];
};

export type CreateTicketInput = {
  client: string;
  model?: string | null;
  serial?: string | null;
  requester: string;
  end_user?: string | null;
  priority: TicketPriority;
  status?: TicketStatus;
  assigned_to?: string | null;
  os?: string | null;
  software?: string | null;
  notes?: string | null;
};

export type UpdateTicketInput = Partial<{
  client: string;
  model: string | null;
  serial: string | null;
  requester: string;
  end_user: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  assigned_to: string | null;
  os: string | null;
  software: string | null;
  notes: string | null;
}>;

export type TicketFilters = {
  search?: string;
  client?: string;
  status?: TicketStatus | 'all';
  priority?: TicketPriority | 'all';
  assigned_to?: string | 'unassigned' | 'all';
  created_from?: string;
  created_to?: string;
  updated_from?: string;
  updated_to?: string;
};