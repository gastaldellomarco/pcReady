import type { KeyboardEvent, MouseEvent } from 'react';
import type {
  TicketListItem,
  TicketPriority,
  TicketStatus,
} from '../../types/ticket';

type TicketTableProps = {
  tickets: TicketListItem[];
  loading?: boolean;
  canEdit?: boolean;
  onRowClick?: (ticketId: string) => void;
  onAdvanceStatus?: (ticketId: string) => void;
  onDelete?: (ticketId: string) => void;
};

const STATUS_LABELS: Record<TicketStatus, string> = {
  pending: 'Pending',
  'in-progress': 'In Progress',
  testing: 'Testing',
  ready: 'Ready',
};

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  high: 'High',
  med: 'Medium',
  low: 'Low',
};

const STATUS_STYLES: Record<TicketStatus, React.CSSProperties> = {
  pending: {
    backgroundColor: '#FEF3C7',
    color: '#92400E',
    borderColor: '#FCD34D',
  },
  'in-progress': {
    backgroundColor: '#DBEAFE',
    color: '#1D4ED8',
    borderColor: '#93C5FD',
  },
  testing: {
    backgroundColor: '#EDE9FE',
    color: '#6D28D9',
    borderColor: '#C4B5FD',
  },
  ready: {
    backgroundColor: '#DCFCE7',
    color: '#166534',
    borderColor: '#86EFAC',
  },
};

const PRIORITY_STYLES: Record<TicketPriority, React.CSSProperties> = {
  high: {
    backgroundColor: '#FEE2E2',
    color: '#991B1B',
    borderColor: '#FCA5A5',
  },
  med: {
    backgroundColor: '#FEF3C7',
    color: '#92400E',
    borderColor: '#FCD34D',
  },
  low: {
    backgroundColor: '#DCFCE7',
    color: '#166534',
    borderColor: '#86EFAC',
  },
};

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('it-IT', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function getNextStatusLabel(status: TicketStatus): string | null {
  switch (status) {
    case 'pending':
      return 'Start';
    case 'in-progress':
      return 'Test';
    case 'testing':
      return 'Ready';
    case 'ready':
      return null;
    default:
      return null;
  }
}

function StatusBadge({ status }: { status: TicketStatus }): JSX.Element {
  return (
    <span
      className="ticket-badge ticket-badge--status"
      style={{
        ...baseBadgeStyle,
        ...STATUS_STYLES[status],
      }}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: TicketPriority }): JSX.Element {
  return (
    <span
      className="ticket-badge ticket-badge--priority"
      style={{
        ...baseBadgeStyle,
        ...PRIORITY_STYLES[priority],
      }}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

function EmptyState(): JSX.Element {
  return (
    <div
      className="ticket-table__empty"
      role="status"
      aria-live="polite"
      style={emptyStateStyle}
    >
      Nessun ticket trovato.
    </div>
  );
}

function LoadingState(): JSX.Element {
  return (
    <div
      className="ticket-table__loading"
      role="status"
      aria-live="polite"
      style={emptyStateStyle}
    >
      Caricamento ticket...
    </div>
  );
}

function TicketRow({
  ticket,
  canEdit = false,
  onRowClick,
  onAdvanceStatus,
  onDelete,
}: {
  ticket: TicketListItem;
  canEdit?: boolean;
  onRowClick?: (ticketId: string) => void;
  onAdvanceStatus?: (ticketId: string) => void;
  onDelete?: (ticketId: string) => void;
}): JSX.Element {
  const isClickable = typeof onRowClick === 'function';
  const nextStatusLabel = getNextStatusLabel(ticket.status);
  const showAdvanceAction = canEdit && typeof onAdvanceStatus === 'function' && nextStatusLabel;
  const showDeleteAction = canEdit && typeof onDelete === 'function';

  const handleRowClick = (): void => {
    if (isClickable) {
      onRowClick(ticket.id);
    }
  };

  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>): void => {
    if (!isClickable) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onRowClick(ticket.id);
    }
  };

  const handleAdvanceClick = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
    onAdvanceStatus?.(ticket.id);
  };

  const handleDeleteClick = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
    onDelete?.(ticket.id);
  };

  return (
    <tr
      className="ticket-table__row"
      onClick={isClickable ? handleRowClick : undefined}
      onKeyDown={isClickable ? handleRowKeyDown : undefined}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={isClickable ? `Apri ticket ${ticket.id}` : undefined}
      style={{
        ...rowStyle,
        ...(isClickable ? clickableRowStyle : {}),
      }}
    >
      <td style={cellStyle}>
        <span style={idTextStyle}>{ticket.id}</span>
      </td>
      <td style={cellStyle}>{ticket.model ?? '—'}</td>
      <td style={cellStyle}>{ticket.serial ?? '—'}</td>
      <td style={cellStyle}>{ticket.requester}</td>
      <td style={cellStyle}>{ticket.client}</td>
      <td style={cellStyle}>
        <PriorityBadge priority={ticket.priority} />
      </td>
      <td style={cellStyle}>
        <StatusBadge status={ticket.status} />
      </td>
      <td style={cellStyle}>{ticket.assigned_to ?? 'Unassigned'}</td>
      <td style={cellStyle}>{formatDate(ticket.created_at)}</td>
      <td style={{ ...cellStyle, ...actionsCellStyle }}>
        <div style={actionsWrapperStyle}>
          {showAdvanceAction ? (
            <button
              type="button"
              className="ticket-table__action ticket-table__action--advance"
              onClick={handleAdvanceClick}
              aria-label={`Avanza stato ticket ${ticket.id}`}
              style={actionButtonPrimaryStyle}
            >
              {nextStatusLabel}
            </button>
          ) : null}

          {showDeleteAction ? (
            <button
              type="button"
              className="ticket-table__action ticket-table__action--delete"
              onClick={handleDeleteClick}
              aria-label={`Elimina ticket ${ticket.id}`}
              style={actionButtonDangerStyle}
            >
              Delete
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

export function TicketTable({
  tickets,
  loading = false,
  canEdit = false,
  onRowClick,
  onAdvanceStatus,
  onDelete,
}: TicketTableProps): JSX.Element {
  if (loading) {
    return <LoadingState />;
  }

  if (tickets.length === 0) {
    return <EmptyState />;
  }

  return (
    <div
      className="ticket-table"
      style={tableContainerStyle}
    >
      <div style={tableScrollStyle}>
        <table style={tableStyle}>
          <caption style={captionStyle}>Elenco ticket PCReady</caption>
          <thead>
            <tr>
              <th scope="col" style={headCellStyle}>Ticket ID</th>
              <th scope="col" style={headCellStyle}>Model</th>
              <th scope="col" style={headCellStyle}>Serial</th>
              <th scope="col" style={headCellStyle}>Requester</th>
              <th scope="col" style={headCellStyle}>Client</th>
              <th scope="col" style={headCellStyle}>Priority</th>
              <th scope="col" style={headCellStyle}>Status</th>
              <th scope="col" style={headCellStyle}>Assignee</th>
              <th scope="col" style={headCellStyle}>Created</th>
              <th scope="col" style={headCellStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <TicketRow
                key={ticket.id}
                ticket={ticket}
                canEdit={canEdit}
                onRowClick={onRowClick}
                onAdvanceStatus={onAdvanceStatus}
                onDelete={onDelete}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default TicketTable;

const tableContainerStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #E5E7EB',
  borderRadius: '12px',
  backgroundColor: '#FFFFFF',
  overflow: 'hidden',
};

const tableScrollStyle: React.CSSProperties = {
  width: '100%',
  overflowX: 'auto',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  minWidth: '980px',
  backgroundColor: '#FFFFFF',
};

const captionStyle: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

const headCellStyle: React.CSSProperties = {
  padding: '12px 16px',
  textAlign: 'left',
  fontSize: '0.875rem',
  fontWeight: 600,
  color: '#374151',
  backgroundColor: '#F9FAFB',
  borderBottom: '1px solid #E5E7EB',
  whiteSpace: 'nowrap',
};

const cellStyle: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: '0.925rem',
  color: '#111827',
  borderBottom: '1px solid #E5E7EB',
  verticalAlign: 'middle',
  whiteSpace: 'nowrap',
};

const actionsCellStyle: React.CSSProperties = {
  width: '1%',
};

const rowStyle: React.CSSProperties = {
  outline: 'none',
};

const clickableRowStyle: React.CSSProperties = {
  cursor: 'pointer',
};

const idTextStyle: React.CSSProperties = {
  fontWeight: 600,
  color: '#111827',
};

const baseBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '72px',
  padding: '4px 10px',
  borderRadius: '999px',
  border: '1px solid transparent',
  fontSize: '0.75rem',
  fontWeight: 600,
  lineHeight: 1.2,
};

const actionsWrapperStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const actionButtonPrimaryStyle: React.CSSProperties = {
  border: '1px solid #2563EB',
  backgroundColor: '#2563EB',
  color: '#FFFFFF',
  borderRadius: '8px',
  padding: '6px 10px',
  fontSize: '0.8rem',
  fontWeight: 600,
  cursor: 'pointer',
};

const actionButtonDangerStyle: React.CSSProperties = {
  border: '1px solid #DC2626',
  backgroundColor: '#FFFFFF',
  color: '#DC2626',
  borderRadius: '8px',
  padding: '6px 10px',
  fontSize: '0.8rem',
  fontWeight: 600,
  cursor: 'pointer',
};

const emptyStateStyle: React.CSSProperties = {
  padding: '24px',
  border: '1px solid #E5E7EB',
  borderRadius: '12px',
  backgroundColor: '#FFFFFF',
  color: '#6B7280',
  fontSize: '0.95rem',
};