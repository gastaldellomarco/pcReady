// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MfaStatusBadge, computeMfaBannerData, USER_EXPORT_HEADERS, mapUserToExportRow, buildUserCsv, isValidEmail, isInviteFormValid } from "@/components/admin/AdminUsersTab";

// ── Mock react-i18next ───────────────────────────────────────────────────
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    i18n: { language: "it" },
  }),
}));

// ── MfaStatusBadge tests ─────────────────────────────────────────────────

describe("MfaStatusBadge", () => {
  it("renders 'Attivo' badge in green when MFA is enabled", () => {
    render(<MfaStatusBadge enabled={true} required={false} />);
    const badge = screen.getByText("Attivo");
    expect(badge).toBeTruthy();
    expect(badge.className).toContain("bg-emerald-600");
  });

  it("renders 'Richiesto' badge in amber when MFA is required but not enabled", () => {
    render(<MfaStatusBadge enabled={false} required={true} />);
    const badge = screen.getByText("Richiesto");
    expect(badge).toBeTruthy();
    expect(badge.className).toContain("bg-amber-500");
  });

  it("renders 'Non attivo' in red with alert icon for admin without MFA", () => {
    render(<MfaStatusBadge enabled={false} required={false} role="admin" />);
    const badge = screen.getByText("Non attivo");
    expect(badge).toBeTruthy();
    expect(badge.className).toContain("bg-red-600");
  });

  it("renders 'Non attivo' in secondary variant for non-admin without MFA", () => {
    render(<MfaStatusBadge enabled={false} required={false} role="tech" />);
    // Non-admin without MFA gets the default secondary variant
    expect(screen.getByText("Non attivo")).toBeTruthy();
  });

  it("renders 'Non attivo' in secondary when role is undefined (not admin)", () => {
    render(<MfaStatusBadge enabled={false} required={false} />);
    expect(screen.getByText("Non attivo")).toBeTruthy();
  });

  it("renders alert icon for non-active states with alert triangle", () => {
    render(<MfaStatusBadge enabled={false} required={false} role="admin" />);
    // The AlertTriangle icon is rendered (mock uses data-testid="alert-triangle-icon")
    expect(screen.getByTestId("alert-triangle-icon")).toBeTruthy();
  });

  it("does NOT render alert icon when MFA is active", () => {
    render(<MfaStatusBadge enabled={true} required={false} />);
    expect(screen.getByText("Attivo")).toBeTruthy();
    // No alert-triangle in the active state
    expect(screen.queryByTestId("alert-triangle-icon")).toBeNull();
  });
});

// ── computeMfaBannerData tests ───────────────────────────────────────────

describe("computeMfaBannerData", () => {
  it("returns no banners when settings is null", () => {
    const result = computeMfaBannerData(
      [{ mfa_enabled: false, role: "admin" }],
      null,
    );
    expect(result.showAllUsersBanner).toBe(false);
    expect(result.showAdminsBanner).toBe(false);
  });

  it("returns no banners when all users have MFA", () => {
    const result = computeMfaBannerData(
      [{ mfa_enabled: true, role: "admin" }],
      { mfa_require_all_users: true },
    );
    expect(result.showAllUsersBanner).toBe(false);
    expect(result.allUsersCount).toBe(0);
  });

  it("shows all-users banner when policy requires it and users lack MFA", () => {
    const result = computeMfaBannerData(
      [
        { mfa_enabled: false, role: "admin" },
        { mfa_enabled: false, role: "tech" },
      ],
      { mfa_require_all_users: true },
    );
    expect(result.showAllUsersBanner).toBe(true);
    expect(result.allUsersCount).toBe(2);
    expect(result.showAdminsBanner).toBe(false);
  });

  it("shows admins banner when only admin policy is set and admins lack MFA", () => {
    const result = computeMfaBannerData(
      [
        { mfa_enabled: false, role: "admin" },
        { mfa_enabled: false, role: "tech" },
      ],
      { mfa_require_admin_users: true },
    );
    expect(result.showAdminsBanner).toBe(true);
    expect(result.adminsCount).toBe(1);
    expect(result.showAllUsersBanner).toBe(false);
  });

  it("hides admins banner when all-users policy takes precedence", () => {
    const result = computeMfaBannerData(
      [{ mfa_enabled: false, role: "admin" }],
      { mfa_require_all_users: true, mfa_require_admin_users: true },
    );
    expect(result.showAllUsersBanner).toBe(true);
    expect(result.showAdminsBanner).toBe(false);
  });

  it("returns zero counts when no users provided", () => {
    const result = computeMfaBannerData([], { mfa_require_all_users: true });
    expect(result.allUsersCount).toBe(0);
    expect(result.adminsCount).toBe(0);
    expect(result.showAllUsersBanner).toBe(false);
  });

  it("counts admins correctly", () => {
    const result = computeMfaBannerData(
      [
        { mfa_enabled: false, role: "admin" },
        { mfa_enabled: false, role: "admin" },
        { mfa_enabled: true, role: "admin" },
      ],
      { mfa_require_admin_users: true },
    );
    expect(result.adminsCount).toBe(2);
    expect(result.showAdminsBanner).toBe(true);
  });
});

// ── Export helpers ───────────────────────────────────────────────────────

describe("USER_EXPORT_HEADERS", () => {
  it("contains the 7 expected columns", () => {
    expect(USER_EXPORT_HEADERS).toEqual([
      "id", "email", "full_name", "role", "status", "created_at", "last_sign_in_at",
    ]);
  });
});

describe("mapUserToExportRow", () => {
  it("maps a user row to CSV values", () => {
    const row = {
      id: "u1",
      email: "marco@test.it",
      full_name: "Marco Gastaldello",
      role: "admin",
      status: "active",
      created_at: "2026-01-01T00:00:00Z",
      last_sign_in_at: "2026-06-10T00:00:00Z",
    };
    expect(mapUserToExportRow(row)).toEqual([
      "u1", "marco@test.it", "Marco Gastaldello", "admin", "active",
      "2026-01-01T00:00:00Z", "2026-06-10T00:00:00Z",
    ]);
  });

  it("falls back to empty string for null email and last_sign_in_at", () => {
    const row = {
      id: "u2",
      email: null,
      full_name: "Anna B.",
      role: "tech",
      status: "active",
      created_at: "2026-02-01T00:00:00Z",
      last_sign_in_at: null,
    };
    expect(mapUserToExportRow(row)[1]).toBe("");
    expect(mapUserToExportRow(row)[6]).toBe("");
  });
});

describe("buildUserCsv", () => {
  it("returns headers as first row", () => {
    const csv = buildUserCsv([]);
    expect(csv).toHaveLength(1);
    expect(csv[0]).toEqual(USER_EXPORT_HEADERS);
  });

  it("includes header and data rows", () => {
    const rows = [{
      id: "u1", email: "a@test.it", full_name: "A", role: "admin",
      status: "active", created_at: "2026-01-01T00:00:00Z", last_sign_in_at: null,
    }];
    const csv = buildUserCsv(rows);
    expect(csv).toHaveLength(2);
    expect(csv[0]).toBe(USER_EXPORT_HEADERS);
    expect(csv[1][0]).toBe("u1");
  });

  it("handles multiple rows", () => {
    const rows = [
      { id: "u1", email: null, full_name: "A", role: "admin", status: "active", created_at: "2026-01-01T00:00:00Z", last_sign_in_at: null },
      { id: "u2", email: null, full_name: "B", role: "tech", status: "active", created_at: "2026-01-02T00:00:00Z", last_sign_in_at: null },
    ];
    expect(buildUserCsv(rows)).toHaveLength(3);
  });
});

// ── Invite form helpers ──────────────────────────────────────────────────

describe("isValidEmail", () => {
  it("accepts valid emails", () => {
    expect(isValidEmail("marco@test.it")).toBe(true);
    expect(isValidEmail("user+tag@example.com")).toBe(true);
  });
  it("rejects invalid emails", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("notanemail")).toBe(false);
    expect(isValidEmail("@missing.com")).toBe(false);
    expect(isValidEmail("missing@")).toBe(false);
  });
});

describe("isInviteFormValid", () => {
  it("returns true when all conditions met", () => {
    expect(isInviteFormValid("Marco", "marco@test.it", true, true)).toBe(true);
  });
  it("returns false when busy", () => {
    expect(isInviteFormValid("Marco", "marco@test.it", false, true)).toBe(false);
  });
  it("returns false when name missing", () => {
    expect(isInviteFormValid("", "marco@test.it", true, true)).toBe(false);
  });
  it("returns false when email invalid", () => {
    expect(isInviteFormValid("Marco", "bad", true, true)).toBe(false);
  });
  it("returns false when form validation fails", () => {
    expect(isInviteFormValid("Marco", "marco@test.it", true, false)).toBe(false);
  });
});

// ── AdminUsersTab render smoke test ──────────────────────────────────────
import { AdminUsersTab } from "@/components/admin/AdminUsersTab";

// ── Mock useAuth ─────────────────────────────────────────────────────────
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    session: { access_token: "mock-token" },
    user: { id: "user-001", email: "admin@test.it" },
    hasPermission: () => true,
    startImpersonation: vi.fn(),
    isImpersonating: false,
    impersonatingTargetId: null,
  }),
  AppRole: {},
}));

// ── Mock useAdminUsers ───────────────────────────────────────────────────
const mockRows = vi.hoisted(() => [
  {
    id: "u1",
    full_name: "Marco Gastaldello",
    initials: "MG",
    email: "marco@test.it",
    role: "admin",
    status: "active",
    created_at: "2026-01-01T00:00:00Z",
    last_sign_in_at: "2026-06-10T00:00:00Z",
    mfa_enabled: true,
    mfa_required: false,
    invited_at: null,
  },
  {
    id: "u2",
    full_name: "Anna Bianchi",
    initials: "AB",
    email: "anna@test.it",
    role: "tech",
    status: "active",
    created_at: "2026-02-01T00:00:00Z",
    last_sign_in_at: null,
    mfa_enabled: false,
    mfa_required: true,
    invited_at: null,
  },
]);

vi.mock("@/hooks/useAdminUsers", () => ({
  useAdminUsers: () => ({
    rows: mockRows as unknown as any[],
    loadingRows: false,
    busyId: null,
    inviteBusy: false,
    inviteForm: {
      register: () => ({ onBlur: vi.fn() }),
      handleSubmit: () => (e: any) => e?.preventDefault?.(),
      watch: () => "",
      formState: { errors: {}, isValid: false },
      trigger: vi.fn(),
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
    bulkRole: "tech",
    setBulkRole: vi.fn(),
    deleteTarget: null,
    setDeleteTarget: vi.fn(),
    q: "",
    setQ: vi.fn(),
    role: "",
    setRole: vi.fn(),
    filtered: mockRows as unknown as any[],
    load: vi.fn(),
    saveRole: vi.fn(),
    toggleDisabled: vi.fn(),
    resendInviteFor: vi.fn(),
    approvePending: vi.fn(),
    remove: vi.fn(),
    confirmRemove: vi.fn(),
    updateUser: vi.fn(),
    resendInvite: vi.fn(),
    setDisabled: vi.fn(),
  }),
}));

// ── Mock useAdminAppSettings ─────────────────────────────────────────────
vi.mock("@/hooks/useAdminAppSettings", () => ({
  useAdminAppSettings: () => ({
    settings: null,
    isLoading: false,
  }),
}));

// ── Mock useIsMobile ─────────────────────────────────────────────────────
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

// ── Mock lucide-react icons ──────────────────────────────────────────────
vi.mock("lucide-react", () => ({
  Eye: () => <span data-testid="eye-icon" />,
  MailPlus: () => <span data-testid="mail-plus-icon" />,
  Search: () => <span data-testid="search-icon" />,
  ShieldCheck: () => <span data-testid="shield-check-icon" />,
  Trash2: () => <span data-testid="trash-icon" />,
  UserX: () => <span data-testid="user-x-icon" />,
  UserCheck: () => <span data-testid="user-check-icon" />,
  AlertTriangle: () => <span data-testid="alert-triangle-icon" />,
}));

// ── Mock sub-components ──────────────────────────────────────────────────
vi.mock("@/components/admin/ImpersonationReadOnlyBanner", () => ({
  ImpersonationReadOnlyBanner: () => <div data-testid="impersonation-banner" />,
}));

vi.mock("@/components/admin/AdminUserRoleEditor", () => ({
  AdminUserRoleEditor: ({ role }: { role: string }) => (
    <span data-testid="role-editor">{role}</span>
  ),
}));

vi.mock("@/components/admin/AdminUserStatusBadge", () => ({
  AdminUserStatusBadge: ({ status }: { status: string }) => (
    <span data-testid="status-badge">{status}</span>
  ),
}));

vi.mock("@/components/page-states", () => ({
  TableSkeletonRows: () => <tr data-testid="skeleton-row" />,
}));

// ── Mock UI components ───────────────────────────────────────────────────
vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({ checked, onCheckedChange }: any) => (
    <input
      type="checkbox"
      data-testid="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
    />
  ),
}));

vi.mock("@/components/ui/tabs", () => ({
  TabsContent: ({ children }: any) => <div data-testid="tabs-content">{children}</div>,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, className }: any) => (
    <span className={className}>{children}</span>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/mobile-card-view", () => ({
  MobileCardView: () => <div data-testid="mobile-card-view" />,
}));

vi.mock("@/components/ui/overflow-table", () => ({
  default: ({ children }: any) => <div data-testid="overflow-table">{children}</div>,
}));

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: any) => <div>{children}</div>,
  AlertDialogAction: ({ children, onClick }: any) => (
    <button onClick={onClick}>{children}</button>
  ),
  AlertDialogCancel: ({ children }: any) => <button>{children}</button>,
  AlertDialogContent: ({ children }: any) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: any) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: any) => <div>{children}</div>,
}));

// ── Tests ────────────────────────────────────────────────────────────────

describe("AdminUsersTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the users tab content", () => {
    render(<AdminUsersTab />);
    expect(screen.getByTestId("tabs-content")).toBeTruthy();
  });

  it("renders the impersonation banner", () => {
    render(<AdminUsersTab />);
    expect(screen.getByTestId("impersonation-banner")).toBeTruthy();
  });

  it("renders the invite form (email, name, role, submit)", () => {
    render(<AdminUsersTab />);
    // email input
    expect(screen.getByPlaceholderText("utente@azienda.it")).toBeTruthy();
    // name input
    expect(screen.getByPlaceholderText("Mario Rossi")).toBeTruthy();
    // submit button
    expect(screen.getByText("Invita")).toBeTruthy();
  });

  it("renders the search bar", () => {
    render(<AdminUsersTab />);
    expect(screen.getByPlaceholderText("Cerca nome o email...")).toBeTruthy();
  });

  it("renders the users table with mock data", () => {
    render(<AdminUsersTab />);
    // user names should appear
    expect(screen.getByText("Marco Gastaldello")).toBeTruthy();
    expect(screen.getByText("Anna Bianchi")).toBeTruthy();
  });

  it("renders MFA status badges for users", () => {
    render(<AdminUsersTab />);
    // Marco has MFA enabled → "Attivo"
    expect(screen.getByText("Attivo")).toBeTruthy();
    // Anna has MFA required but not enabled → "Richiesto"
    expect(screen.getByText("Richiesto")).toBeTruthy();
  });

  it("renders status badges for users", () => {
    render(<AdminUsersTab />);
    const statusBadges = screen.getAllByTestId("status-badge");
    expect(statusBadges.length).toBeGreaterThanOrEqual(2);
  });

  it("renders role editors for users", () => {
    render(<AdminUsersTab />);
    const editors = screen.getAllByTestId("role-editor");
    expect(editors.length).toBeGreaterThanOrEqual(2);
    expect(editors[0].textContent).toBe("admin");
    expect(editors[1].textContent).toBe("tech");
  });

  it("shows user count label", () => {
    render(<AdminUsersTab />);
    // The mock t() returns the fallback string as-is: "{{count}} utenti"
    expect(screen.getByText("{{count}} utenti")).toBeTruthy();
  });
});
