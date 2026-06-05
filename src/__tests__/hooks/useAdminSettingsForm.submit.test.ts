import { renderHook, waitFor } from "@testing-library/react";
// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useAdminSettingsForm } from "@/hooks/useAdminSettingsForm";
import type { AppSettings } from "@/lib/app-settings";

// ── Mock sonner ────────────────────────────────────────────────────────
const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: toastMock }));

// Mock react-hook-form and resolvers to avoid worker crash with multiple renderHook calls
const formGetValues = vi.hoisted(() => vi.fn());
vi.mock("react-hook-form", () => ({
  useForm: () => ({
    getValues: formGetValues,
    reset: vi.fn(),
    register: vi.fn(() => ({})),
    trigger: vi.fn(),
    watch: vi.fn(),
    formState: { errors: {}, isValid: true },
    handleSubmit: vi.fn((fn) => (e: { preventDefault: () => void }) => {
      e.preventDefault();
      fn({});
    }),
  }),
  useFormContext: vi.fn(),
}));

vi.mock("@hookform/resolvers/zod", () => ({
  zodResolver: () => vi.fn(),
}));

vi.mock("@/lib/admin/admin-error-message", () => ({
  getAdminErrorMessage: (_err: unknown, fallback: string) => {
    if (_err instanceof Error) return _err.message;
    return fallback;
  },
}));

// ── Factory helpers ────────────────────────────────────────────────────

const MAKE_SETTINGS = {
  organization_name: "PCReady",
  default_timezone: "Europe/Rome",
  max_devices_per_technician: 10,
  self_registration_enabled: false,
  admin_approval_required: true,
  support_email: "support@test.it",
  wip_limits: { pending: 20, "in-progress": 5, testing: 5, ready: 20, completed: 0, archived: 0 },
  sla_config: {
    high: { responseHours: 1, resolutionHours: 4 },
    med: { responseHours: 4, resolutionHours: 24 },
    low: { responseHours: 24, resolutionHours: 72 },
  },
  sla_limits: { high: 4, med: 24, low: 72 },
  archive_after_days: 7,
  log_retention_days: 365,
  os_options: ["Windows", "macOS"],
  device_brands: ["Dell", "Lenovo"],
  ticket_categories: ["Hardware", "Software"],
  kanban_column_colors: {},
  mfa_require_admin_users: false,
  mfa_require_all_users: false,
  mfa_grace_period_days: 7,
};

function makeSaveSettingsMock() {
  return vi.fn().mockResolvedValue({ success: true });
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("useAdminSettingsForm submitSettings", () => {
  let saveSettings: ReturnType<typeof makeSaveSettingsMock>;
  let onSettingsSaved: ReturnType<typeof vi.fn<(settings: AppSettings) => void>>;

  beforeEach(() => {
    vi.clearAllMocks();
    formGetValues.mockReturnValue(MAKE_SETTINGS);
    saveSettings = makeSaveSettingsMock();
    onSettingsSaved = vi.fn();
  });

  it("guards when accessToken is undefined", async () => {
    const { result } = renderHook(() =>
      useAdminSettingsForm({
        accessToken: undefined,
        settings: MAKE_SETTINGS as any,
        saveSettings,
        onSettingsSaved,
      }),
    );

    const promise = result.current.submitSettings(result.current.settingsForm.getValues());
    await promise;

    expect(saveSettings).not.toHaveBeenCalled();
    expect(onSettingsSaved).not.toHaveBeenCalled();
  });

  it("saves settings, calls onSettingsSaved, and shows success toast", async () => {
    saveSettings.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 50)),
    );

    const { result } = renderHook(() =>
      useAdminSettingsForm({
        accessToken: "token-123",
        settings: null,
        saveSettings,
        onSettingsSaved,
      }),
    );

    const promise = result.current.submitSettings(result.current.settingsForm.getValues());
    await promise;

    expect(saveSettings).toHaveBeenCalledTimes(1);
    const callData = saveSettings.mock.calls[0][0].data;
    expect(callData.accessToken).toBe("token-123");
    expect(callData.settings.organization_name).toBe("PCReady");

    expect(onSettingsSaved).toHaveBeenCalledTimes(1);
    expect(toastMock.success).toHaveBeenCalledWith("Impostazioni salvate");
    await waitFor(() => {
      expect(result.current.saveSettingsBusy).toBe(false);
    });
  });

  it("shows error toast on save failure", async () => {
    saveSettings.mockRejectedValue(new Error("Save error"));

    const { result } = renderHook(() =>
      useAdminSettingsForm({
        accessToken: "token-123",
        settings: null,
        saveSettings,
        onSettingsSaved,
      }),
    );

    const promise = result.current.submitSettings(result.current.settingsForm.getValues());
    await promise;

    expect(toastMock.error).toHaveBeenCalledWith("Save error");
    await waitFor(() => {
      expect(result.current.saveSettingsBusy).toBe(false);
    });
  });

  it("handles non-Error rejection with fallback message", async () => {
    saveSettings.mockRejectedValue("rejected");

    const { result } = renderHook(() =>
      useAdminSettingsForm({
        accessToken: "token-123",
        settings: null,
        saveSettings,
        onSettingsSaved,
      }),
    );

    const promise = result.current.submitSettings(result.current.settingsForm.getValues());
    await promise;

    expect(toastMock.error).toHaveBeenCalledWith("Salvataggio non riuscito");
    await waitFor(() => {
      expect(result.current.saveSettingsBusy).toBe(false);
    });
  });
});
