// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { AppRole } from "@/lib/auth-context";

// ── Mock di react-i18next ──────────────────────────────────────────────
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "it" },
  }),
}));

// ── Mock di sonner ─────────────────────────────────────────────────────
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// ── Mock di @/lib/auth-context ─────────────────────────────────────────
const authMock = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: authMock.useAuth,
}));

// ── Mock di @/hooks/useAdminUsers ──────────────────────────────────────
const adminUsersMock = vi.hoisted(() => ({
  useAdminUsers: vi.fn(),
}));

vi.mock("@/hooks/useAdminUsers", () => ({
  useAdminUsers: adminUsersMock.useAdminUsers,
}));

// ── Mock componenti UI ─────────────────────────────────────────────────
vi.mock("@/components/admin/AdminUserRoleEditor", () => ({
  AdminUserRoleEditor: vi.fn(
    ({
      role,
      onChange,
      disabled,
    }: {
      role: AppRole;
      onChange: (r: AppRole) => void;
      disabled: boolean;
    }) => (
      <select
        data-testid="role-editor"
        disabled={disabled}
        value={role}
        onChange={(e) => onChange(e.target.value as AppRole)}
        aria-label="Ruolo utente"
      >
        <option value="admin">Admin</option>
        <option value="editor">Editor</option>
        <option value="viewer">Viewer</option>
      </select>
    ),
  ),
}));

vi.mock("@/components/admin/AdminUserStatusBadge", () => ({
  AdminUserStatusBadge: vi.fn(({ status }: { status: string }) => (
    <span data-testid="status-badge">{status}</span>
  )),
}));

vi.mock("@/components/ui/alert-dialog", () => {
  const FakeDialog = ({
    open,
    children,
    onOpenChange,
  }: {
    open: boolean;
    children: React.ReactNode;
    onOpenChange?: (open: boolean) => void;
  }) => {
    if (!open) return null;
    return (
      <div data-testid="alert-dialog">
        {children}
        <button data-testid="dialog-cancel" onClick={() => onOpenChange?.(false)}>
          Cancel
        </button>
        <button data-testid="dialog-confirm" onClick={() => onOpenChange?.(false)}>
          Confirm
        </button>
      </div>
    );
  };
  return {
    AlertDialog: FakeDialog,
    AlertDialogAction: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
      <button data-testid="alert-action" onClick={onClick}>
        {children}
      </button>
    ),
    AlertDialogCancel: ({ children }: { children: React.ReactNode }) => (
      <button data-testid="alert-cancel">{children}</button>
    ),
    AlertDialogContent: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="alert-content">{children}</div>
    ),
    AlertDialogDescription: ({ children }: { children: React.ReactNode }) => (
      <p data-testid="alert-description">{children}</p>
    ),
    AlertDialogFooter: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    AlertDialogHeader: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    AlertDialogTitle: ({ children }: { children: React.ReactNode }) => (
      <h3>{children}</h3>
    ),
  };
});

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button data-testid="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
  }: {
    checked: boolean;
    onCheckedChange?: (val: boolean) => void;
  }) => (
    <input
      type="checkbox"
      data-testid="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      aria-label={checked ? "Deseleziona" : "Seleziona"}
    />
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string; variant?: string }) => (
    <span data-testid="badge" className={className}>{children}</span>
  ),
}));

vi.mock("@/components/page-states", () => ({
  TableSkeletonRows: vi.fn(() => (
    <tr data-testid="skeleton-row"><td colSpan={9}>Loading...</td></tr>
  )),
}));

vi.mock("@/components/ui/overflow-table", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="overflow-table">{children}</div>
  ),
}));

vi.mock("@/components/ui/tabs", () => ({
  TabsContent: ({ children }: { children: React.ReactNode; value: string }) => (
    <div data-testid="tabs-content">{children}</div>
  ),
}));

vi.mock("@/lib/admin/admin-error-message", () => ({
  getAdminErrorMessage: (_err: unknown, fallback: string) => fallback,
}));

vi.mock("@/lib/admin/admin-constants", () => ({
  ADMIN_ROLES: ["admin", "editor", "viewer"],
  adminRoleLabel: (role: string) => role.charAt(0).toUpperCase() + role.slice(1),
}));

vi.mock("@/lib/downloads", () => ({
  buildDownloadFileName: (prefix: string) => `${prefix}.csv`,
  downloadCsv: vi.fn(),
}));

import { axe } from "vitest-axe";
// ── Import dopo i mock ──────────────────────────────────────────────────
import { AdminUsersTab } from "@/components/admin/AdminUsersTab";

const MOCK_ROWS = [
  {
    id: "u-1",
    email: "mario@test.it",
    full_name: "Mario Rossi",
    initials: "MR",
    role: "admin" as AppRole,
    status: "active",
    created_at: "2025-01-01T00:00:00Z",
    last_sign_in_at: "2025-06-01T10:00:00Z",
    mfa_enabled: true,
    mfa_required: false,
    invited_at: null,
  },
  {
    id: "u-2",
    email: "luigi@test.it",
    full_name: "Luigi Bianchi",
    initials: "LB",
    role: "editor" as AppRole,
    status: "invited",
    created_at: "2025-02-01T00:00:00Z",
    last_sign_in_at: null,
    mfa_enabled: false,
    mfa_required: true,
    invited_at: "2025-02-01T00:00:00Z",
  },
  {
    id: "u-3",
    email: "anna@test.it",
    full_name: "Anna Verdi",
    initials: "AV",
    role: "viewer" as AppRole,
    status: "disabled",
    created_at: "2025-03-01T00:00:00Z",
    last_sign_in_at: "2025-05-01T08:00:00Z",
    mfa_enabled: false,
    mfa_required: false,
    invited_at: null,
  },
];

function setupUseAdminUsers(overrides: Record<string, unknown> = {}) {
  const defaults = {
    rows: MOCK_ROWS,
    loadingRows: false,
    busyId: null,
    inviteBusy: false,
    inviteForm: {
      register: vi.fn((name: string) => ({ name, onChange: vi.fn(), onBlur: vi.fn(), ref: vi.fn() })),
      handleSubmit: vi.fn((fn: (vals: unknown) => void) => (e: React.FormEvent) => { e.preventDefault(); fn({ email: "test@test.it", fullName: "Test", role: "editor" }); }),
      watch: vi.fn(() => ""),
      trigger: vi.fn(),
      formState: { errors: {}, isValid: true },
      reset: vi.fn(),
    },
    inviteSubmit: vi.fn(),
    selectedIds: new Set<string>(),
    setSelectedIds: vi.fn(),
    bulkBusy: false,
    setBulkBusy: vi.fn(),
    bulkConfirmOpen: false,
    setBulkConfirmOpen: vi.fn(),
    bulkAction: null,
    setBulkAction: vi.fn(),
    bulkRole: "viewer",
    setBulkRole: vi.fn(),
    deleteTarget: null,
    setDeleteTarget: vi.fn(),
    q: "",
    setQ: vi.fn(),
    role: "",
    setRole: vi.fn(),
    filtered: MOCK_ROWS,
    load: vi.fn(),
    saveRole: vi.fn(),
    toggleDisabled: vi.fn(),
    resendInviteFor: vi.fn(),
    remove: vi.fn(),
    confirmRemove: vi.fn(),
    updateUser: vi.fn(),
    setDisabled: vi.fn(),
    resendInvite: vi.fn(),
    ...overrides,
  };
  adminUsersMock.useAdminUsers.mockReturnValue(defaults);
  return defaults;
}

function setupAuth(overrides: Record<string, unknown> = {}) {
  const defaults = {
    session: { access_token: "test-token" },
    user: { id: "u-current" },
    isAdmin: true,
  };
  authMock.useAuth.mockReturnValue({ ...defaults, ...overrides });
}

function renderTab() {
  setupAuth();
  setupUseAdminUsers();
  return render(<AdminUsersTab />);
}

describe("AdminUsersTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Test 1: Lista utenti renderizzata ─────────────────────────────────
  it("renderizza la lista utenti con nome, email e ruolo", () => {
    renderTab();

    expect(screen.getByText("Mario Rossi")).toBeTruthy();
    expect(screen.getByText("mario@test.it")).toBeTruthy();
    expect(screen.getByText("Luigi Bianchi")).toBeTruthy();
    expect(screen.getAllByTestId("status-badge").length).toBe(3);
  });

  // ── Test 2: Loading state ─────────────────────────────────────────────
  it("mostra lo skeleton durante il caricamento", () => {
    setupUseAdminUsers({ loadingRows: true, filtered: [] });
    setupAuth();
    render(<AdminUsersTab />);

    expect(screen.getByTestId("skeleton-row")).toBeTruthy();
  });

  // ── Test 3: Empty state ──────────────────────────────────────────────
  it("mostra messaggio vuoto quando non ci sono utenti", () => {
    setupUseAdminUsers({ filtered: [], rows: [] });
    setupAuth();
    render(<AdminUsersTab />);

    expect(screen.getByText(/users.empty.noUsers|Nessun utente/i)).toBeTruthy();
  });

  // ── Test 4: Validazione email invito ──────────────────────────────────
  it("mostra errore email quando la validazione fallisce", () => {
    setupUseAdminUsers({
      inviteForm: {
        register: vi.fn((name: string) => ({ name })),
        handleSubmit: vi.fn(),
        watch: vi.fn(() => ""),
        trigger: vi.fn(),
        formState: { errors: { email: { message: "Email non valida" } }, isValid: false },
        reset: vi.fn(),
      },
    });
    setupAuth();
    render(<AdminUsersTab />);

    expect(screen.getByText("Email non valida")).toBeTruthy();
  });

  // ── Test 5: Invito submit valido ─────────────────────────────────────
  it("chiama inviteSubmit quando il form è inviato", async () => {
    const inviteSubmit = vi.fn();
    const handleSubmit = vi.fn((fn: (vals: unknown) => void) => (e: React.FormEvent) => {
      e.preventDefault();
      fn({ email: "new@test.it", fullName: "Nuovo", role: "editor" });
    });
    setupUseAdminUsers({
      inviteForm: {
        register: vi.fn((name: string) => ({ name })),
        handleSubmit,
        watch: vi.fn(() => ""),
        trigger: vi.fn(),
        formState: { errors: {}, isValid: true },
        reset: vi.fn(),
      },
      inviteSubmit,
    });
    setupAuth();
    render(<AdminUsersTab />);

    // Trova il form e fai submit
    const form = document.querySelector("form");
    expect(form).toBeTruthy();
    form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(inviteSubmit).toHaveBeenCalledWith({
      email: "new@test.it",
      fullName: "Nuovo",
      role: "editor",
    });
  });

  // ── Test 6: Cambio ruolo ─────────────────────────────────────────────
  it("chiama saveRole quando il ruolo viene cambiato", async () => {
    const saveRole = vi.fn();
    setupUseAdminUsers({ saveRole });
    setupAuth();
    render(<AdminUsersTab />);

    const editors = screen.getAllByTestId("role-editor");
    expect(editors.length).toBe(3);

    // Cambia il ruolo del primo utente
    await userEvent.selectOptions(editors[0], "editor");
    expect(saveRole).toHaveBeenCalledWith(MOCK_ROWS[0], "editor");
  });

  // ── Test 7: Permessi insufficienti (isAdmin=false) ────────────────────
  it("gestisce il caso di utente non admin", () => {
    setupAuth({ isAdmin: false });
    setupUseAdminUsers();
    render(<AdminUsersTab />);

    // Il componente dovrebbe comunque renderizzare, ma load potrebbe non essere chiamato
    // Verifichiamo che il componente non crasha
    expect(screen.getByTestId("tabs-content")).toBeTruthy();
  });

  // ── Test 8: Bulk select/deselect ─────────────────────────────────────
  it("seleziona tutti gli utenti con checkbox select all", async () => {
    const setSelectedIds = vi.fn();
    setupUseAdminUsers({ setSelectedIds });
    setupAuth();
    render(<AdminUsersTab />);

    const checkboxes = screen.getAllByTestId("checkbox");
    // Il primo checkbox è il select-all (nell'header della tabella)
    const selectAll = checkboxes[0];
    expect(selectAll).toBeTruthy();

    // Clicca select all
    await userEvent.click(selectAll);
    expect(setSelectedIds).toHaveBeenCalled();
  });

  // ── Test 9: Ricerca e filtro ─────────────────────────────────────────
  it("chiama setQ quando l'input di ricerca cambia", async () => {
    const setQ = vi.fn();
    setupUseAdminUsers({ setQ });
    setupAuth();
    render(<AdminUsersTab />);

    const searchInput = document.querySelector('input[placeholder*="search"]');
    expect(searchInput).toBeTruthy();
    await userEvent.type(searchInput!, "Mario");
    expect(setQ).toHaveBeenCalled();
  });

  // ── Test 10: Delete confirmation ─────────────────────────────────────
  it("apre il dialog di conferma quando si clicca elimina", async () => {
    const remove = vi.fn();
    setupUseAdminUsers({ remove });
    setupAuth();
    render(<AdminUsersTab />);

    // I pulsanti delete hanno title="users.tooltip.removeUser" (dal mock i18n)
    const deleteButtons = screen.getAllByTitle(/removeUser|Rimuovi utente/i);
    // Almeno un bottone delete deve essere visibile
    expect(deleteButtons.length).toBeGreaterThanOrEqual(1);

    // Clicca il primo bottone delete
    await userEvent.click(deleteButtons[0]);
    expect(remove).toHaveBeenCalled();
  });

  // ── Test 11: Accessibilità ────────────────────────────────────────────
  it("non ha violazioni a11y", async () => {
    const { container } = renderTab();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
