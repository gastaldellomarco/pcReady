import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import type {
  CreateTicketInput,
  TicketDetail,
  TicketPriority,
  UpdateTicketInput,
} from '../../types/ticket';

type SelectOption = {
  value: string;
  label: string;
};

type TicketFormValues = {
  model: string;
  serial: string;
  requester: string;
  end_user: string;
  client: string;
  priority: TicketPriority;
  assigned_to: string;
  os: string;
  software: string;
  notes: string;
};

type TicketFormErrors = Partial<Record<keyof TicketFormValues, string>>;

type TicketFormInitialValues = Partial<
  TicketDetail &
    CreateTicketInput &
    UpdateTicketInput & {
  // no client_id here; unify client as single field
    }
>;

type TicketFormModalProps = {
  open: boolean;
  mode: 'create' | 'edit';
  initialValues?: TicketFormInitialValues;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (values: CreateTicketInput | UpdateTicketInput) => Promise<void> | void;
  assigneeOptions: SelectOption[];
  clientOptions: SelectOption[];
};

const PRIORITY_OPTIONS: Array<{ value: TicketPriority; label: string }> = [
  { value: 'high', label: 'High' },
  { value: 'med', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

function getEmptyValues(): TicketFormValues {
  return {
    model: '',
    serial: '',
    requester: '',
    end_user: '',
    client: '',
    priority: 'med',
    assigned_to: '',
    os: '',
    software: '',
    notes: '',
  };
}

function normalizeString(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function mapInitialValues(initialValues?: TicketFormInitialValues): TicketFormValues {
  return {
    model: initialValues?.model ?? '',
    serial: initialValues?.serial ?? '',
    requester: initialValues?.requester ?? '',
    end_user: initialValues?.end_user ?? '',
  client: initialValues?.client ?? '',
    priority: initialValues?.priority ?? 'med',
    assigned_to: initialValues?.assigned_to ?? '',
    os: initialValues?.os ?? '',
    software: initialValues?.software ?? '',
    notes: initialValues?.notes ?? '',
  };
}

function validateValues(values: TicketFormValues): TicketFormErrors {
  const errors: TicketFormErrors = {};

  if (!normalizeString(values.requester)) {
    errors.requester = 'Requester obbligatorio.';
  }

  if (!normalizeString(values.client)) {
    errors.client = 'Cliente obbligatorio.';
  }

  return errors;
}

function hasErrors(errors: TicketFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function TicketFormModal({
  open,
  mode,
  initialValues,
  submitting = false,
  onClose,
  onSubmit,
  assigneeOptions,
  clientOptions,
}: TicketFormModalProps): JSX.Element | null {
  const [values, setValues] = useState<TicketFormValues>(getEmptyValues());
  const [errors, setErrors] = useState<TicketFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const title = mode === 'create' ? 'Nuovo ticket' : 'Modifica ticket';
  const submitLabel = mode === 'create' ? 'Crea ticket' : 'Salva modifiche';

  const resolvedClientOptions = useMemo(() => clientOptions, [clientOptions]);
  const resolvedAssigneeOptions = useMemo(() => assigneeOptions, [assigneeOptions]);

  const [clientMode, setClientMode] = useState<'select' | 'other'>('select');

  useEffect(() => {
    if (open) {
      const mapped = mapInitialValues(initialValues);
      setValues(mapped);
      // decide if clientMode should be 'other' when initial client is not in options
      const hasClientInOptions = resolvedClientOptions.some((o) => o.value === mapped.client);
      setClientMode(hasClientInOptions ? 'select' : 'other');
      setErrors({});
      return;
    }

    setValues(getEmptyValues());
    setClientMode('select');
    setErrors({});
  }, [open, initialValues, resolvedClientOptions]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleEscape = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape' && !submitting) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, onClose, submitting]);

  if (!open) {
    return null;
  }


  const handleFieldChange =
    (field: keyof TicketFormValues) =>
    (
      event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ): void => {
      const nextValue = event.target.value;

      setValues((current) => {
        const next: TicketFormValues = {
          ...current,
          [field]: nextValue,
        };

  return next;
      });

      setErrors((current) => {
        if (!current[field]) {
          return current;
        }

        const nextErrors = { ...current };
        delete nextErrors[field];
        return nextErrors;
      });
    };

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>): void => {
    if (event.target === event.currentTarget && !submitting) {
      onClose();
    }
  };

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape' && !submitting) {
      event.stopPropagation();
      onClose();
    }
  };

  const handleClose = (): void => {
    if (!submitting) {
      onClose();
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setFormError(null);

    const nextErrors = validateValues(values);
    setErrors(nextErrors);

    // Additional validation: when using select, ensure selected value exists in options
    if (clientMode === 'select') {
      const valid = resolvedClientOptions.some((o) => o.value === values.client);
      if (!valid) {
        setErrors((e) => ({ ...e, client: 'Seleziona un cliente valido o scegli Altro.' }));
        return;
      }
    }

    if (hasErrors(nextErrors)) {
      return;
    }

    const normalizedClient = normalizeString(values.client);

    const payloadBase = {
      model: normalizeString(values.model) ?? null,
      serial: normalizeString(values.serial) ?? null,
      requester: normalizeString(values.requester) ?? '',
      end_user: normalizeString(values.end_user) ?? null,
      priority: values.priority,
      assigned_to: normalizeString(values.assigned_to) ?? null,
      os: normalizeString(values.os) ?? null,
      software: normalizeString(values.software) ?? null,
      notes: normalizeString(values.notes) ?? null,
    };

    try {
      if (mode === 'create') {
        const createPayload: CreateTicketInput = {
          ...payloadBase,
          client: normalizedClient ?? '',
        };

        await onSubmit(createPayload);
        return;
      }

      const updatePayload: UpdateTicketInput = {
        ...payloadBase,
        client: normalizedClient ?? undefined,
      };

      await onSubmit(updatePayload);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore durante il salvataggio.';
      setFormError(message);
      return;
    }
  };

  return (
    <div
      className="ticket-form-modal__backdrop"
      style={backdropStyle}
      onClick={handleBackdropClick}
      aria-hidden={false}
    >
      <div
        className="ticket-form-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ticket-form-modal-title"
        style={modalStyle}
        onKeyDown={handleDialogKeyDown}
      >
        <div className="ticket-form-modal__header" style={headerStyle}>
          <div>
            <h2 id="ticket-form-modal-title" style={titleStyle}>
              {title}
            </h2>
            <p style={subtitleStyle}>
              {mode === 'create'
                ? 'Inserisci i dati principali del ticket.'
                : 'Aggiorna i dati del ticket selezionato.'}
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            aria-label="Chiudi modal ticket"
            style={closeButtonStyle}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="ticket-form-modal__body" style={bodyStyle}>
            <div style={gridStyle}>
              <div style={fieldStyle}>
                <label htmlFor="ticket-model" style={labelStyle}>
                  Model
                </label>
                <input
                  id="ticket-model"
                  name="model"
                  type="text"
                  value={values.model}
                  onChange={handleFieldChange('model')}
                  style={inputStyle}
                />
              </div>

              <div style={fieldStyle}>
                <label htmlFor="ticket-serial" style={labelStyle}>
                  Serial
                </label>
                <input
                  id="ticket-serial"
                  name="serial"
                  type="text"
                  value={values.serial}
                  onChange={handleFieldChange('serial')}
                  style={inputStyle}
                />
              </div>

              <div style={fieldStyle}>
                <label htmlFor="ticket-requester" style={labelStyle}>
                  Requester *
                </label>
                <input
                  id="ticket-requester"
                  name="requester"
                  type="text"
                  value={values.requester}
                  onChange={handleFieldChange('requester')}
                  aria-invalid={Boolean(errors.requester)}
                  aria-describedby={errors.requester ? 'ticket-requester-error' : undefined}
                  style={getFieldStyle(Boolean(errors.requester))}
                />
                {errors.requester ? (
                  <span id="ticket-requester-error" style={errorTextStyle}>
                    {errors.requester}
                  </span>
                ) : null}
              </div>

              <div style={fieldStyle}>
                <label htmlFor="ticket-end-user" style={labelStyle}>
                  End user
                </label>
                <input
                  id="ticket-end-user"
                  name="end_user"
                  type="text"
                  value={values.end_user}
                  onChange={handleFieldChange('end_user')}
                  style={inputStyle}
                />
              </div>

              <div style={fieldStyle}>
                <label htmlFor="ticket-client-select" style={labelStyle}>
                  Cliente
                </label>
                <select
                  id="ticket-client-select"
                  name="client"
                  value={clientMode === 'select' ? values.client : '__other__'}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '__other__') {
                      setClientMode('other');
                      setValues((cur) => ({ ...cur, client: '' }));
                    } else {
                      setClientMode('select');
                      setValues((cur) => ({ ...cur, client: v }));
                    }
                  }}
                  aria-invalid={Boolean(errors.client)}
                  style={getFieldStyle(Boolean(errors.client))}
                >
                  <option value="">Seleziona cliente</option>
                  {resolvedClientOptions.map((option) => (
                    <option key={`client-${option.value}`} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                  <option value="__other__">Altro (testo libero)</option>
                </select>

                {clientMode === 'other' ? (
                  <>
                    <input
                      id="ticket-client"
                      name="client"
                      type="text"
                      value={values.client}
                      onChange={handleFieldChange('client')}
                      aria-invalid={Boolean(errors.client)}
                      aria-describedby={errors.client ? 'ticket-client-error' : undefined}
                      placeholder="Inserisci nome cliente"
                      style={getFieldStyle(Boolean(errors.client))}
                    />
                    {errors.client ? (
                      <span id="ticket-client-error" style={errorTextStyle}>
                        {errors.client}
                      </span>
                    ) : null}
                  </>
                ) : null}
              </div>

              <div style={fieldStyle}>
                <label htmlFor="ticket-priority" style={labelStyle}>
                  Priority
                </label>
                <select
                  id="ticket-priority"
                  name="priority"
                  value={values.priority}
                  onChange={handleFieldChange('priority')}
                  style={inputStyle}
                >
                  {PRIORITY_OPTIONS.map((option) => (
                    <option key={`priority-${option.value}`} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={fieldStyle}>
                <label htmlFor="ticket-assigned-to" style={labelStyle}>
                  Assigned to
                </label>
                <select
                  id="ticket-assigned-to"
                  name="assigned_to"
                  value={values.assigned_to}
                  onChange={handleFieldChange('assigned_to')}
                  style={inputStyle}
                >
                  <option value="">Non assegnato</option>
                  {resolvedAssigneeOptions.map((option) => (
                    <option key={`assignee-${option.value}`} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={fieldStyle}>
                <label htmlFor="ticket-os" style={labelStyle}>
                  OS
                </label>
                <input
                  id="ticket-os"
                  name="os"
                  type="text"
                  value={values.os}
                  onChange={handleFieldChange('os')}
                  style={inputStyle}
                />
              </div>

              <div style={fieldStyle}>
                <label htmlFor="ticket-software" style={labelStyle}>
                  Software
                </label>
                <input
                  id="ticket-software"
                  name="software"
                  type="text"
                  value={values.software}
                  onChange={handleFieldChange('software')}
                  style={inputStyle}
                />
              </div>

              <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
                <label htmlFor="ticket-notes" style={labelStyle}>
                  Notes
                </label>
                <textarea
                  id="ticket-notes"
                  name="notes"
                  value={values.notes}
                  onChange={handleFieldChange('notes')}
                  rows={5}
                  style={textareaStyle}
                />
              </div>
            </div>
          </div>

          <div className="ticket-form-modal__footer" style={footerStyle}>
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              style={secondaryButtonStyle}
            >
              Annulla
            </button>

            <button
              type="submit"
              disabled={submitting}
              style={primaryButtonStyle}
            >
              {submitting ? 'Salvataggio...' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TicketFormModal;

const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
  backgroundColor: 'rgba(15, 23, 42, 0.55)',
};

const modalStyle: CSSProperties = {
  width: '100%',
  maxWidth: '860px',
  maxHeight: '90vh',
  overflow: 'hidden',
  borderRadius: '16px',
  backgroundColor: '#FFFFFF',
  boxShadow: '0 24px 60px rgba(15, 23, 42, 0.24)',
  display: 'flex',
  flexDirection: 'column',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '16px',
  padding: '20px 24px',
  borderBottom: '1px solid #E5E7EB',
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: '1.25rem',
  fontWeight: 700,
  color: '#111827',
};

const subtitleStyle: CSSProperties = {
  margin: '6px 0 0',
  fontSize: '0.95rem',
  color: '#6B7280',
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
};

const bodyStyle: CSSProperties = {
  padding: '24px',
  overflowY: 'auto',
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '16px',
};

const fieldStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
};

const labelStyle: CSSProperties = {
  fontSize: '0.9rem',
  fontWeight: 600,
  color: '#374151',
};

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: '42px',
  padding: '10px 12px',
  border: '1px solid #D1D5DB',
  borderRadius: '10px',
  backgroundColor: '#FFFFFF',
  color: '#111827',
  fontSize: '0.95rem',
};

const textareaStyle: CSSProperties = {
  width: '100%',
  minHeight: '120px',
  padding: '10px 12px',
  border: '1px solid #D1D5DB',
  borderRadius: '10px',
  backgroundColor: '#FFFFFF',
  color: '#111827',
  fontSize: '0.95rem',
  resize: 'vertical',
};

const footerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '12px',
  padding: '20px 24px',
  borderTop: '1px solid #E5E7EB',
};

const primaryButtonStyle: CSSProperties = {
  minHeight: '42px',
  padding: '10px 16px',
  border: '1px solid #2563EB',
  borderRadius: '10px',
  backgroundColor: '#2563EB',
  color: '#FFFFFF',
  fontSize: '0.95rem',
  fontWeight: 600,
  cursor: 'pointer',
};

const secondaryButtonStyle: CSSProperties = {
  minHeight: '42px',
  padding: '10px 16px',
  border: '1px solid #D1D5DB',
  borderRadius: '10px',
  backgroundColor: '#FFFFFF',
  color: '#111827',
  fontSize: '0.95rem',
  fontWeight: 600,
  cursor: 'pointer',
};

const errorTextStyle: CSSProperties = {
  fontSize: '0.85rem',
  color: '#DC2626',
};

function getFieldStyle(hasError: boolean): CSSProperties {
  return {
    ...inputStyle,
    borderColor: hasError ? '#DC2626' : '#D1D5DB',
  };
}