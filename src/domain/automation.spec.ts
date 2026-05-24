import { describe, it, expect } from "vitest";
import {
  createDefaultTrigger,
  createDefaultCondition,
  createDefaultAction,
  serializeFlow,
  deserializeFlow,
  serializeTrigger,
  deserializeTrigger,
  serializeActions,
  deserializeActions,
  mapTriggerTypeToLegacy,
  mapLegacyTriggerType,
  type AutomationFlow,
} from "./automation";
import {
  validateFlowInput,
  validateTrigger,
  validateActions,
  AutomationFlowInputSchema,
} from "./automation.schema";

describe("Automation DSL", () => {
  describe("Trigger DSL", () => {
    it("should create valid ticket_created trigger", () => {
      const trigger = createDefaultTrigger("ticket_created");
      expect(trigger.type).toBe("ticket_created");
      expect(trigger.config).toEqual({});
    });

    it("should create valid sla_due trigger with default hours", () => {
      const trigger = createDefaultTrigger("sla_due");
      expect(trigger.type).toBe("sla_due");
      expect((trigger as { config: { hours_before: number } }).config.hours_before).toBe(24);
    });

    it("should create valid warranty_due trigger with default days", () => {
      const trigger = createDefaultTrigger("warranty_due");
      expect(trigger.type).toBe("warranty_due");
      expect((trigger as { config: { days_before: number } }).config.days_before).toBe(30);
    });

    it("should create valid scheduled trigger with default cron", () => {
      const trigger = createDefaultTrigger("scheduled");
      expect(trigger.type).toBe("scheduled");
      expect((trigger as { config: { cron: string } }).config.cron).toBe("0 8 * * *");
    });

    it("should validate ticket_created trigger with schema", () => {
      const trigger = createDefaultTrigger("ticket_created");
      const result = validateTrigger(trigger);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should validate scheduled trigger with schema", () => {
      const trigger = createDefaultTrigger("scheduled");
      const result = validateTrigger(trigger);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject invalid scheduled trigger without cron", () => {
      const result = validateTrigger({ type: "scheduled", config: {} });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path.includes("cron"))).toBe(true);
    });
  });

  describe("Action DSL", () => {
    it("should create valid send_email action", () => {
      const action = createDefaultAction("send_email") as { type: "send_email"; config: { subject: string; body: string } };
      expect(action.type).toBe("send_email");
      expect(action.config.subject).toBe("");
      expect(action.config.body).toBe("");
    });

    it("should validate send_email action with schema", () => {
      const action = createDefaultAction("send_email") as { type: "send_email"; config: { subject: string; body: string } };
      action.config.subject = "Test Subject";
      action.config.body = "Test Body";
      const result = validateActions([action]);
      expect(result.valid).toBe(true);
    });

    it("should reject send_email without subject", () => {
      const action = createDefaultAction("send_email") as { type: "send_email"; config: { subject: string } };
      action.config.subject = "";
      const result = validateActions([action]);
      expect(result.valid).toBe(false);
    });

    it("should create valid update_ticket action", () => {
      const action = createDefaultAction("update_ticket") as { type: "update_ticket"; config: object };
      expect(action.type).toBe("update_ticket");
    });

    it("should validate update_ticket with at least one field", () => {
      const action = createDefaultAction("update_ticket") as { type: "update_ticket"; config: { status?: string } };
      action.config.status = "ready";
      const result = validateActions([action]);
      expect(result.valid).toBe(true);
    });

    it("should reject update_ticket without any field", () => {
      const action = createDefaultAction("update_ticket") as { type: "update_ticket"; config: object };
      const result = validateActions([action]);
      expect(result.valid).toBe(false);
    });

    it("should reject empty actions array", () => {
      const result = validateActions([]);
      expect(result.valid).toBe(false);
    });
  });

  describe("Trigger Serialization", () => {
    it("should map sla_due to legacy sla_warning", () => {
      const legacyType = mapTriggerTypeToLegacy("sla_due");
      expect(legacyType).toBe("sla_warning");
    });

    it("should map warranty_due to legacy warranty_expiring_soon", () => {
      const legacyType = mapTriggerTypeToLegacy("warranty_due");
      expect(legacyType).toBe("warranty_expiring_soon");
    });

    it("should map legacy sla_warning to dsl sla_due", () => {
      const dslType = mapLegacyTriggerType("sla_warning");
      expect(dslType).toBe("sla_due");
    });

    it("should map legacy warranty_expiring_soon to dsl warranty_due", () => {
      const dslType = mapLegacyTriggerType("warranty_expiring_soon");
      expect(dslType).toBe("warranty_due");
    });

    it("should serialize and deserialize trigger preserving config", () => {
      const trigger = createDefaultTrigger("sla_due") as { type: "sla_due"; config: { hours_before: number } };
      trigger.config.hours_before = 48;

      const serialized = serializeTrigger(trigger);
      expect(serialized.type).toBe("sla_warning");
      expect((serialized.config as { hours_before: number }).hours_before).toBe(48);

      const deserialized = deserializeTrigger(serialized) as { type: "sla_due"; config: { hours_before: number } };
      expect(deserialized.type).toBe("sla_due");
      expect(deserialized.config.hours_before).toBe(48);
    });
  });

  describe("Action Serialization", () => {
    it("should serialize send_email to legacy format", () => {
      const action = createDefaultAction("send_email") as any;
      action.config.to = "test@example.com";
      action.config.subject = "Test";
      action.config.body = "Body";

      const serialized = serializeActions([action]);
      expect(serialized[0].type).toBe("send_email");
      expect((serialized[0].config as { to: string }).to).toBe("test@example.com");
    });

    it("should serialize update_ticket to legacy update_ticket_status", () => {
      const action = createDefaultAction("update_ticket") as any;
      action.config.status = "ready";

      const serialized = serializeActions([action]);
      expect(serialized[0].type).toBe("update_ticket_status");
    });

    it("should deserialize legacy send_email to dsl format", () => {
      const legacy = {
        id: "action-1",
        type: "send_email",
        config: {
          to: "test@example.com",
          subject: "Test",
          body: "Body",
          is_html: true,
        },
      };

      const deserialized = deserializeActions([legacy]);
      expect(deserialized[0].type).toBe("send_email");
      expect((deserialized[0].config as { to: string }).to).toBe("test@example.com");
      expect((deserialized[0].config as { is_html: boolean }).is_html).toBe(true);
    });

    it("should deserialize legacy update_ticket_status to dsl update_ticket", () => {
      const legacy = {
        id: "action-1",
        type: "update_ticket_status",
        config: {
          ticket_id: "ticket-123",
          status: "ready",
        },
      };

      const deserialized = deserializeActions([legacy]);
      expect(deserialized[0].type).toBe("update_ticket");
      expect((deserialized[0].config as { status: string }).status).toBe("ready");
    });
  });

  describe("Flow Serialization", () => {
    it("should serialize and deserialize complete flow", () => {
      const flow: AutomationFlow = {
        name: "Test Flow",
        description: "Test description",
        trigger: createDefaultTrigger("ticket_created"),
        conditions: {
          conditions: [createDefaultCondition()],
          logic: "AND",
        },
        actions: [createDefaultAction("send_email")],
        is_active: true,
      };

      const serialized = serializeFlow(flow);
      expect(serialized.name).toBe("Test Flow");
      expect(serialized.trigger_definition).toBeDefined();
      expect(serialized.conditions_definition).toBeDefined();
      expect(serialized.actions_definition).toBeDefined();

      const deserialized = deserializeFlow(serialized);
      expect(deserialized.name).toBe(flow.name);
      expect(deserialized.trigger.type).toBe(flow.trigger.type);
      expect(deserialized.actions[0].type).toBe(flow.actions[0].type);
    });

    it("should produce JSON compatible with legacy API", () => {
      const flow: AutomationFlow = {
        name: "Test",
        trigger: createDefaultTrigger("sla_due"),
        conditions: { conditions: [], logic: "AND" },
        actions: [createDefaultAction("send_email")],
        is_active: true,
      };

      const serialized = serializeFlow(flow);

      // Check legacy field names
      expect(serialized).toHaveProperty("trigger_definition");
      expect(serialized).toHaveProperty("conditions_definition");
      expect(serialized).toHaveProperty("actions_definition");

      // Check trigger type mapping
      expect(serialized.trigger_definition).toEqual({
        type: "sla_warning", // mapped from sla_due
        config: { hours_before: 24 },
      });
    });

    it("should handle empty actions array", () => {
      const flow: AutomationFlow = {
        name: "Test",
        trigger: createDefaultTrigger("ticket_created"),
        conditions: { conditions: [], logic: "AND" },
        actions: [],
        is_active: true,
      };

      const serialized = serializeFlow(flow);
      expect(serialized.actions_definition).toEqual([]);

      const deserialized = deserializeFlow(serialized);
      expect(deserialized.actions).toHaveLength(0);
    });
  });

  describe("Flow Validation", () => {
    it("should validate complete flow", () => {
      const flowInput = {
        name: "Test Flow",
        trigger: createDefaultTrigger("ticket_created"),
        conditions: { conditions: [], logic: "AND" as const },
        actions: [createDefaultAction("send_email") as { type: "send_email"; config: { subject: string; body: string } }],
      };
      flowInput.actions[0].config.subject = "Test";
      flowInput.actions[0].config.body = "Body";

      const result = validateFlowInput(flowInput);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject flow without name", () => {
      const result = validateFlowInput({
        name: "",
        trigger: createDefaultTrigger("ticket_created"),
        conditions: { conditions: [], logic: "AND" },
        actions: [createDefaultAction("send_email")],
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === "name")).toBe(true);
    });

    it("should reject flow without actions", () => {
      const result = validateFlowInput({
        name: "Test",
        trigger: createDefaultTrigger("ticket_created"),
        conditions: { conditions: [], logic: "AND" },
        actions: [],
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === "actions")).toBe(true);
    });

    it("should reject flow with invalid action", () => {
      const action = createDefaultAction("send_email") as { type: "send_email"; config: { subject: string } };
      action.config.subject = ""; // Invalid: empty subject

      const result = validateFlowInput({
        name: "Test",
        trigger: createDefaultTrigger("ticket_created"),
        conditions: { conditions: [], logic: "AND" },
        actions: [action],
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path.includes("subject"))).toBe(true);
    });

    it("should reject flow with name too long", () => {
      const result = validateFlowInput({
        name: "a".repeat(201),
        trigger: createDefaultTrigger("ticket_created"),
        conditions: { conditions: [], logic: "AND" },
        actions: [createDefaultAction("send_email")],
      });

      expect(result.valid).toBe(false);
    });
  });

  describe("Zod Schema Direct", () => {
    it("should parse valid flow with zod schema directly", () => {
      const flow = {
        name: "Test",
        trigger: { type: "ticket_created", config: {} },
        conditions: { conditions: [], logic: "AND" },
        actions: [
          {
            id: "action-1",
            type: "send_email",
            order: 0,
            config: {
              to: "test@example.com",
              subject: "Test",
              body: "Body",
              is_html: false,
            },
          },
        ],
      };

      const result = AutomationFlowInputSchema.safeParse(flow);
      expect(result.success).toBe(true);
    });

    it("should fail on invalid trigger type", () => {
      const flow = {
        name: "Test",
        trigger: { type: "invalid_trigger", config: {} },
        conditions: { conditions: [], logic: "AND" },
        actions: [],
      };

      const result = AutomationFlowInputSchema.safeParse(flow);
      expect(result.success).toBe(false);
    });
  });
});
