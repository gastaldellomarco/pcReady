import type { ChangeEvent, CSSProperties } from 'react';
import type {
  TicketFilters,
  TicketPriority,
  TicketStatus,
} from '../../types/ticket';

type SelectOption<T extends string> = {
  value: T;
  label: string;
};

type StatusOption = SelectOption<TicketStatus | 'all'>;
type PriorityOption = SelectOption<TicketPriority | 'all'>;
type AssigneeOption = SelectOption<string | 'all' | 'unassigned'>;
type ClientOption = SelectOption<string | 'all'>;

type TicketFiltersProps = {
  filters: TicketFilters;
  onChange: (next: TicketFilters) => void;
  statusOptions?: StatusOption[];
  priorityOptions?: PriorityOption[];
  assigneeOptions?: AssigneeOption[];
  clientOptions?: ClientOption[];
  onReset?: () => void;
};

const defaultStatusOptions: StatusOption[] = [
  { value: 'all', label: 'Tutti gli stati' },
  { value: 'pending', label: 'Pending' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'testing', label: 'Testing' },
  { value: 'ready', label: 'Ready' },
];

const defaultPriorityOptions: PriorityOption[] = [
  { value: 'all', label: 'Tutte le priorità' },
  { value: 'high', label: 'High' },
  { value: 'med', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const defaultAssigneeOptions: AssigneeOption[] = [
  { value: 'all', label: 'Tutti gli assegnatari' },
  { value: 'unassigned', label: 'Non assegnato' },
];

const defaultClientOptions: ClientOption[] = [
  { value: 'all', label: 'Tutti i clienti' },
];

function normalizeTextValue(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeSelectValue<T extends string>(value: T | ''): T | undefined {
  if (value === '') {
    return undefined;
  }

  return value;
}

export function TicketFiltersComponent({
  filters,
  onChange,
  statusOptions = defaultStatusOptions,
  priorityOptions = defaultPriorityOptions,
  assigneeOptions = defaultAssigneeOptions,
  clientOptions = defaultClientOptions,
  onReset,
}: TicketFiltersProps): JSX.Element {
  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onChange({
      ...filters,
      search: normalizeTextValue(event.target.value),
    });
  };

  const handleStatusChange = (
    event: ChangeEvent<HTMLSelectElement>
  ): void => {
    onChange({
      ...filters,
      status: normalizeSelectValue<TicketStatus | 'all'>(event.target.value as TicketStatus | 'all' | ''),
    });
  };

  const handlePriorityChange = (
    event: ChangeEvent<HTMLSelectElement>
  ): void => {
    onChange({
      ...filters,
      priority: normalizeSelectValue<TicketPriority | 'all'>(
        event.target.value as TicketPriority | 'all' | ''
      ),
    });
  };

  const handleAssigneeChange = (
    event: ChangeEvent<HTMLSelectElement>
  ): void => {
    onChange({
      ...filters,
      assigned_to: normalizeSelectValue<string | 'all' | 'unassigned'>(
        event.target.value as string | 'all' | 'unassigned' | ''
      ),
    });
  };

  const handleClientChange = (
    event: ChangeEvent<HTMLSelectElement>
  ): void => {
    onChange({
      ...filters,
      client: normalizeSelectValue<string | 'all'>(
        event.target.value as string | 'all' | ''
      ),
    });
  };

  const handleReset = (): void => {
    if (onReset) {
      onReset();
      return;
    }

    onChange({});
  };

  return (
    <section
      className="ticket-filters"
      aria-label="Filtri ticket"
      style={containerStyle}
    >
      <div className="ticket-filters__grid" style={gridStyle}>
        <div className="ticket-filters__field" style={fieldStyle}>
          <label htmlFor="ticket-search" style={labelStyle}>
            Cerca
          </label>
          <input
            id="ticket-search"
            name="search"
            type="text"
            value={filters.search ?? ''}
            onChange={handleSearchChange}
            placeholder="Cerca ticket, seriale, requester..."
            style={inputStyle}
          />
        </div>

        <div className="ticket-filters__field" style={fieldStyle}>
          <label htmlFor="ticket-status" style={labelStyle}>
            Stato
          </label>
          <select
            id="ticket-status"
            name="status"
            value={filters.status ?? 'all'}
            onChange={handleStatusChange}
            style={selectStyle}
          >
            {statusOptions.map((option) => (
              <option key={`status-${option.value}`} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="ticket-filters__field" style={fieldStyle}>
          <label htmlFor="ticket-priority" style={labelStyle}>
            Priorità
          </label>
          <select
            id="ticket-priority"
            name="priority"
            value={filters.priority ?? 'all'}
            onChange={handlePriorityChange}
            style={selectStyle}
          >
            {priorityOptions.map((option) => (
              <option key={`priority-${option.value}`} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="ticket-filters__field" style={fieldStyle}>
          <label htmlFor="ticket-assignee" style={labelStyle}>
            Assegnatario
          </label>
          <select
            id="ticket-assignee"
            name="assigned_to"
            value={filters.assigned_to ?? 'all'}
            onChange={handleAssigneeChange}
            style={selectStyle}
          >
            {assigneeOptions.map((option) => (
              <option key={`assignee-${option.value}`} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="ticket-filters__field" style={fieldStyle}>
          <label htmlFor="ticket-client" style={labelStyle}>
            Cliente
          </label>
          <select
            id="ticket-client"
            name="client"
            value={filters.client ?? 'all'}
            onChange={handleClientChange}
            style={selectStyle}
          >
            {clientOptions.map((option) => (
              <option key={`client-${option.value}`} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="ticket-filters__actions" style={actionsStyle}>
          <button
            type="button"
            onClick={handleReset}
            style={resetButtonStyle}
          >
            Reset filtri
          </button>
        </div>
      </div>
    </section>
  );
}

export default TicketFiltersComponent;

const containerStyle: CSSProperties = {
  border: '1px solid #E5E7EB',
  borderRadius: '12px',
  backgroundColor: '#FFFFFF',
  padding: '16px',
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '12px',
  alignItems: 'end',
};

const fieldStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
};

const labelStyle: CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 600,
  color: '#374151',
};

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: '40px',
  padding: '10px 12px',
  border: '1px solid #D1D5DB',
  borderRadius: '8px',
  fontSize: '0.95rem',
  color: '#111827',
  backgroundColor: '#FFFFFF',
};

const selectStyle: CSSProperties = {
  width: '100%',
  minHeight: '40px',
  padding: '10px 12px',
  border: '1px solid #D1D5DB',
  borderRadius: '8px',
  fontSize: '0.95rem',
  color: '#111827',
  backgroundColor: '#FFFFFF',
};

const actionsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'end',
};

const resetButtonStyle: CSSProperties = {
  minHeight: '40px',
  padding: '10px 14px',
  border: '1px solid #D1D5DB',
  borderRadius: '8px',
  backgroundColor: '#F9FAFB',
  color: '#111827',
  fontSize: '0.95rem',
  fontWeight: 600,
  cursor: 'pointer',
};