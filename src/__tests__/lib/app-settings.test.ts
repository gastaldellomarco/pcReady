import { describe, expect, it } from "vitest";
import {
  mergeAppSettingsRows,
  validateAppSettingsInput,
  DEFAULT_WIP_LIMITS,
} from "@/lib/app-settings";
import {
  DEFAULT_SLA_LIMITS,
  DEFAULT_SLA_CONFIG,
} from "@/lib/pcready";

// ── helpers ─────────────────────────────────────────────────────────

const DEFAULT_ORG = "PCReady";
const DEFAULT_TZ = "Europe/Rome";
const DEFAULT_MAX_DEVICES = 10;

// ── mergeAppSettingsRows ────────────────────────────────────────────

describe("mergeAppSettingsRows", () => {
  describe("empty / default", () => {
    it("returns DEFAULT_SETTINGS when rows is empty", () => {
      const result = mergeAppSettingsRows([]);

      expect(result.organization_name).toBe(DEFAULT_ORG);
      expect(result.default_timezone).toBe(DEFAULT_TZ);
      expect(result.max_devices_per_technician).toBe(DEFAULT_MAX_DEVICES);
      expect(result.self_registration_enabled).toBe(false);
      expect(result.admin_approval_required).toBe(true);
      expect(result.archive_after_days).toBe(7);
      expect(result.log_retention_days).toBe(365);
    });

    it("returns all DEFAULT_SETTINGS keys", () => {
      const result = mergeAppSettingsRows([]);

      // Spot-check a representative subset of keys
      expect(result).toHaveProperty("organization_name");
      expect(result).toHaveProperty("default_timezone");
      expect(result).toHaveProperty("max_devices_per_technician");
      expect(result).toHaveProperty("wip_limits");
      expect(result).toHaveProperty("sla_limits");
      expect(result).toHaveProperty("sla_config");
      expect(result).toHaveProperty("os_options");
      expect(result).toHaveProperty("device_brands");
      expect(result).toHaveProperty("ticket_categories");
      expect(result).toHaveProperty("kanban_column_colors");
      expect(result).toHaveProperty("kanban_column_notes");
      expect(result).toHaveProperty("mfa_require_admin_users");
      expect(result).toHaveProperty("mfa_require_all_users");
      expect(result).toHaveProperty("mfa_grace_period_days");
    });
  });

  describe("scalar overrides", () => {
    it("overrides a single scalar setting", () => {
      const result = mergeAppSettingsRows([
        { key: "organization_name", value: "MioLab" },
      ]);

      expect(result.organization_name).toBe("MioLab");
      // Everything else stays at defaults
      expect(result.default_timezone).toBe(DEFAULT_TZ);
    });

    it("overrides multiple scalar settings from separate rows", () => {
      const result = mergeAppSettingsRows([
        { key: "organization_name", value: "MioLab" },
        { key: "max_devices_per_technician", value: 25 },
        { key: "archive_after_days", value: 30 },
      ]);

      expect(result.organization_name).toBe("MioLab");
      expect(result.max_devices_per_technician).toBe(25);
      expect(result.archive_after_days).toBe(30);
    });

    it("overrides boolean settings", () => {
      const result = mergeAppSettingsRows([
        { key: "self_registration_enabled", value: true },
        { key: "admin_approval_required", value: false },
      ]);

      expect(result.self_registration_enabled).toBe(true);
      expect(result.admin_approval_required).toBe(false);
    });
  });

  describe("JSON parsing", () => {
    it("parses JSON strings for object values", () => {
      const wipJson = JSON.stringify({
        pending: 10,
        "in-progress": 3,
        testing: 2,
        ready: 5,
        completed: 0,
        archived: 0,
      });

      const result = mergeAppSettingsRows([
        { key: "wip_limits", value: wipJson },
      ]);

      expect(result.wip_limits).toEqual({
        pending: 10,
        "in-progress": 3,
        testing: 2,
        ready: 5,
        completed: 0,
        archived: 0,
      });
    });

    it("parses JSON strings for array values", () => {
      const brandsJson = JSON.stringify(["Dell", "HP", "CustomBrand"]);

      const result = mergeAppSettingsRows([
        { key: "device_brands", value: brandsJson },
      ]);

      expect(result.device_brands).toEqual(["Dell", "HP", "CustomBrand"]);
    });

    it("falls back to raw value when JSON.parse fails", () => {
      // A plain string value for a string field
      const result = mergeAppSettingsRows([
        { key: "organization_name", value: "MyCorp" },
      ]);

      // The value is a plain string, JSON.parse("MyCorp") would throw,
      // the catch block uses raw value
      expect(result.organization_name).toBe("MyCorp");
    });

    it("handles already-parsed (non-string) values", () => {
      const result = mergeAppSettingsRows([
        { key: "max_devices_per_technician", value: 42 }, // number, not string
      ]);

      expect(result.max_devices_per_technician).toBe(42);
    });
  });

  describe("unknown keys", () => {
    it("ignores keys not present in AppSettings", () => {
      const result = mergeAppSettingsRows([
        { key: "organization_name", value: "MyCorp" },
        { key: "non_existent_key", value: "should be ignored" },
      ]);

      expect(result.organization_name).toBe("MyCorp");
      // The unknown key should not appear as a property
      expect((result as Record<string, unknown>).non_existent_key).toBeUndefined();
    });

    it("ignores all rows when none match known keys", () => {
      const result = mergeAppSettingsRows([
        { key: "foo", value: "bar" },
        { key: "baz", value: 123 },
      ]);

      // Should be identical to DEFAULT_SETTINGS
      expect(result.organization_name).toBe(DEFAULT_ORG);
      expect(result.default_timezone).toBe(DEFAULT_TZ);
    });
  });

  describe("sla_config / sla_limits derivation", () => {
    it("derives sla_limits from sla_config when sla_config is present", () => {
      const customSlaConfig = JSON.stringify({
        high: { responseHours: 1, resolutionHours: 4 },
        med: { responseHours: 4, resolutionHours: 24 },
        low: { responseHours: 24, resolutionHours: 72 },
      });

      const result = mergeAppSettingsRows([
        { key: "sla_config", value: customSlaConfig },
      ]);

      // sla_limits should be derived from sla_config
      expect(result.sla_config).toEqual({
        high: { responseHours: 1, resolutionHours: 4 },
        med: { responseHours: 4, resolutionHours: 24 },
        low: { responseHours: 24, resolutionHours: 72 },
      });
      // sla_limits.high = sla_config.high.resolutionHours
      expect(result.sla_limits.high).toBe(4);
      expect(result.sla_limits.med).toBe(24);
      expect(result.sla_limits.low).toBe(72);
    });

    it("derives sla_config from sla_limits when sla_limits is present but sla_config is not", () => {
      const customSlaLimits = JSON.stringify({ high: 8, med: 48, low: 120 });

      const result = mergeAppSettingsRows([
        { key: "sla_limits", value: customSlaLimits },
      ]);

      // sla_limits should be the custom values
      expect(result.sla_limits).toEqual({ high: 8, med: 48, low: 120 });
      // sla_config should be derived from sla_limits (resolutionHours)
      expect(result.sla_config.high.resolutionHours).toBe(8);
      expect(result.sla_config.med.resolutionHours).toBe(48);
      expect(result.sla_config.low.resolutionHours).toBe(120);
      // responseHours should come from DEFAULT_SLA_CONFIG
      expect(result.sla_config.high.responseHours).toBe(DEFAULT_SLA_CONFIG.high.responseHours);
    });

    it("when both sla_config and sla_limits are present, sla_config wins", () => {
      const customConfig = JSON.stringify({
        high: { responseHours: 2, resolutionHours: 6 },
        med: { responseHours: 8, resolutionHours: 48 },
        low: { responseHours: 48, resolutionHours: 96 },
      });

      const result = mergeAppSettingsRows([
        { key: "sla_config", value: customConfig },
        { key: "sla_limits", value: JSON.stringify({ high: 99, med: 99, low: 99 }) },
      ]);

      // sla_limits is derived from sla_config, overriding the explicit sla_limits
      expect(result.sla_limits.high).toBe(6);
      expect(result.sla_limits.med).toBe(48);
      expect(result.sla_limits.low).toBe(96);
    });

    it("default sla_limits match DEFAULT_SLA_LIMITS when no overrides", () => {
      const result = mergeAppSettingsRows([]);

      expect(result.sla_limits).toEqual(DEFAULT_SLA_LIMITS);
      expect(result.sla_config).toEqual(DEFAULT_SLA_CONFIG);
    });
  });

  describe("supports all AppSettings keys", () => {
    it("merges support_email", () => {
      const result = mergeAppSettingsRows([
        { key: "support_email", value: "help@example.com" },
      ]);
      expect(result.support_email).toBe("help@example.com");
    });

    it("merges log_retention_days", () => {
      const result = mergeAppSettingsRows([
        { key: "log_retention_days", value: 180 },
      ]);
      expect(result.log_retention_days).toBe(180);
    });

    it("merges os_options array", () => {
      const result = mergeAppSettingsRows([
        { key: "os_options", value: JSON.stringify(["Windows 11", "Ubuntu"]) },
      ]);
      expect(result.os_options).toEqual(["Windows 11", "Ubuntu"]);
    });

    it("merges ticket_categories array", () => {
      const result = mergeAppSettingsRows([
        { key: "ticket_categories", value: JSON.stringify(["Hardware", "Software"]) },
      ]);
      expect(result.ticket_categories).toEqual(["Hardware", "Software"]);
    });

    it("merges kanban_column_colors", () => {
      const result = mergeAppSettingsRows([
        { key: "kanban_column_colors", value: JSON.stringify({ pending: "#ff0000" }) },
      ]);
      expect(result.kanban_column_colors).toEqual({ pending: "#ff0000" });
    });

    it("merges mfa settings", () => {
      const result = mergeAppSettingsRows([
        { key: "mfa_require_admin_users", value: true },
        { key: "mfa_require_all_users", value: false },
        { key: "mfa_grace_period_days", value: 14 },
      ]);
      expect(result.mfa_require_admin_users).toBe(true);
      expect(result.mfa_require_all_users).toBe(false);
      expect(result.mfa_grace_period_days).toBe(14);
    });
  });
});

// ── validateAppSettingsInput ────────────────────────────────────────

describe("validateAppSettingsInput", () => {
  describe("valid input", () => {
    it("returns a full AppSettings object from empty input (merged with defaults)", () => {
      const result = validateAppSettingsInput({});

      expect(result.organization_name).toBe(DEFAULT_ORG);
      expect(result.default_timezone).toBe(DEFAULT_TZ);
      expect(result.wip_limits).toEqual(DEFAULT_WIP_LIMITS);
      expect(result.sla_limits).toEqual(DEFAULT_SLA_LIMITS);
      expect(result.sla_config).toEqual(DEFAULT_SLA_CONFIG);
    });

    it("accepts valid overrides on all key fields", () => {
      const result = validateAppSettingsInput({
        organization_name: "MyLab",
        default_timezone: "America/New_York",
        max_devices_per_technician: 20,
        self_registration_enabled: true,
        send_registration_email: false,
        admin_approval_required: false,
        support_email: "help@mylab.com",
        archive_after_days: 14,
        log_retention_days: 180,
        mfa_require_admin_users: true,
        mfa_grace_period_days: 30,
      });

      expect(result.organization_name).toBe("MyLab");
      expect(result.default_timezone).toBe("America/New_York");
      expect(result.max_devices_per_technician).toBe(20);
      expect(result.self_registration_enabled).toBe(true);
      expect(result.send_registration_email).toBe(false);
      expect(result.admin_approval_required).toBe(false);
      expect(result.archive_after_days).toBe(14);
      expect(result.log_retention_days).toBe(180);
      expect(result.mfa_require_admin_users).toBe(true);
      expect(result.mfa_grace_period_days).toBe(30);
    });

    it("accepts valid WIP limits", () => {
      const result = validateAppSettingsInput({
        wip_limits: {
          pending: 30,
          "in-progress": 10,
          testing: 5,
          ready: 15,
          completed: 0,
          archived: 0,
        },
      });

      expect(result.wip_limits.pending).toBe(30);
      expect(result.wip_limits["in-progress"]).toBe(10);
    });

    it("accepts valid SLA limits — but sla_limits is always derived from sla_config", () => {
      const result = validateAppSettingsInput({
        sla_config: {
          high: { responseHours: 1, resolutionHours: 8 },
          med: { responseHours: 4, resolutionHours: 48 },
          low: { responseHours: 24, resolutionHours: 120 },
        },
      });

      // sla_limits is derived from sla_config, NOT from any sla_limits input
      expect(result.sla_limits).toEqual({ high: 8, med: 48, low: 120 });
    });

    it("accepts valid SLA config and derives sla_limits from it", () => {
      const result = validateAppSettingsInput({
        sla_config: {
          high: { responseHours: 1, resolutionHours: 4 },
          med: { responseHours: 4, resolutionHours: 24 },
          low: { responseHours: 24, resolutionHours: 72 },
        },
      });

      expect(result.sla_limits.high).toBe(4);
      expect(result.sla_limits.med).toBe(24);
      expect(result.sla_limits.low).toBe(72);
    });

    it("accepts string arrays (os_options, device_brands, ticket_categories)", () => {
      const result = validateAppSettingsInput({
        os_options: ["Windows 11 Pro", "Ubuntu 24.04"],
        device_brands: ["Dell", "Framework"],
        ticket_categories: ["Hardware", "Network"],
      });

      expect(result.os_options).toEqual(["Windows 11 Pro", "Ubuntu 24.04"]);
      expect(result.device_brands).toEqual(["Dell", "Framework"]);
      expect(result.ticket_categories).toEqual(["Hardware", "Network"]);
    });
  });

  describe("validation errors", () => {
    it("throws when organization_name is empty", () => {
      expect(() => validateAppSettingsInput({ organization_name: "" })).toThrow();
    });

    it("throws when max_devices_per_technician is 0", () => {
      expect(() => validateAppSettingsInput({ max_devices_per_technician: 0 })).toThrow();
    });

    it("throws when max_devices_per_technician exceeds 100", () => {
      expect(() => validateAppSettingsInput({ max_devices_per_technician: 101 })).toThrow();
    });

    it("throws when wip_limits has negative values", () => {
      expect(() =>
        validateAppSettingsInput({
          wip_limits: { pending: -1, "in-progress": 5, testing: 5, ready: 10, completed: 0, archived: 0 },
        }),
      ).toThrow();
    });

    it("throws when wip_limits exceeds 999", () => {
      expect(() =>
        validateAppSettingsInput({
          wip_limits: { pending: 1000, "in-progress": 5, testing: 5, ready: 10, completed: 0, archived: 0 },
        }),
      ).toThrow();
    });

    it("throws when sla_config has values < 1", () => {
      expect(() =>
        validateAppSettingsInput({
          sla_config: {
            high: { responseHours: 0, resolutionHours: 4 },
            med: { responseHours: 4, resolutionHours: 24 },
            low: { responseHours: 24, resolutionHours: 72 },
          },
        }),
      ).toThrow();
    });

    it("throws when sla_config exceeds 999", () => {
      expect(() =>
        validateAppSettingsInput({
          sla_config: {
            high: { responseHours: 1000, resolutionHours: 4 },
            med: { responseHours: 4, resolutionHours: 24 },
            low: { responseHours: 24, resolutionHours: 72 },
          },
        }),
      ).toThrow();
    });

    it("throws when archive_after_days is negative", () => {
      expect(() => validateAppSettingsInput({ archive_after_days: -1 })).toThrow();
    });

    it("throws when archive_after_days exceeds 365", () => {
      expect(() => validateAppSettingsInput({ archive_after_days: 366 })).toThrow();
    });

    it("throws when log_retention_days is below 30", () => {
      expect(() => validateAppSettingsInput({ log_retention_days: 29 })).toThrow();
    });

    it("throws when log_retention_days exceeds 730", () => {
      expect(() => validateAppSettingsInput({ log_retention_days: 731 })).toThrow();
    });
  });

  describe("email validation", () => {
    it("transforms email to lowercase", () => {
      const result = validateAppSettingsInput({
        support_email: "Help@Example.COM",
      });

      expect(result.support_email).toBe("help@example.com");
    });

    it("trims whitespace from email", () => {
      const result = validateAppSettingsInput({
        support_email: "  help@example.com  ",
      });

      expect(result.support_email).toBe("help@example.com");
    });

    it("throws on invalid email format", () => {
      expect(() =>
        validateAppSettingsInput({ support_email: "not-an-email" }),
      ).toThrow();
    });

    it("throws on email without domain", () => {
      expect(() =>
        validateAppSettingsInput({ support_email: "user@" }),
      ).toThrow();
    });

    it("allows empty support_email (optional field)", () => {
      const result = validateAppSettingsInput({ support_email: "" });

      // Empty string passes validation (the refine only checks non-empty values)
      expect(result.support_email).toBe("");
    });
  });

  describe("boundary values", () => {
    it("accepts max_devices_per_technician at minimum (1)", () => {
      const result = validateAppSettingsInput({ max_devices_per_technician: 1 });
      expect(result.max_devices_per_technician).toBe(1);
    });

    it("accepts max_devices_per_technician at maximum (100)", () => {
      const result = validateAppSettingsInput({ max_devices_per_technician: 100 });
      expect(result.max_devices_per_technician).toBe(100);
    });

    it("accepts archive_after_days at minimum (0)", () => {
      const result = validateAppSettingsInput({ archive_after_days: 0 });
      expect(result.archive_after_days).toBe(0);
    });

    it("accepts archive_after_days at maximum (365)", () => {
      const result = validateAppSettingsInput({ archive_after_days: 365 });
      expect(result.archive_after_days).toBe(365);
    });

    it("accepts log_retention_days at minimum (30)", () => {
      const result = validateAppSettingsInput({ log_retention_days: 30 });
      expect(result.log_retention_days).toBe(30);
    });

    it("accepts log_retention_days at maximum (730)", () => {
      const result = validateAppSettingsInput({ log_retention_days: 730 });
      expect(result.log_retention_days).toBe(730);
    });

    it("accepts sla_limits at minimum (1) — derived from sla_config", () => {
      const result = validateAppSettingsInput({
        sla_config: {
          high: { responseHours: 1, resolutionHours: 1 },
          med: { responseHours: 1, resolutionHours: 1 },
          low: { responseHours: 1, resolutionHours: 1 },
        },
      });

      expect(result.sla_limits).toEqual({ high: 1, med: 1, low: 1 });
    });

    it("accepts sla_limits at maximum (999) — derived from sla_config", () => {
      const result = validateAppSettingsInput({
        sla_config: {
          high: { responseHours: 999, resolutionHours: 999 },
          med: { responseHours: 999, resolutionHours: 999 },
          low: { responseHours: 999, resolutionHours: 999 },
        },
      });

      expect(result.sla_limits).toEqual({ high: 999, med: 999, low: 999 });
    });

    it("accepts mfa_grace_period_days at 0", () => {
      const result = validateAppSettingsInput({ mfa_grace_period_days: 0 });
      expect(result.mfa_grace_period_days).toBe(0);
    });

    it("accepts mfa_grace_period_days at 365", () => {
      const result = validateAppSettingsInput({ mfa_grace_period_days: 365 });
      expect(result.mfa_grace_period_days).toBe(365);
    });
  });

  describe("kanban settings", () => {
    it("accepts kanban column colors", () => {
      const result = validateAppSettingsInput({
        kanban_column_colors: { pending: "#ffcc00", "in-progress": "#0099ff" },
      });

      expect(result.kanban_column_colors).toEqual({
        pending: "#ffcc00",
        "in-progress": "#0099ff",
      });
    });

    it("accepts kanban column notes", () => {
      const result = validateAppSettingsInput({
        kanban_column_notes: { pending: "In attesa", "in-progress": "In lavorazione" },
      });

      expect(result.kanban_column_notes.pending).toBe("In attesa");
    });
  });

  describe("device deprecation", () => {
    it("accepts device_deprecation_max_age_years", () => {
      const result = validateAppSettingsInput({
        device_deprecation_max_age_years: 5,
      });

      expect(result.device_deprecation_max_age_years).toBe(5);
    });

    it("throws when device_deprecation_max_age_years < 1", () => {
      expect(() =>
        validateAppSettingsInput({ device_deprecation_max_age_years: 0 }),
      ).toThrow();
    });

    it("throws when device_deprecation_max_age_years > 20", () => {
      expect(() =>
        validateAppSettingsInput({ device_deprecation_max_age_years: 21 }),
      ).toThrow();
    });

    it("accepts device_deprecation_max_tickets_12m", () => {
      const result = validateAppSettingsInput({
        device_deprecation_max_tickets_12m: 10,
      });

      expect(result.device_deprecation_max_tickets_12m).toBe(10);
    });

    it("throws when device_deprecation_max_tickets_12m < 1", () => {
      expect(() =>
        validateAppSettingsInput({ device_deprecation_max_tickets_12m: 0 }),
      ).toThrow();
    });
  });
});
