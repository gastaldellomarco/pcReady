import { useEffect, type CSSProperties, type MouseEvent } from 'react';
import type {
  TicketDetail,
  TicketPriority,
  TicketStatus,
} from '../../types/ticket';

type TicketDetailDrawerProps = {
  open: boolean;
  ticket: TicketDetail | null;
  canEdit?: boolean;
  onClose: () => void;
  onEdit?: (ticket: TicketDetail) => void;
  onDelete?: (ticketId: string) => void;
  onAdvanceStatus?: (ticketId: string) => void;
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

const STATUS_STYLES: Record<TicketStatus, CSSProperties> = {
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

const PRIORITY_STYLES: Record<TicketPriority, CSSProperties> = {
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
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function getDisplayValue(value: string | null | undefined): string {
  if (!value || value.trim().length === 0) {
    return '—';
  }

  return value;
}

function getNextStatusLabel(status: TicketStatus): string | null {
  switch (status) {
    case 'pending':
      return 'Start';
    case 'in-progress':
      return 'Move to testing';
    case 'testing':
      return 'Mark as ready';
    case 'ready':
      return null;
    default:
      return null;
  }
}

function MetadataItem({
  label,
  value,
}: {
  label: string;
  value: string;
}): JSX.Element {
  return (
    <div style={metadataItemStyle}>
      <dt style={metadataLabelStyle}>{label}</dt>
      <dd style={metadataValueStyle}>{value}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: TicketStatus }): JSX.Element {
  return (
    <span
      style={{
        ...badgeBaseStyle,
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
      style={{
        ...badgeBaseStyle,
        ...PRIORITY_STYLES[priority],
      }}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

export function TicketDetailDrawer({
  open,
  ticket,
  canEdit = false,
  onClose,
  onEdit,
  onDelete,
  onAdvanceStatus,
}: TicketDetailDrawerProps): JSX.Element | null {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>): void => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const handleEdit = (): void => {
    if (ticket && onEdit) {
      onEdit(ticket);
    }
  };

  const handleDelete = (): void => {
    if (ticket && onDelete) {
      onDelete(ticket.id);
    }
  };

  const handleAdvanceStatus = (): void => {
    if (ticket && onAdvanceStatus) {
      onAdvanceStatus(ticket.id);
    }
  };

  const showEditButton = canEdit && Boolean(ticket) && typeof onEdit === 'function';
  const showDeleteButton =
    canEdit && Boolean(ticket) && typeof onDelete === 'function';
  const nextStatusLabel =
    ticket && typeof onAdvanceStatus === 'function'
      ? getNextStatusLabel(ticket.status)
      : null;
  const showAdvanceButton =
    canEdit && Boolean(ticket) && Boolean(nextStatusLabel);

  return (
    <div
      style={backdropStyle}
      onClick={handleBackdropClick}
      aria-hidden={false}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="ticket-detail-drawer-title"
        style={drawerStyle}
      >
        <div style={headerStyle}>
          <div style={headerTextStyle}>
            <p style={eyebrowStyle}>Ticket detail</p>
            <h2 id="ticket-detail-drawer-title" style={titleStyle}>
              {ticket ? ticket.id : 'Ticket'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi dettaglio ticket"
            style={closeButtonStyle}
          >
            ×
          </button>
        </div>

        {!ticket ? (
          <div
            style={emptyStateStyle}
            role="status"
            aria-live="polite"
          >
            Nessun ticket selezionato.
          </div>
        ) : (
          <>
            <div style={contentStyle}>
              <section style={sectionStyle} aria-labelledby="ticket-detail-summary">
                <h3 id="ticket-detail-summary" style={sectionTitleStyle}>
                  Summary
                </h3>

                <div style={summaryCardStyle}>
                  <div style={summaryTopStyle}>
                    <span style={ticketIdStyle}>{ticket.id}</span>
                    <div style={badgeGroupStyle}>
                      <StatusBadge status={ticket.status} />
                      <PriorityBadge priority={ticket.priority} />
                    </div>
                  </div>

                  <p style={summaryMetaStyle}>
                    Creato il {formatDate(ticket.created_at)} · Aggiornato il{' '}
                    {formatDate(ticket.updated_at)}
                  </p>
                </div>
              </section>

              <section style={sectionStyle} aria-labelledby="ticket-detail-metadata">
                <h3 id="ticket-detail-metadata" style={sectionTitleStyle}>
                  Metadata
                </h3>

                <dl style={metadataGridStyle}>
                  <MetadataItem label="Serial" value={getDisplayValue(ticket.serial)} />
                  <MetadataItem label="Model" value={getDisplayValue(ticket.model)} />
                  <MetadataItem
                    label="Requester"
                    value={getDisplayValue(ticket.requester)}
                  />
                  <MetadataItem
                    label="End user"
                    value={getDisplayValue(ticket.end_user)}
                  />
                  <MetadataItem label="Client" value={getDisplayValue(ticket.client)} />
                  <MetadataItem
                    label="Assigned to"
                    value={getDisplayValue(ticket.assigned_to)}
                  />
                  <MetadataItem label="OS" value={getDisplayValue(ticket.os)} />
                  <MetadataItem
                    label="Software"
                    value={getDisplayValue(ticket.software)}
                  />
                </dl>
              </section>

              <section style={sectionStyle} aria-labelledby="ticket-detail-notes">
                <h3 id="ticket-detail-notes" style={sectionTitleStyle}>
                  Notes
                </h3>

                <div style={notesBoxStyle}>
                  {getDisplayValue(ticket.notes)}
                </div>
              </section>
            </div>

            <div style={footerStyle}>
              <div style={footerActionsStyle}>
                {showAdvanceButton ? (
                  <button
                    type="button"
                    onClick={handleAdvanceStatus}
                    style={primaryButtonStyle}
                  >
                    {nextStatusLabel}
                  </button>
                ) : null}

                {showEditButton ? (
                  <button
                    type="button"
                    onClick={handleEdit}
                    style={secondaryButtonStyle}
                  >
                    Edit
                  </button>
                ) : null}

                {showDeleteButton ? (
                  <button
                    type="button"
                    onClick={handleDelete}
                    style={dangerButtonStyle}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

export default TicketDetailDrawer;

const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  backgroundColor: 'rgba(15, 23, 42, 0.4)',
  display: 'flex',
  justifyContent: 'flex-end',
};

const drawerStyle: CSSProperties = {
  width: '100%',
  maxWidth: '520px',
  height: '100%',
  backgroundColor: '#FFFFFF',
  boxShadow: '-8px 0 32px rgba(15, 23, 42, 0.16)',
  display: 'flex',
  flexDirection: 'column',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '16px',
  padding: '20px 20px 16px',
  borderBottom: '1px solid #E5E7EB',
};

const headerTextStyle: CSSProperties = {
  minWidth: 0,
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.75rem',
  fontWeight: 600,
  color: '#6B7280',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};

const titleStyle: CSSProperties = {
  margin: '6px 0 0',
  fontSize: '1.375rem',
  fontWeight: 700,
  color: '#111827',
  lineHeight: 1.2,
};

const closeButtonStyle: CSSProperties = {
  width: '36px',
  height: '36px',
  border: '1px solid #D1D5DB',
  borderRadius: '8px',
  backgroundColor: '#FFFFFF',
  color: '#111827',
  fontSize: '1.25rem',
  lineHeight: 1,
  cursor: 'pointer',
  flexShrink: 0,
};

const contentStyle: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '20px',
  display: 'flex',
  flexDirection: 'column',
  gap: '20px',
};

const sectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.95rem',
  fontWeight: 700,
  color: '#111827',
};

const summaryCardStyle: CSSProperties = {
  border: '1px solid #E5E7EB',
  borderRadius: '12px',
  backgroundColor: '#F9FAFB',
  padding: '16px',
};

const summaryTopStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '12px',
  flexWrap: 'wrap',
};

const ticketIdStyle: CSSProperties = {
  fontSize: '1rem',
  fontWeight: 700,
  color: '#111827',
};

const badgeGroupStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flexWrap: 'wrap',
};

const badgeBaseStyle: CSSProperties = {
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

const summaryMetaStyle: CSSProperties = {
  margin: '12px 0 0',
  fontSize: '0.875rem',
  color: '#6B7280',
  lineHeight: 1.5,
};

const metadataGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '12px',
  margin: 0,
};

const metadataItemStyle: CSSProperties = {
  margin: 0,
  padding: '12px',
  border: '1px solid #E5E7EB',
  borderRadius: '10px',
  backgroundColor: '#FFFFFF',
};

const metadataLabelStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.8rem',
  fontWeight: 600,
  color: '#6B7280',
};

const metadataValueStyle: CSSProperties = {
  margin: '6px 0 0',
  fontSize: '0.95rem',
  color: '#111827',
  lineHeight: 1.4,
  wordBreak: 'break-word',
};

const notesBoxStyle: CSSProperties = {
  minHeight: '120px',
  padding: '14px',
  border: '1px solid #E5E7EB',
  borderRadius: '12px',
  backgroundColor: '#FFFFFF',
  color: '#111827',
  fontSize: '0.95rem',
  lineHeight: 1.6,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

const footerStyle: CSSProperties = {
  borderTop: '1px solid #E5E7EB',
  padding: '16px 20px',
  backgroundColor: '#FFFFFF',
};

const footerActionsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: '10px',
  flexWrap: 'wrap',
};

const primaryButtonStyle: CSSProperties = {
  minHeight: '40px',
  padding: '10px 14px',
  border: '1px solid #2563EB',
  borderRadius: '8px',
  backgroundColor: '#2563EB',
  color: '#FFFFFF',
  fontSize: '0.9rem',
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
  fontSize: '0.9rem',
  fontWeight: 600,
  cursor: 'pointer',
};

const dangerButtonStyle: CSSProperties = {
  minHeight: '40px',
  padding: '10px 14px',
  border: '1px solid #DC2626',
  borderRadius: '8px',
  backgroundColor: '#FFFFFF',
  color: '#DC2626',
  fontSize: '0.9rem',
  fontWeight: 600,
  cursor: 'pointer',
};

const emptyStateStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '32px',
  color: '#6B7280',
  fontSize: '0.95rem',
  textAlign: 'center',
};