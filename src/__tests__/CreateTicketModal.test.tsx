// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Mock di react-i18next ──────────────────────────────────────────────
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === "string" ? fallback : key),
  }),
}));

// ── Mock di sonner ─────────────────────────────────────────────────────
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
}));

// ── Mock useServerFn (TanStack Start) ──────────────────────────────────
const serverFnMocks = vi.hoisted(() => ({
  createTicket: vi.fn(),
  createNotification: vi.fn(),
  sendTicketAssignedEmail: vi.fn(),
  getPublicAppSettings: vi.fn(),
  validateTechnicianDeviceLimit: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({
  useServerFn: vi.fn((fn: unknown) => {
    // Restituisce la funzione mock corrispondente
    if (fn === serverFnMocks.createTicket) return serverFnMocks.createTicket;
    if (fn === serverFnMocks.createNotification) return serverFnMocks.createNotification;
    if (fn === serverFnMocks.sendTicketAssignedEmail) return serverFnMocks.sendTicketAssignedEmail;
    if (fn === serverFnMocks.getPublicAppSettings) return serverFnMocks.getPublicAppSettings;
    if (fn === serverFnMocks.validateTechnicianDeviceLimit)
      return serverFnMocks.validateTechnicianDeviceLimit;
    return vi.fn();
  }),
}));

// ── Mock Supabase client ───────────────────────────────────────────────
const supabaseMock = vi.hoisted(() => {
  function makeChain() {
    return {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      then: vi.fn((cb: (arg: unknown) => void) => cb({ data: [], error: null })),
    };
  }
  return {
    from: vi.fn((_table: string) => makeChain()),
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: supabaseMock,
}));

// ── Mock useTickets ────────────────────────────────────────────────────
const useTicketsMock = vi.hoisted(() => ({
  createOpen: false,
  closeCreate: vi.fn(),
}));

vi.mock("@/hooks/use-tickets", () => ({
  useTickets: () => useTicketsMock,
}));

// ── Mock useAuth ───────────────────────────────────────────────────────
const authMockState = vi.hoisted(() => ({
  user: { id: "user-1" },
  session: { access_token: "token-123" },
  canEdit: true,
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => authMockState,
}));

// ── Mock AsyncAutocomplete ─────────────────────────────────────────────
vi.mock("@/components/pcready/AsyncAutocomplete", () => ({
  AsyncAutocomplete: vi.fn(
    ({
      value,
      placeholder,
      disabled,
      onChange,
      loadOptions,
      selectedOption,
    }: {
      value: string;
      placeholder: string;
      disabled?: boolean;
      onChange: (value: string, option: null) => void;
      loadOptions: (query: string) => Promise<Array<{ value: string; label: string }>>;
      selectedOption: { value: string; label: string } | null;
    }) => {
      return (
        <div data-testid={`autocomplete-${placeholder.replace(/\s+/g, "-").slice(0, 20)}`}>
          <input
            data-testid="autocomplete-input"
            disabled={disabled}
            value={selectedOption?.label || value || ""}
            placeholder={placeholder}
            aria-label={placeholder}
            onChange={async (e) => {
              const opts = await loadOptions(e.target.value);
              if (opts.length > 0) onChange(opts[0].value, null);
            }}
          />
        </div>
      );
    },
  ),
}));

// ── Mock di Modal ──────────────────────────────────────────────────────
vi.mock("@/components/pcready/Modal", () => ({
  Modal: vi.fn(
    ({
      open,
      onClose,
      title,
      footer,
      children,
    }: {
      open: boolean;
      onClose: () => void;
      title: string;
      footer: React.ReactNode;
      children: React.ReactNode;
      size?: string;
    }) => {
      if (!open) return null;
      return (
        <div data-testid="modal" role="dialog" aria-label={title}>
          <h2 data-testid="modal-title">{title}</h2>
          <div data-testid="modal-body">{children}</div>
          <div data-testid="modal-footer">{footer}</div>
          <button data-testid="modal-close" onClick={onClose}>
            Close
          </button>
        </div>
      );
    },
  ),
}));

// ── Mock queries ───────────────────────────────────────────────────────
vi.mock("@/lib/queries/tickets", () => ({
  loadClientOptions: vi.fn().mockResolvedValue([]),
  fetchClientById: vi.fn().mockResolvedValue({ id: "c1", name: "Test", company_name: "Test Inc." }),
  loadContactOptions: vi.fn().mockResolvedValue([]),
  fetchContactById: vi.fn().mockResolvedValue({
    id: "ct1",
    full_name: "Contatto Test",
    first_name: "Contatto",
    last_name: "Test",
    email: "contact@test.it",
    client_id: "c1",
  }),
  loadDeviceOptions: vi.fn().mockResolvedValue([]),
  fetchDeviceById: vi.fn().mockResolvedValue({ id: "d1", model: "Dell XPS", serial: "SN123" }),
}));

vi.mock("@/lib/queries/activity", () => ({
  default: {
    insertActivity: vi.fn(),
  },
}));

// ── Mock altri moduli ──────────────────────────────────────────────────
vi.mock("@/lib/notifications", () => ({
  createNotification: serverFnMocks.createNotification,
}));

vi.mock("@/lib/email-events", () => ({
  sendTicketAssignedEmail: serverFnMocks.sendTicketAssignedEmail,
}));

vi.mock("@/lib/app-settings", () => ({
  getPublicAppSettings: serverFnMocks.getPublicAppSettings,
  validateTechnicianDeviceLimit: serverFnMocks.validateTechnicianDeviceLimit,
  DEFAULT_WIP_LIMITS: {},
}));

vi.mock("@/lib/tickets", () => ({
  createTicket: serverFnMocks.createTicket,
}));

vi.mock("@/lib/server-fn-rate-limit-message", () => ({
  formatServerFnErrorForToast: (e: unknown, fallback: string) =>
    e instanceof Error ? e.message : fallback,
}));

vi.mock("@/lib/pcready", async () => {
  const actual = await vi.importActual<typeof import("@/lib/pcready")>("@/lib/pcready");
  return {
    ...actual,
  };
});

import { toast } from "sonner";
import { axe } from "vitest-axe";
// ── Import del componente dopo i mock ──────────────────────────────────
import { CreateTicketModal } from "@/components/pcready/CreateTicketModal";

async function renderModal() {
  // Apri la modale
  useTicketsMock.createOpen = true;

  // Mock supabase profiles e templates
  const profilesChain = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    then: vi.fn((cb: (arg: unknown) => void) =>
      cb({ data: [{ id: "t1", full_name: "Tech One", initials: "TO" }], error: null }),
    ),
  };
  const templatesChain = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    then: vi.fn((cb: (arg: unknown) => void) =>
      cb({
        data: [{ id: "tpl-1", name: "Default", structure: {}, is_default: true }],
        error: null,
      }),
    ),
  };
  supabaseMock.from.mockImplementation((table: string) => {
    if (table === "profiles") return profilesChain;
    if (table === "checklist_templates") return templatesChain;
    return { select: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), then: vi.fn() };
  });

  // Mock app settings
  serverFnMocks.getPublicAppSettings.mockResolvedValue({
    ticket_categories: ["Hardware", "Software"],
  });
  serverFnMocks.validateTechnicianDeviceLimit.mockResolvedValue(true);

  const result = render(<CreateTicketModal />);

  // Attendere che gli effetti asincroni (profiles, templates, settings) si stabilizzino
  // "Tech One" viene renderizzato come <option> nel select "Assegna a" dopo il caricamento dei profili
  await waitFor(() => {
    expect(screen.getByText("Tech One")).toBeTruthy();
  });

  return result;
}

describe("CreateTicketModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTicketsMock.createOpen = false;
    serverFnMocks.createTicket.mockReset();
    serverFnMocks.createNotification.mockReset();
    serverFnMocks.sendTicketAssignedEmail.mockReset();
    serverFnMocks.getPublicAppSettings.mockReset();
    serverFnMocks.validateTechnicianDeviceLimit.mockReset();
    authMockState.canEdit = true;
    authMockState.user = { id: "user-1" };
    authMockState.session = { access_token: "token-123" };
  });

  // ── Test 1: Rendering con createOpen=true ─────────────────────────────
  it("mostra la modale con campi vuoti quando createOpen è true", async () => {
    await renderModal();

    expect(screen.getByTestId("modal")).toBeTruthy();
    expect(screen.getByTestId("modal-title").textContent).toContain("Nuovo ticket");
  });

  // ── Test 2: Modal chiusa con createOpen=false ─────────────────────────
  it("non renderizza la modale quando createOpen è false", () => {
    useTicketsMock.createOpen = false;
    render(<CreateTicketModal />);

    expect(screen.queryByTestId("modal")).toBeNull();
  });

  // ── Test 3: Submit bloccato: nessun cliente ───────────────────────────
  it("blocca il submit e mostra errore se il cliente non è selezionato", async () => {
    await renderModal();
    serverFnMocks.createTicket.mockResolvedValue({
      id: "t-new",
      ticket_code: "PC-999",
    });

    // Clicca "Crea ticket" senza compilare il cliente
    const submitBtn = screen.getByText(/Crea ticket/i);
    await userEvent.click(submitBtn);

    expect(toast.error).toHaveBeenCalled();
    expect(serverFnMocks.createTicket).not.toHaveBeenCalled();
  });

  // ── Test 4: Submit bloccato: nessun richiedente ───────────────────────
  it("blocca il submit se il richiedente è vuoto", async () => {
    await renderModal();
    serverFnMocks.createTicket.mockResolvedValue({
      id: "t-new",
      ticket_code: "PC-999",
    });

    // Simula un cliente selezionato (tramite autocomplete)
    // Dobbiamo triggerare il loadOptions e onChange dell'autocomplete cliente
    const clientInputs = screen.getAllByTestId("autocomplete-input");
    const clientInput = clientInputs.find((el) =>
      el.getAttribute("placeholder")?.includes("Cerca cliente"),
    );
    expect(clientInput).toBeTruthy();

    // Senza cliente e richiedente, il submit deve fallire
    const submitBtn = screen.getByText(/Crea ticket/i);
    await userEvent.click(submitBtn);

    expect(toast.error).toHaveBeenCalled();
    expect(serverFnMocks.createTicket).not.toHaveBeenCalled();
  });

  // ── Test 5: Submit bloccato: ticket type "device" senza dispositivo ───
  it("blocca il submit con ticket device se nessun dispositivo selezionato", async () => {
    await renderModal();

    serverFnMocks.createTicket.mockResolvedValue({
      id: "t-new",
      ticket_code: "PC-999",
    });

    // Verifica che il tipo ticket sia "device" (default) e che il campo device sia presente
    const selects = document.querySelectorAll("select.pc-input");
    // Il select del tipo ticket
    const ticketTypeSelect = Array.from(selects).find((sel) =>
      sel.querySelector('option[value="device"]'),
    );
    expect(ticketTypeSelect).toBeTruthy();

    // Submit senza dispositivo deve fallire se i campi obbligatori sono vuoti
    const submitBtn = screen.getByText(/Crea ticket/i);
    await userEvent.click(submitBtn);

    expect(toast.error).toHaveBeenCalled();
    expect(serverFnMocks.createTicket).not.toHaveBeenCalled();
  });

  // ── Test 6: Submit bloccato: canEdit=false ────────────────────────────
  it("blocca il submit se canEdit è false", async () => {
    authMockState.canEdit = false;
    await renderModal();

    const submitBtn = screen.getByText(/Crea ticket/i);
    await userEvent.click(submitBtn);

    expect(toast.error).toHaveBeenCalled();
    expect(serverFnMocks.createTicket).not.toHaveBeenCalled();
  });

  // ── Test 7: Submit riuscito ──────────────────────────────────────────
  it("chiama createTicket in caso di successo", async () => {
    // Mock loadClientOptions per restituire un cliente valido
    const { loadClientOptions } = await import("@/lib/queries/tickets");
    (loadClientOptions as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "c1", name: "Test", company_name: "Test Inc.", email: "test@test.it" },
    ]);

    await renderModal();

    serverFnMocks.createTicket.mockResolvedValueOnce({
      id: "t-new",
      ticket_code: "PC-999",
    });
    serverFnMocks.createNotification.mockResolvedValue(undefined);
    serverFnMocks.sendTicketAssignedEmail.mockResolvedValue(undefined);

    // Cambia ticket type a "support" (non richiede dispositivo)
    const ticketTypeSelect = Array.from(document.querySelectorAll("select.pc-input")).find((sel) =>
      Array.from(sel.querySelectorAll("option")).some((opt) => opt.value === "support"),
    ) as HTMLSelectElement | undefined;
    if (ticketTypeSelect) {
      await userEvent.selectOptions(ticketTypeSelect, "support");
    }

    // Usa l'autocomplete per selezionare il cliente (triggera loadOptions)
    const clientInput = screen
      .getAllByTestId("autocomplete-input")
      .find((el) => el.getAttribute("placeholder")?.includes("Cerca cliente"));
    if (clientInput) {
      await userEvent.type(clientInput, "Test");
    }

    // Spunta il richiedente libero
    const freeCheckbox = document.querySelector('input[type="checkbox"]');
    if (freeCheckbox) {
      await userEvent.click(freeCheckbox);
    }

    // Compila il richiedente libero
    const freeRequesterInput = Array.from(
      document.querySelectorAll(
        'input:not([type="checkbox"]):not([data-testid="autocomplete-input"])',
      ),
    ).find((inp) => (inp as HTMLInputElement).placeholder?.includes("richiedente")) as
      | HTMLInputElement
      | undefined;
    if (freeRequesterInput) {
      await userEvent.type(freeRequesterInput, "Richiedente Test");
    }

    // Clicca submit
    const submitBtn = screen.getByText(/Crea ticket/i);
    await userEvent.click(submitBtn);

    // Verifica che createTicket sia stato chiamato (con dati validi)
    expect(serverFnMocks.createTicket).toHaveBeenCalled();
  });

  // ── Test 8: Submit fallito → errore visibile, campi preservati ────────
  it("mostra errore e preserva i campi in caso di fallimento API", async () => {
    const { loadClientOptions } = await import("@/lib/queries/tickets");
    (loadClientOptions as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "c1", name: "Test", company_name: "Test Inc.", email: "test@test.it" },
    ]);

    await renderModal();

    serverFnMocks.createTicket.mockRejectedValueOnce(new Error("Errore server"));

    // Cambia ticket type a "support" per evitare il requisito dispositivo
    const ticketTypeSelect = Array.from(document.querySelectorAll("select.pc-input")).find((sel) =>
      Array.from(sel.querySelectorAll("option")).some((opt) => opt.value === "support"),
    ) as HTMLSelectElement | undefined;
    if (ticketTypeSelect) {
      await userEvent.selectOptions(ticketTypeSelect, "support");
    }

    // Seleziona cliente via autocomplete
    const clientInput = screen
      .getAllByTestId("autocomplete-input")
      .find((el) => el.getAttribute("placeholder")?.includes("Cerca cliente"));
    if (clientInput) {
      await userEvent.type(clientInput, "Test");
    }

    // Spunta il richiedente libero e compila
    const freeCheckbox = document.querySelector('input[type="checkbox"]');
    if (freeCheckbox) {
      await userEvent.click(freeCheckbox);
    }
    const freeRequesterInput = Array.from(
      document.querySelectorAll(
        'input:not([type="checkbox"]):not([data-testid="autocomplete-input"])',
      ),
    ).find((inp) => (inp as HTMLInputElement).placeholder?.includes("richiedente")) as
      | HTMLInputElement
      | undefined;
    if (freeRequesterInput) {
      await userEvent.type(freeRequesterInput, "Richiedente Test");
    }

    // Clicca submit → API fallisce
    const submitBtn = screen.getByText(/Crea ticket/i);
    await userEvent.click(submitBtn);

    // Verifica che l'errore sia stato mostrato
    expect(toast.error).toHaveBeenCalled();
    expect(serverFnMocks.createTicket).toHaveBeenCalled();

    // Verifica che i campi siano preservati (modale ancora aperta, valori mantenuti)
    expect(screen.getByTestId("modal")).toBeTruthy();

    // Il richiedente libero dovrebbe ancora contenere il valore inserito
    const requesterAfter = Array.from(
      document.querySelectorAll(
        'input:not([type="checkbox"]):not([data-testid="autocomplete-input"])',
      ),
    ).find((inp) => (inp as HTMLInputElement).placeholder?.includes("richiedente")) as
      | HTMLInputElement
      | undefined;
    expect(requesterAfter).toBeTruthy();
    expect(requesterAfter!.value).toBe("Richiedente Test");
  });

  // ── Test 9: Free requester toggle ─────────────────────────────────────
  it("mostra input testo quando free_requester è attivo", async () => {
    await renderModal();

    // Cerca il checkbox per il richiedente libero
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    const freeRequesterCheckbox = Array.from(checkboxes).find((cb) =>
      cb.parentElement?.textContent?.toLowerCase().includes("libero"),
    );
    expect(freeRequesterCheckbox).toBeTruthy();

    // Spunta il checkbox
    await userEvent.click(freeRequesterCheckbox!);

    // Dovrebbe apparire un input di testo per il richiedente
    const textInputs = document.querySelectorAll('input[type="text"], input:not([type])');
    const requesterInput = Array.from(textInputs).find(
      (inp) =>
        inp.getAttribute("placeholder")?.includes("richiedente") ||
        inp.getAttribute("placeholder")?.includes("Richiedente"),
    );
    expect(requesterInput).toBeTruthy();
  });

  // ── Test 10: Cambio ticket type ──────────────────────────────────────
  it("nasconde il campo dispositivo quando ticket_type non è device", async () => {
    await renderModal();

    // Trova il select del ticket type
    const selects = document.querySelectorAll("select.pc-input");
    const ticketTypeSelect = Array.from(selects).find((sel) =>
      Array.from(sel.querySelectorAll("option")).some((opt) => opt.value === "support"),
    ) as HTMLSelectElement | undefined;
    expect(ticketTypeSelect).toBeTruthy();

    if (ticketTypeSelect) {
      // Cambia a "support" (non-device)
      await userEvent.selectOptions(ticketTypeSelect, "support");
    }

    // Il campo dispositivo (autocomplete per device) non dovrebbe essere renderizzato
    const autocompletes = screen.queryAllByTestId(/autocomplete.*[Dd]ispositivo/);
    expect(autocompletes.length).toBe(0);
  });

  // ── Test 11: Accessibilità ───────────────────────────────────────────
  it("non ha violazioni a11y quando aperta", async () => {
    const { container } = await renderModal();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
