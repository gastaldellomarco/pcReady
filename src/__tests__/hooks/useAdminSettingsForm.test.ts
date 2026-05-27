// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAdminSettingsForm } from "@/hooks/useAdminSettingsForm";
import type { AppSettings } from "@/lib/app-settings";

// ── Mock sonner ────────────────────────────────────────────────────────
const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: toastMock }));

// ── Factory helpers ────────────────────────────────────────────────────

function createAppSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
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
    ...overrides,
  };
}

function makeSaveSettingsMock() {
  return vi.fn().mockResolvedValue({ success: true });
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("useAdminSettingsForm", () => {
  let saveSettings: ReturnType<typeof makeSaveSettingsMock>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let onSettingsSaved: any;

  beforeEach(() => {
    vi.clearAllMocks();
    saveSettings = makeSaveSettingsMock();
    onSettingsSaved = vi.fn();
  });

  // ── Default state ────────────────────────────────────────────────────

  describe("default state", () => {
    it("initializes form with empty default values", () => {
      const { result } = renderHook(() =>
        useAdminSettingsForm({
          accessToken: "token-123",
          settings: null,
          saveSettings,
          onSettingsSaved,
        }),
      );

      expect(result.current.saveSettingsBusy).toBe(false);
      expect(result.current.settingsForm.getValues("organization_name")).toBe("");
      expect(result.current.settingsForm.getValues("default_timezone")).toBe("");
      expect(result.current.settingsForm.getValues("max_devices_per_technician")).toBe(1);
      expect(result.current.settingsForm.getValues("self_registration_enabled")).toBe(false);
      expect(result.current.settingsForm.getValues("os_options")).toEqual([]);
    });
  });

  // ── Form reset on settings change ────────────────────────────────────

  describe("form reset on settings change", () => {
    it("resets form to match settings when settings prop is provided", () => {
      const settings = createAppSettings({
        organization_name: "TestOrg",
        max_devices_per_technician: 25,
        self_registration_enabled: true,
        os_options: ["Linux"],
        support_email: "test@org.it",
        wip_limits: { pending: 10, "in-progress": 3, testing: 2, ready: 15, completed: 0, archived: 0 },
      });

      const { result } = renderHook(() =>
        useAdminSettingsForm({
          accessToken: "token-123",
          settings,
          saveSettings,
          onSettingsSaved,
        }),
      );

      expect(result.current.settingsForm.getValues("organization_name")).toBe("TestOrg");
      expect(result.current.settingsForm.getValues("max_devices_per_technician")).toBe(25);
      expect(result.current.settingsForm.getValues("self_registration_enabled")).toBe(true);
      expect(result.current.settingsForm.getValues("os_options")).toEqual(["Linux"]);
      expect(result.current.settingsForm.getValues("support_email")).toBe("test@org.it");
      expect(result.current.settingsForm.getValues("wip_limits.pending")).toBe(10);
    });
  });
});
