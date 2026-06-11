// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Mock State ───────────────────────────────────────────────────────

const mockState = vi.hoisted(() => ({
  templatesData: null as any,
  templatesError: null as Error | null,
  instancesData: null as any,
  instancesError: null as Error | null,
  responsesData: null as any,
  responsesError: null as Error | null,
}));

// ── Thenable Builder ─────────────────────────────────────────────────

/** Creates a thenable that reads mockState at resolve time. */
function thenable(resolveData: () => { data: any; error: Error | null }) {
  const self: Record<string, any> = {};
  self.then = (resolve: any, reject: any) => {
    const { data, error } = resolveData();
    if (error) reject(error);
    else resolve({ data, error: null });
  };
  for (const m of ["select", "order", "eq", "not", "neq", "insert", "update", "upsert", "delete"]) {
    self[m] = () => self;
  }
  self.single = () => {
    const { data, error } = resolveData();
    return error ? Promise.reject(error) : Promise.resolve({ data, error: null });
  };
  self.maybeSingle = () => {
    const { data, error } = resolveData();
    return error ? Promise.reject(error) : Promise.resolve({ data, error: null });
  };
  return self;
}

vi.mock("@/integrations/supabase/client", () => {
  const resolvers: Record<string, () => { data: any; error: Error | null }> = {
    checklist_templates: () => ({ data: mockState.templatesData, error: mockState.templatesError }),
    ticket_checklist_instances: () => ({
      data: mockState.instancesData,
      error: mockState.instancesError,
    }),
    ticket_checklist_responses: () => ({
      data: mockState.responsesData,
      error: mockState.responsesError,
    }),
  };

  return {
    supabase: {
      from: vi.fn((table: string) => {
        const resolveFn = resolvers[table] ?? (() => ({ data: null, error: null }));
        return thenable(resolveFn);
      }),
    },
  };
});

// ── Helpers ──────────────────────────────────────────────────────────

async function importModule() {
  return await import("@/lib/data/checklist");
}

// ── Test Data ────────────────────────────────────────────────────────

const templateId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ticketId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const instanceId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const userId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const baseTemplate = {
  id: templateId,
  name: "Checklist PC",
  description: "Verifica hardware",
  structure: { system: { label: "Sistema", sections: {} } },
  is_default: false,
  tags: ["hardware"],
};

const baseInstance = {
  id: instanceId,
  ticket_id: ticketId,
  template_id: templateId,
  title: "Checklist PC",
  structure: { system: { label: "Sistema", sections: {} } },
  status: "pending",
  assigned_to: null,
  section_assignments: {},
  completed_by: null,
  completion_confirmed: false,
  signature_name: null,
  created_at: "2025-06-10T09:00:00.000Z",
  updated_at: "2025-06-10T09:00:00.000Z",
  completed_at: null,
  responses: [],
};

const baseResponse = {
  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  instance_id: instanceId,
  item_key: "system.sections.boot.checkbox_power",
  value: "true",
  compiled_by: userId,
  compiled_at: "2025-06-10T09:05:00.000Z",
};

// ── Tests ────────────────────────────────────────────────────────────

describe("data/checklist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.templatesData = null;
    mockState.templatesError = null;
    mockState.instancesData = null;
    mockState.instancesError = null;
    mockState.responsesData = null;
    mockState.responsesError = null;
  });

  // ── fetchChecklistTemplates ──────────────────────────────────────

  describe("fetchChecklistTemplates", () => {
    it("returns parsed templates", async () => {
      const { fetchChecklistTemplates } = await importModule();
      mockState.templatesData = [baseTemplate];

      const result = await fetchChecklistTemplates();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Checklist PC");
      expect(result[0].tags).toEqual(["hardware"]);
    });

    it("returns empty array on null data", async () => {
      const { fetchChecklistTemplates } = await importModule();
      mockState.templatesData = null;

      const result = await fetchChecklistTemplates();
      expect(result).toEqual([]);
    });

    it("defaults tags to empty array if missing", async () => {
      const { fetchChecklistTemplates } = await importModule();
      mockState.templatesData = [{ ...baseTemplate, tags: undefined }];

      const result = await fetchChecklistTemplates();
      expect(result[0].tags).toEqual([]);
    });

    it("throws on Supabase error", async () => {
      const { fetchChecklistTemplates } = await importModule();
      mockState.templatesError = new Error("Connection lost");

      await expect(fetchChecklistTemplates()).rejects.toThrow("Connection lost");
    });
  });

  // ── fetchTicketChecklistInstances ─────────────────────────────────

  describe("fetchTicketChecklistInstances", () => {
    it("returns mapped instances with responses", async () => {
      const { fetchTicketChecklistInstances } = await importModule();
      mockState.instancesData = [
        {
          ...baseInstance,
          responses: [baseResponse],
        },
      ];

      const result = await fetchTicketChecklistInstances(ticketId);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Checklist PC");
      expect(result[0].responses).toHaveLength(1);
    });

    it("returns empty array when ticketId is empty", async () => {
      const { fetchTicketChecklistInstances } = await importModule();
      // Shouldn't even call supabase
      const result = await fetchTicketChecklistInstances("");
      expect(result).toEqual([]);
    });

    it("returns empty array on null data", async () => {
      const { fetchTicketChecklistInstances } = await importModule();
      mockState.instancesData = null;

      const result = await fetchTicketChecklistInstances(ticketId);
      expect(result).toEqual([]);
    });

    it("throws on error", async () => {
      const { fetchTicketChecklistInstances } = await importModule();
      mockState.instancesError = new Error("DB error");

      await expect(fetchTicketChecklistInstances(ticketId)).rejects.toThrow("DB error");
    });
  });

  // ── fetchTemplateCompletionStats ──────────────────────────────────

  describe("fetchTemplateCompletionStats", () => {
    it("returns completion stats", async () => {
      const { fetchTemplateCompletionStats } = await importModule();
      mockState.instancesData = [
        { template_id: templateId, status: "completed" },
        { template_id: templateId, status: "pending" },
        { template_id: templateId, status: "completed" },
      ];

      const result = await fetchTemplateCompletionStats();
      expect(result[templateId]).toEqual({ total: 3, completed: 2 });
    });

    it("returns empty object on null data", async () => {
      const { fetchTemplateCompletionStats } = await importModule();
      mockState.instancesData = null;

      const result = await fetchTemplateCompletionStats();
      expect(result).toEqual({});
    });

    it("throws on error", async () => {
      const { fetchTemplateCompletionStats } = await importModule();
      mockState.instancesError = new Error("DB error");

      await expect(fetchTemplateCompletionStats()).rejects.toThrow("DB error");
    });
  });

  // ── createTicketChecklistInstanceFromTemplate ─────────────────────

  describe("createTicketChecklistInstanceFromTemplate", () => {
    it("creates instance from template", async () => {
      const { createTicketChecklistInstanceFromTemplate } = await importModule();
      mockState.templatesData = {
        id: templateId,
        name: "Checklist PC",
        structure: { system: { label: "Sistema", sections: {} } },
      };
      mockState.instancesData = {
        ...baseInstance,
        id: "iiiiiiii-iiii-4iii-8iii-iiiiiiiiiiii",
        responses: [],
      };

      const result = await createTicketChecklistInstanceFromTemplate({
        ticketId,
        templateId,
      });
      expect(result.title).toBe("Checklist PC");
      expect(result.template_id).toBe(templateId);
    });

    it("throws on template fetch error", async () => {
      const { createTicketChecklistInstanceFromTemplate } = await importModule();
      mockState.templatesError = new Error("Template not found");

      await expect(
        createTicketChecklistInstanceFromTemplate({ ticketId, templateId }),
      ).rejects.toThrow("Template not found");
    });

    it("throws on instance insert error", async () => {
      const { createTicketChecklistInstanceFromTemplate } = await importModule();
      mockState.templatesData = {
        id: templateId,
        name: "Checklist PC",
        structure: { system: { label: "Sistema", sections: {} } },
      };
      mockState.instancesError = new Error("FK violation");

      await expect(
        createTicketChecklistInstanceFromTemplate({ ticketId, templateId }),
      ).rejects.toThrow("FK violation");
    });
  });

  // ── upsertTicketChecklistResponse ─────────────────────────────────

  describe("upsertTicketChecklistResponse", () => {
    it("upserts response and returns it", async () => {
      const { upsertTicketChecklistResponse } = await importModule();
      mockState.responsesData = { ...baseResponse, value: "false" };

      const result = await upsertTicketChecklistResponse({
        instanceId,
        itemKey: "system.sections.boot.checkbox_power",
        value: "false",
        compiledBy: userId,
      });
      expect(result.value).toBe("false");
      expect(result.item_key).toBe("system.sections.boot.checkbox_power");
    });

    it("throws on upsert error", async () => {
      const { upsertTicketChecklistResponse } = await importModule();
      mockState.responsesError = new Error("Constraint violation");

      await expect(
        upsertTicketChecklistResponse({
          instanceId,
          itemKey: "key",
          value: "x",
          compiledBy: userId,
        }),
      ).rejects.toThrow("Constraint violation");
    });
  });

  // ── completeTicketChecklistInstance ───────────────────────────────

  describe("completeTicketChecklistInstance", () => {
    it("completes instance and returns mapped result", async () => {
      const { completeTicketChecklistInstance } = await importModule();
      mockState.instancesData = {
        ...baseInstance,
        status: "completed",
        completed_by: userId,
        completion_confirmed: true,
        responses: [],
      };

      const result = await completeTicketChecklistInstance({
        instanceId,
        completedBy: userId,
      });
      expect(result.status).toBe("completed");
      expect(result.completed_by).toBe(userId);
    });

    it("includes signature_name when provided", async () => {
      const { completeTicketChecklistInstance } = await importModule();
      mockState.instancesData = {
        ...baseInstance,
        status: "completed",
        completed_by: userId,
        signature_name: "Mario Rossi",
        responses: [],
      };

      const result = await completeTicketChecklistInstance({
        instanceId,
        completedBy: userId,
        signatureName: "Mario Rossi",
      });
      expect(result.signature_name).toBe("Mario Rossi");
    });

    it("throws on update error", async () => {
      const { completeTicketChecklistInstance } = await importModule();
      mockState.instancesError = new Error("Not found");

      await expect(
        completeTicketChecklistInstance({ instanceId, completedBy: userId }),
      ).rejects.toThrow("Not found");
    });
  });

  // ── createTemplate ────────────────────────────────────────────────

  describe("createTemplate", () => {
    it("creates template and returns parsed result", async () => {
      const mod = await importModule();
      mockState.templatesData = { ...baseTemplate, id: "t-new", name: "New Template" };

      const result = await mod.createTemplate!({ name: "New Template" } as any);
      expect(result.name).toBe("New Template");
      expect(result.id).toBe("t-new");
    });

    it("throws on insert error", async () => {
      const mod = await importModule();
      mockState.templatesError = new Error("Constraint violation");

      await expect(mod.createTemplate!({ name: "Fail" } as any)).rejects.toThrow(
        "Constraint violation",
      );
    });
  });

  // ── updateTemplate ────────────────────────────────────────────────

  describe("updateTemplate", () => {
    it("updates template and returns true", async () => {
      const mod = await importModule();
      const result = await mod.updateTemplate!(templateId, { name: "Updated" });
      expect(result).toBe(true);
    });

    it("throws on update error", async () => {
      const mod = await importModule();
      mockState.templatesError = new Error("Not found");

      await expect(mod.updateTemplate!("missing", { name: "Nope" })).rejects.toThrow("Not found");
    });
  });

  // ── deleteTemplate ────────────────────────────────────────────────

  describe("deleteTemplate", () => {
    it("deletes template and returns true", async () => {
      const mod = await importModule();
      const result = await mod.deleteTemplate!(templateId);
      expect(result).toBe(true);
    });

    it("throws on delete error", async () => {
      const mod = await importModule();
      mockState.templatesError = new Error("Permission denied");

      await expect(mod.deleteTemplate!(templateId)).rejects.toThrow("Permission denied");
    });
  });

  // ── setDefaultTemplate ────────────────────────────────────────────

  describe("setDefaultTemplate", () => {
    it("clears existing defaults and sets new one", async () => {
      const mod = await importModule();
      // First call (update all with is_default=false) succeeds silently
      // Second call (set this one to true) succeeds
      const result = await mod.setDefaultTemplate!(templateId);
      expect(result).toBe(true);
    });

    it("throws on error", async () => {
      const mod = await importModule();
      mockState.templatesError = new Error("DB error");

      await expect(mod.setDefaultTemplate!(templateId)).rejects.toThrow("DB error");
    });
  });
});
