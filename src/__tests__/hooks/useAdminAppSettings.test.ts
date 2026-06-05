import { renderHook, act, waitFor } from "@testing-library/react";
// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useAdminAppSettings } from "@/hooks/useAdminAppSettings";
import type { AppSettings } from "@/lib/app-settings";

// ── Mock server functions ─────────────────────────────────────────────
const serverFnMocks = vi.hoisted(() => ({
  getAppSettings: vi.fn(),
  updateAppSettings: vi.fn(),
  exportAllData: vi.fn(),
}));

vi.mock("@/lib/app-settings", () => ({
  getAppSettings: serverFnMocks.getAppSettings,
  updateAppSettings: serverFnMocks.updateAppSettings,
}));

vi.mock("@/lib/export-data", () => ({
  exportAllData: serverFnMocks.exportAllData,
}));

// ── Mock downloads ─────────────────────────────────────────────────────
const downloadMocks = vi.hoisted(() => ({
  buildDownloadFileName: vi.fn(),
  downloadZip: vi.fn(),
}));

vi.mock("@/lib/downloads", () => ({
  buildDownloadFileName: downloadMocks.buildDownloadFileName,
  downloadZip: downloadMocks.downloadZip,
}));

// ── Mock TanStack Start ────────────────────────────────────────────────
vi.mock("@tanstack/react-start", () => ({
  useServerFn: vi.fn((fn: unknown) => {
    if (fn === serverFnMocks.getAppSettings) return serverFnMocks.getAppSettings;
    if (fn === serverFnMocks.updateAppSettings) return serverFnMocks.updateAppSettings;
    if (fn === serverFnMocks.exportAllData) return serverFnMocks.exportAllData;
    return vi.fn();
  }),
}));

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
    kanban_column_notes: {
      pending: "",
      "in-progress": "",
      testing: "",
      ready: "",
      completed: "",
      archived: "",
    },
    mfa_require_admin_users: false,
    mfa_require_all_users: false,
    mfa_grace_period_days: 7,
    ...overrides,
  };
}

function createExportResult() {
  return {
    generatedAt: "2026-01-01T00:00:00Z",
    files: {
      tickets: { filename: "tickets.csv", csv: "id,name\n1,test", rowCount: 1 },
    },
  };
}

// ── Common args ────────────────────────────────────────────────────────
const adminAuth = { accessToken: "token-123", isAdmin: true };
const noAuth = { accessToken: undefined, isAdmin: false };
const userAuth = { accessToken: "token-123", isAdmin: false };

// ── Tests ──────────────────────────────────────────────────────────────

describe("useAdminAppSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverFnMocks.getAppSettings.mockResolvedValue(createAppSettings());
    serverFnMocks.updateAppSettings.mockResolvedValue(undefined);
    downloadMocks.buildDownloadFileName.mockReturnValue("export.zip");
  });

  // ── Default state ────────────────────────────────────────────────────

  describe("default state", () => {
    it("starts with null settings and loading true", () => {
      const { result } = renderHook(() => useAdminAppSettings(adminAuth));

      expect(result.current.settings).toBeNull();
      expect(result.current.loadingSettings).toBe(true);
      expect(result.current.saveSettingsBusy).toBe(false);
      expect(result.current.exportAllBusy).toBe(false);
    });

    it("skips auto-load when accessToken is undefined", async () => {
      renderHook(() => useAdminAppSettings(noAuth));

      await new Promise((r) => setTimeout(r, 50));
      expect(serverFnMocks.getAppSettings).not.toHaveBeenCalled();
    });

    it("skips auto-load when isAdmin is false", async () => {
      renderHook(() => useAdminAppSettings(userAuth));

      await new Promise((r) => setTimeout(r, 50));
      expect(serverFnMocks.getAppSettings).not.toHaveBeenCalled();
    });
  });

  // ── loadAppSettings ──────────────────────────────────────────────────

  describe("loadAppSettings", () => {
    it("auto-loads settings on mount when admin", async () => {
      const settings = createAppSettings({ organization_name: "MyOrg" });
      serverFnMocks.getAppSettings.mockResolvedValue(settings);

      const { result } = renderHook(() => useAdminAppSettings(adminAuth));

      await waitFor(() => {
        expect(result.current.loadingSettings).toBe(false);
      });

      expect(result.current.settings).toEqual(settings);
      expect(serverFnMocks.getAppSettings).toHaveBeenCalledWith({
        data: { accessToken: "token-123" },
      });
    });

    it("shows error toast on load failure", async () => {
      serverFnMocks.getAppSettings.mockRejectedValue(new Error("Load error"));

      renderHook(() => useAdminAppSettings(adminAuth));

      await waitFor(() => {
        expect(toastMock.error).toHaveBeenCalled();
      });
    });

    it("manually calling loadAppSettings refetches", async () => {
      const s1 = createAppSettings({ organization_name: "V1" });
      const s2 = createAppSettings({ organization_name: "V2" });
      serverFnMocks.getAppSettings.mockResolvedValueOnce(s1).mockResolvedValueOnce(s2);

      const { result } = renderHook(() => useAdminAppSettings(adminAuth));

      await waitFor(() => {
        expect(result.current.loadingSettings).toBe(false);
      });
      expect(result.current.settings).toEqual(s1);

      await act(async () => {
        await result.current.loadAppSettings();
      });

      expect(result.current.settings).toEqual(s2);
    });
  });

  // ── Form reset ───────────────────────────────────────────────────────

  describe("form reset on settings change", () => {
    it("resets form values when settings are loaded", async () => {
      const settings = createAppSettings({
        organization_name: "TestOrg",
        max_devices_per_technician: 25,
        self_registration_enabled: true,
        os_options: ["Linux"],
        wip_limits: {
          pending: 10,
          "in-progress": 3,
          testing: 2,
          ready: 15,
          completed: 0,
          archived: 0,
        },
      });
      serverFnMocks.getAppSettings.mockResolvedValue(settings);

      const { result } = renderHook(() => useAdminAppSettings(adminAuth));

      await waitFor(() => {
        expect(result.current.loadingSettings).toBe(false);
      });

      expect(result.current.settingsForm.getValues("organization_name")).toBe("TestOrg");
      expect(result.current.settingsForm.getValues("max_devices_per_technician")).toBe(25);
      expect(result.current.settingsForm.getValues("self_registration_enabled")).toBe(true);
      expect(result.current.settingsForm.getValues("os_options")).toEqual(["Linux"]);
      expect(result.current.settingsForm.getValues("wip_limits.pending")).toBe(10);
    });
  });

  // ── submitSettings ───────────────────────────────────────────────────

  describe("submitSettings", () => {
    it("guards when accessToken is undefined", async () => {
      const { result } = renderHook(() => useAdminAppSettings(noAuth));

      await act(async () => {
        await result.current.submitSettings(result.current.settingsForm.getValues());
      });

      expect(serverFnMocks.updateAppSettings).not.toHaveBeenCalled();
    });

    it("saves settings, sets busy, and shows success toast", async () => {
      const settings = createAppSettings();
      serverFnMocks.getAppSettings.mockResolvedValue(settings);
      serverFnMocks.updateAppSettings.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(undefined), 50)),
      );

      const { result } = renderHook(() => useAdminAppSettings(adminAuth));

      await waitFor(() => {
        expect(result.current.loadingSettings).toBe(false);
      });

      act(() => {
        result.current.submitSettings(result.current.settingsForm.getValues());
      });

      expect(result.current.saveSettingsBusy).toBe(true);

      await act(async () => {
        await new Promise((r) => setTimeout(r, 100));
      });

      expect(serverFnMocks.updateAppSettings).toHaveBeenCalled();
      expect(toastMock.success).toHaveBeenCalledWith("Impostazioni salvate");
      expect(result.current.settings?.organization_name).toBe("PCReady");
      expect(result.current.saveSettingsBusy).toBe(false);
    });

    it("shows error toast on save failure", async () => {
      serverFnMocks.updateAppSettings.mockRejectedValue(new Error("Save error"));
      const settings = createAppSettings();
      serverFnMocks.getAppSettings.mockResolvedValue(settings);

      const { result } = renderHook(() => useAdminAppSettings(adminAuth));

      await waitFor(() => {
        expect(result.current.loadingSettings).toBe(false);
      });

      await act(async () => {
        await result.current.submitSettings(result.current.settingsForm.getValues());
      });

      expect(toastMock.error).toHaveBeenCalled();
      expect(result.current.saveSettingsBusy).toBe(false);
    });
  });

  // ── handleExportAllData ──────────────────────────────────────────────

  describe("handleExportAllData", () => {
    it("guards when accessToken is undefined", async () => {
      const { result } = renderHook(() => useAdminAppSettings(noAuth));

      await act(async () => {
        await result.current.handleExportAllData();
      });

      expect(serverFnMocks.exportAllData).not.toHaveBeenCalled();
    });

    it("exports all data, sets busy, and triggers zip download with correct args", async () => {
      const exportResult = createExportResult();
      serverFnMocks.exportAllData.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(exportResult), 50)),
      );
      downloadMocks.buildDownloadFileName.mockReturnValue("pcready-export.zip");
      const settings = createAppSettings();
      serverFnMocks.getAppSettings.mockResolvedValue(settings);

      const { result } = renderHook(() => useAdminAppSettings(adminAuth));

      await waitFor(() => {
        expect(result.current.loadingSettings).toBe(false);
      });

      act(() => {
        result.current.handleExportAllData();
      });

      expect(result.current.exportAllBusy).toBe(true);

      await act(async () => {
        await new Promise((r) => setTimeout(r, 100));
      });

      expect(serverFnMocks.exportAllData).toHaveBeenCalledWith({
        data: { accessToken: "token-123" },
      });
      // Verify zip file mapping from export result
      const zipArgs = downloadMocks.downloadZip.mock.calls[0];
      expect(zipArgs[0]).toEqual([{ name: "tickets.csv", content: "id,name\n1,test" }]);
      expect(zipArgs[1]).toBe("pcready-export.zip");
      expect(toastMock.success).toHaveBeenCalledWith("Export completo generato");
      expect(result.current.exportAllBusy).toBe(false);
    });

    it("shows error toast on export failure", async () => {
      serverFnMocks.exportAllData.mockRejectedValue(new Error("Export error"));
      const settings = createAppSettings();
      serverFnMocks.getAppSettings.mockResolvedValue(settings);

      const { result } = renderHook(() => useAdminAppSettings(adminAuth));

      await waitFor(() => {
        expect(result.current.loadingSettings).toBe(false);
      });

      await act(async () => {
        await result.current.handleExportAllData();
      });

      expect(toastMock.error).toHaveBeenCalled();
      expect(result.current.exportAllBusy).toBe(false);
    });
  });
});
