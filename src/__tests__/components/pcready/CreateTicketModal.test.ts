// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  contactName,
  clientOption,
  contactOption,
  deviceOption,
  optionToClient,
  optionToContact,
  optionToDevice,
  mapClientRowToOption,
  mapContactRowToOption,
  mapDeviceRowToOption,
  extractChecklistSectionAssignees,
  type TplOpt,
} from "@/components/pcready/CreateTicketModal";
import type { AsyncAutocompleteOption } from "@/components/pcready/AsyncAutocomplete";

// ── Helpers ──────────────────────────────────────────────────────────────

interface ClientOpt {
  id: string;
  name: string;
  company_name: string | null;
  email?: string | null;
}

interface ContactOpt {
  id: string;
  client_id: string;
  full_name: string | null;
  first_name: string;
  last_name: string | null;
  email: string | null;
  job_title: string | null;
  role: string | null;
  is_primary: boolean;
}

interface DeviceOpt {
  id: string;
  client_id: string;
  model: string;
  serial: string | null;
  os: string | null;
  assigned_to: string | null;
}

// ── contactName ──────────────────────────────────────────────────────────

describe("contactName", () => {
  it("returns full_name when present", () => {
    const c: ContactOpt = {
      id: "1",
      client_id: "c1",
      full_name: "Marco Gastaldello",
      first_name: "Marco",
      last_name: "Gastaldello",
      email: null,
      job_title: null,
      role: null,
      is_primary: false,
    };
    expect(contactName(c)).toBe("Marco Gastaldello");
  });

  it("joins first_name + last_name when full_name is absent", () => {
    const c: ContactOpt = {
      id: "1",
      client_id: "c1",
      full_name: null,
      first_name: "Marco",
      last_name: "Gastaldello",
      email: null,
      job_title: null,
      role: null,
      is_primary: false,
    };
    expect(contactName(c)).toBe("Marco Gastaldello");
  });

  it("uses only first_name when last_name is null", () => {
    const c: ContactOpt = {
      id: "1",
      client_id: "c1",
      full_name: null,
      first_name: "Marco",
      last_name: null,
      email: null,
      job_title: null,
      role: null,
      is_primary: false,
    };
    expect(contactName(c)).toBe("Marco");
  });

  it("returns empty string when all name fields are empty", () => {
    const c: ContactOpt = {
      id: "1",
      client_id: "c1",
      full_name: null,
      first_name: "",
      last_name: null,
      email: null,
      job_title: null,
      role: null,
      is_primary: false,
    };
    expect(contactName(c)).toBe("");
  });

  it("favors full_name over first+last when both present", () => {
    const c: ContactOpt = {
      id: "1",
      client_id: "c1",
      full_name: "M. Gastaldello",
      first_name: "Marco",
      last_name: "Gastaldello",
      email: null,
      job_title: null,
      role: null,
      is_primary: false,
    };
    expect(contactName(c)).toBe("M. Gastaldello");
  });
});

// ── clientOption ─────────────────────────────────────────────────────────

describe("clientOption", () => {
  it("builds option with company_name as label", () => {
    const client: ClientOpt = {
      id: "c1",
      name: "azienda",
      company_name: "ACME S.p.A.",
      email: "info@acme.it",
    };
    const opt = clientOption(client);
    expect(opt.value).toBe("c1");
    expect(opt.label).toBe("ACME S.p.A.");
    expect(opt.description).toBe("info@acme.it");
    expect(opt.client).toBe(client);
  });

  it("falls back to name when company_name is null", () => {
    const client: ClientOpt = {
      id: "c2",
      name: "Studio Rossi",
      company_name: null,
    };
    const opt = clientOption(client);
    expect(opt.label).toBe("Studio Rossi");
    expect(opt.description).toBeUndefined();
  });

  it("falls back to 'Cliente' when company_name and name are empty", () => {
    const client: ClientOpt = {
      id: "c3",
      name: "",
      company_name: null,
    };
    const opt = clientOption(client);
    // (null || "" || "Cliente").trim() || "Cliente" = "Cliente"
    expect(opt.label).toBe("Cliente");
  });
});

// ── contactOption ────────────────────────────────────────────────────────

describe("contactOption", () => {
  it("builds option with contact name and email", () => {
    const contact: ContactOpt = {
      id: "1",
      client_id: "c1",
      full_name: "Anna Bianchi",
      first_name: "Anna",
      last_name: "Bianchi",
      email: "anna@test.it",
      job_title: "CEO",
      role: "admin",
      is_primary: true,
    };
    const opt = contactOption(contact);
    expect(opt.value).toBe("1");
    expect(opt.label).toBe("Anna Bianchi");
    expect(opt.description).toBe("anna@test.it");
    expect(opt.contact).toBe(contact);
  });

  it("falls back to job_title for description when email is null", () => {
    const contact: ContactOpt = {
      id: "2",
      client_id: "c1",
      full_name: null,
      first_name: "Mario",
      last_name: "Rossi",
      email: null,
      job_title: "Manager",
      role: null,
      is_primary: false,
    };
    const opt = contactOption(contact);
    expect(opt.description).toBe("Manager");
  });

  it("falls back to role when email and job_title are null", () => {
    const contact: ContactOpt = {
      id: "3",
      client_id: "c1",
      full_name: null,
      first_name: "Luigi",
      last_name: "Verdi",
      email: null,
      job_title: null,
      role: "support",
      is_primary: false,
    };
    const opt = contactOption(contact);
    expect(opt.description).toBe("support");
  });

  it("falls back to 'Referente' when contact has no name", () => {
    const contact: ContactOpt = {
      id: "4",
      client_id: "c1",
      full_name: null,
      first_name: "",
      last_name: null,
      email: null,
      job_title: null,
      role: null,
      is_primary: false,
    };
    const opt = contactOption(contact);
    // contactName returns "", "" || "Referente" = "Referente"
    expect(opt.label).toBe("Referente");
  });
});

// ── deviceOption ─────────────────────────────────────────────────────────

describe("deviceOption", () => {
  it("builds option with model and serial", () => {
    const device: DeviceOpt = {
      id: "d1",
      client_id: "c1",
      model: "ThinkPad T14",
      serial: "SN12345",
      os: "Windows 11 Pro",
      assigned_to: "Marco",
    };
    const opt = deviceOption(device);
    expect(opt.value).toBe("d1");
    expect(opt.label).toBe("ThinkPad T14 - SN12345");
    expect(opt.description).toBe("Marco");
    expect(opt.device).toBe(device);
  });

  it("omits serial from label when serial is null", () => {
    const device: DeviceOpt = {
      id: "d2",
      client_id: "c1",
      model: "MacBook Pro",
      serial: null,
      os: "macOS",
      assigned_to: null,
    };
    const opt = deviceOption(device);
    expect(opt.label).toBe("MacBook Pro");
  });

  it("falls back to os for description when assigned_to is null", () => {
    const device: DeviceOpt = {
      id: "d3",
      client_id: "c1",
      model: "Dell XPS",
      serial: null,
      os: "Ubuntu 22.04",
      assigned_to: null,
    };
    const opt = deviceOption(device);
    expect(opt.description).toBe("Ubuntu 22.04");
  });

  it("description is null when both assigned_to and os are null", () => {
    const device: DeviceOpt = {
      id: "d4",
      client_id: "c1",
      model: "HP EliteBook",
      serial: null,
      os: null,
      assigned_to: null,
    };
    const opt = deviceOption(device);
    expect(opt.description).toBeNull();
  });
});

// ── optionToClient / optionToContact / optionToDevice ────────────────────

describe("optionToClient", () => {
  it("extracts client from a ClientOption", () => {
    const client: ClientOpt = {
      id: "c1",
      name: "Test",
      company_name: "Test S.p.A.",
    };
    const option = clientOption(client);
    expect(optionToClient(option as AsyncAutocompleteOption)).toBe(client);
  });
});

describe("optionToContact", () => {
  it("extracts contact from a ContactOption", () => {
    const contact: ContactOpt = {
      id: "1",
      client_id: "c1",
      full_name: "Test User",
      first_name: "Test",
      last_name: "User",
      email: null,
      job_title: null,
      role: null,
      is_primary: false,
    };
    const option = contactOption(contact);
    expect(optionToContact(option as AsyncAutocompleteOption)).toBe(contact);
  });
});

describe("optionToDevice", () => {
  it("extracts device from a DeviceOption", () => {
    const device: DeviceOpt = {
      id: "d1",
      client_id: "c1",
      model: "Test Device",
      serial: null,
      os: null,
      assigned_to: null,
    };
    const option = deviceOption(device);
    expect(optionToDevice(option as AsyncAutocompleteOption)).toBe(device);
  });
});

// ── Autocomplete mapping functions ───────────────────────────────────────

describe("mapClientRowToOption", () => {
  it("maps a Supabase row to ClientOption", () => {
    const row = { id: "c1", name: "azienda", company_name: "ACME S.p.A.", email: "info@acme.it" };
    const opt = mapClientRowToOption(row);
    expect(opt.value).toBe("c1");
    expect(opt.label).toBe("ACME S.p.A.");
    expect(opt.description).toBe("info@acme.it");
    expect(opt.client.id).toBe("c1");
  });

  it("falls back to name when company_name is null", () => {
    const row = { id: "c2", name: "Studio", company_name: null, email: null };
    expect(mapClientRowToOption(row).label).toBe("Studio");
  });

  it("falls back to 'Cliente' when both name and company_name missing", () => {
    const row = { id: "c3", name: null, company_name: null, email: null };
    expect(mapClientRowToOption(row).label).toBe("Cliente");
  });

  it("handles missing email", () => {
    const row = { id: "c4", name: "Test", company_name: null };
    expect(mapClientRowToOption(row).description).toBeUndefined();
  });
});

describe("mapContactRowToOption", () => {
  it("maps a Supabase row to ContactOption", () => {
    const row = {
      id: "1", client_id: "c1", full_name: "Mario Rossi",
      first_name: "Mario", last_name: "Rossi", email: "mario@test.it",
      job_title: "CEO", role: "admin", is_primary: true,
    };
    const opt = mapContactRowToOption(row);
    expect(opt.value).toBe("1");
    expect(opt.label).toBe("Mario Rossi");
    expect(opt.description).toBe("mario@test.it");
  });

  it("falls back to job_title for description", () => {
    const row = {
      id: "2", client_id: "c1", full_name: "Anna",
      first_name: "Anna", last_name: "B", email: null,
      job_title: "Manager", role: null, is_primary: false,
    };
    expect(mapContactRowToOption(row).description).toBe("Manager");
  });

  it("falls back to 'Referente' label when no name", () => {
    const row = {
      id: "3", client_id: "c1", full_name: null,
      first_name: "", last_name: null, email: null,
      job_title: null, role: null, is_primary: false,
    };
    expect(mapContactRowToOption(row).label).toBe("Referente");
  });
});

describe("mapDeviceRowToOption", () => {
  it("maps a Supabase row to DeviceOption", () => {
    const row = {
      id: "d1", client_id: "c1", model: "ThinkPad T14",
      serial: "SN123", os: "Windows 11", assigned_to: "Marco",
    };
    const opt = mapDeviceRowToOption(row);
    expect(opt.value).toBe("d1");
    expect(opt.label).toBe("ThinkPad T14 - SN123");
  });

  it("omits serial from label when null", () => {
    const row = { id: "d2", client_id: "c1", model: "MacBook", serial: null, os: null, assigned_to: null };
    expect(mapDeviceRowToOption(row).label).toBe("MacBook");
  });
});

// ── Checklist section extraction ─────────────────────────────────────────

describe("extractChecklistSectionAssignees", () => {
  it("returns empty map for empty templates", () => {
    expect(extractChecklistSectionAssignees([]).size).toBe(0);
  });

  it("extracts assigned sections", () => {
    const tpls: TplOpt[] = [{
      id: "t1", name: "Checklist 1", is_default: true,
      structure: {
        group1: { label: "Group 1", sections: {
            s1: { label: "Sezione A", assigned_to: "user-1", items: [] as any },
            s2: { label: "Sezione B", assigned_to: "user-1", items: [] as any },
          },
        },
      },
    }];
    const result = extractChecklistSectionAssignees(tpls);
    expect(result.get("user-1")).toEqual(["Checklist 1: Sezione A", "Checklist 1: Sezione B"]);
  });

  it("skips sections without assigned_to", () => {
    const tpls: TplOpt[] = [{
      id: "t1", name: "T1", is_default: true,
      structure: {
        group1: { label: "Group 1", sections: {
            s1: { label: "Unassigned", items: [] as any },
            s2: { label: "Assigned", assigned_to: "user-1", items: [] as any },
          },
        },
      },
    }];
    const result = extractChecklistSectionAssignees(tpls);
    expect(result.get("user-1")).toHaveLength(1);
  });

  it("handles templates with no structure", () => {
    const tpls: TplOpt[] = [{ id: "t1", name: "T1", is_default: true, structure: {} as any }];
    expect(extractChecklistSectionAssignees(tpls).size).toBe(0);
  });
});
