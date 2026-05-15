import { describe, expect, it } from "vitest";
import { mergeAppSettingsRows, validateAppSettingsInput } from "@/lib/app-settings";

describe("app settings", () => {
  it("merge ignores unknown keys", () => {
    const settings = mergeAppSettingsRows([{ key: "unknown_key", value: 1 }] as any);
    expect(settings.organization_name).toBe("PCReady");
  });

  it("merge uses raw value when JSON.parse fails", () => {
    const settings = mergeAppSettingsRows([{ key: "organization_name", value: "not-json" }]);
    expect(settings.organization_name).toBe("not-json");
  });

  it("merges persisted settings over defaults", () => {
    const settings = mergeAppSettingsRows([
      { key: "organization_name", value: '"ACME"' },
      { key: "max_devices_per_technician", value: "25" },
    ]);

    expect(settings.organization_name).toBe("ACME");
    expect(settings.max_devices_per_technician).toBe(25);
    expect(settings.default_timezone).toBe("Europe/Rome");
  });

  it("normalizes and validates updated settings", () => {
    const settings = validateAppSettingsInput({
      organization_name: "PCReady",
      log_retention_days: 90,
      default_timezone: "Europe/Rome",
      max_devices_per_technician: 10,
      self_registration_enabled: false,
      admin_approval_required: true,
      support_email: " SUPPORT@PCREADY.IT ",
      wip_limits: {
        pending: 20,
        "in-progress": 5,
        testing: 5,
        ready: 20,
        completed: 0,
        archived: 0,
      },
      sla_limits: {
        high: 4,
        med: 24,
        low: 72,
      },
      os_options: ["Windows 11 Pro", "Debian 12"],
      device_brands: ["Dell", "Framework"],
      ticket_categories: ["Preparazione"],
      archive_after_days: 7,
    });

    expect(settings.support_email).toBe("support@pcready.it");
  });

  it("rejects invalid support email", () => {
    expect(() =>
      validateAppSettingsInput({
        organization_name: "PCReady",
        default_timezone: "Europe/Rome",
        max_devices_per_technician: 10,
        self_registration_enabled: false,
        admin_approval_required: true,
        support_email: "not-an-email",
        wip_limits: {
          pending: 20,
          "in-progress": 5,
          testing: 5,
          ready: 20,
          completed: 0,
          archived: 0,
        },
        sla_limits: {
          high: 4,
          med: 24,
          low: 72,
        },
        os_options: ["Windows 11 Pro"],
        device_brands: ["Dell"],
        ticket_categories: [],
        archive_after_days: 7,
        log_retention_days: 90,
      }),
    ).toThrow();
  });
});
