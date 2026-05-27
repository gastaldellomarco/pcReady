// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useAutomationForm } from "@/hooks/useAutomationForm";
import type { AutomationFlowInput } from "@/domain/automation";

// ── Factory helpers ──────────────────────────────────────────────────────

function validInput(overrides: Partial<AutomationFlowInput> = {}): AutomationFlowInput {
  return {
    name: "Test Automation",
    description: "A test automation",
    category: "Notifica",
    trigger: { type: "ticket_created", config: {} },
    conditions: { conditions: [], logic: "AND" },
    actions: [
      {
        id: "action-1",
        type: "send_email",
        order: 0,
        config: {
          to: "user@example.com",
          subject: "Test Subject",
          body: "Test Body",
          is_html: false,
        },
      },
    ],
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("useAutomationForm", () => {
  // ── Default state ──────────────────────────────────────────────────────

  describe("default state (no initialData)", () => {
    it("initializes with default values", () => {
      const { result } = renderHook(() => useAutomationForm());

      expect(result.current.data.name).toBe("");
      expect(result.current.data.description).toBeUndefined();
      expect(result.current.data.category).toBeUndefined();
      expect(result.current.data.trigger).toEqual({
        type: "ticket_created",
        config: {},
      });
      expect(result.current.data.conditions).toEqual({
        conditions: [],
        logic: "AND",
      });
      expect(result.current.data.actions).toEqual([]);
      expect(result.current.errors).toEqual({});
      expect(result.current.isValid).toBe(true);
    });
  });

  // ── Initial data ───────────────────────────────────────────────────────

  describe("initialData", () => {
    it("populates from partial initialData, fills defaults for missing", () => {
      const { result } = renderHook(() =>
        useAutomationForm({ name: "My Rule" }),
      );

      expect(result.current.data.name).toBe("My Rule");
      expect(result.current.data.description).toBeUndefined();
      expect(result.current.data.trigger).toEqual({
        type: "ticket_created",
        config: {},
      });
      expect(result.current.data.actions).toEqual([]);
    });

    it("preserves full initialData", () => {
      const input = validInput({
        name: "Full Rule",
        description: "Desc",
        category: "Generale",
        trigger: {
          type: "scheduled",
          config: { cron: "0 0 * * *" },
        },
        conditions: {
          conditions: [
            {
              id: "c1",
              field: "ticket.status",
              operator: "eq" as const,
              value: "pending",
              valueType: "string" as const,
            },
          ],
          logic: "OR",
        },
        actions: [
          {
            id: "a1",
            type: "create_notification",
            order: 0,
            config: {
              type: "info",
              title: "N",
              body: "B",
            },
          },
        ],
      });

      const { result } = renderHook(() => useAutomationForm(input));

      expect(result.current.data.name).toBe("Full Rule");
      expect(result.current.data.trigger).toEqual(input.trigger);
      expect(result.current.data.conditions).toEqual(input.conditions);
      expect(result.current.data.actions).toEqual(input.actions);
    });
  });

  // ── updateField ────────────────────────────────────────────────────────

  describe("updateField", () => {
    it("updates a top-level field value", () => {
      const { result } = renderHook(() =>
        useAutomationForm({ name: "Old" }),
      );

      act(() => {
        result.current.updateField("name", "New Name");
      });

      expect(result.current.data.name).toBe("New Name");
    });

    it("clears the error for the updated field", () => {
      const { result } = renderHook(() => useAutomationForm());

      // Manually set an error
      act(() => {
        result.current.setErrors({ name: "Name required" });
      });
      expect(result.current.getFieldError("name")).toBe("Name required");

      // Update the field → error should be cleared
      act(() => {
        result.current.updateField("name", "Valid Name");
      });

      expect(result.current.getFieldError("name")).toBeUndefined();
      expect(result.current.errors).toEqual({});
    });

    it("clears nested errors for the updated field", () => {
      const { result } = renderHook(() => useAutomationForm());

      act(() => {
        result.current.setErrors({
          "trigger.config.cron": "Invalid cron",
          "trigger.type": "Invalid trigger",
          "actions.0.config.subject": "Subject required",
        });
      });

      // Updating "trigger" should clear trigger.* errors but not actions.*
      act(() => {
        result.current.updateField("trigger", {
          type: "ticket_created",
          config: {},
        });
      });

      expect(result.current.getFieldError("trigger.config.cron")).toBeUndefined();
      expect(result.current.getFieldError("trigger.type")).toBeUndefined();
      // actions errors should remain
      expect(result.current.getFieldError("actions.0.config.subject")).toBe(
        "Subject required",
      );
    });

    it("does not mutate the original data reference", () => {
      const { result } = renderHook(() =>
        useAutomationForm({ name: "Original" }),
      );
      const original = result.current.data;

      act(() => {
        result.current.updateField("name", "Changed");
      });

      expect(result.current.data).not.toBe(original);
      expect(original.name).toBe("Original");
    });
  });

  // ── updateNestedField ──────────────────────────────────────────────────

  describe("updateNestedField", () => {
    it("updates a nested field on an object property", () => {
      const { result } = renderHook(() => useAutomationForm());

      act(() => {
        result.current.updateNestedField("trigger", "type", "scheduled");
      });

      expect(result.current.data.trigger.type).toBe("scheduled");
      // config should be preserved
      expect(result.current.data.trigger.config).toEqual({});
    });

    it("updates a nested config field", () => {
      const { result } = renderHook(() => useAutomationForm());

      act(() => {
        result.current.updateNestedField("trigger", "type", "sla_due");
      });
      act(() => {
        result.current.updateNestedField("trigger", "config", {
          hours_before: 48,
        });
      });

      expect(result.current.data.trigger).toEqual({
        type: "sla_due",
        config: { hours_before: 48 },
      });
    });

    it("clears the error for the exact nested path", () => {
      const { result } = renderHook(() => useAutomationForm());

      act(() => {
        result.current.setErrors({
          "trigger.config": "Invalid config",
          "trigger.type": "Invalid type",
        });
      });

      act(() => {
        result.current.updateNestedField("trigger", "config", {
          cron: "0 8 * * *",
        });
      });

      expect(
        result.current.getFieldError("trigger.config"),
      ).toBeUndefined();
      // Other error should remain
      expect(result.current.getFieldError("trigger.type")).toBe(
        "Invalid type",
      );
    });

    it("does nothing when the target field is not an object", () => {
      const { result } = renderHook(() =>
        useAutomationForm({ name: "Test" }),
      );

      act(() => {
        result.current.updateNestedField("name", "length", 42);
      });

      // name should be unchanged (it's a string, not an object)
      expect(result.current.data.name).toBe("Test");
    });

    it("does not mutate the nested object reference", () => {
      const { result } = renderHook(() => useAutomationForm());
      const originalTrigger = result.current.data.trigger;

      act(() => {
        result.current.updateNestedField("trigger", "type", "scheduled");
      });

      expect(result.current.data.trigger).not.toBe(originalTrigger);
    });
  });

  // ── validate ───────────────────────────────────────────────────────────

  describe("validate", () => {
    it("returns true for valid data", () => {
      const { result } = renderHook(() =>
        useAutomationForm(validInput()),
      );

      let isValid: boolean;
      act(() => {
        isValid = result.current.validate();
      });

      expect(isValid!).toBe(true);
      expect(result.current.errors).toEqual({});
      expect(result.current.isValid).toBe(true);
    });

    it("returns false and sets errors for empty name", () => {
      const { result } = renderHook(() =>
        useAutomationForm(validInput({ name: "" })),
      );

      let isValid: boolean;
      act(() => {
        isValid = result.current.validate();
      });

      expect(isValid!).toBe(false);
      expect(result.current.getFieldError("name")).toBe(
        "Nome automazione richiesto",
      );
      expect(result.current.isValid).toBe(false);
    });

    it("returns false when actions is empty", () => {
      const { result } = renderHook(() =>
        useAutomationForm(validInput({ actions: [] })),
      );

      let isValid: boolean;
      act(() => {
        isValid = result.current.validate();
      });

      expect(isValid!).toBe(false);
      expect(result.current.errors).not.toEqual({});
    });

    it("returns false for invalid trigger type", () => {
      const { result } = renderHook(() =>
        useAutomationForm(
          validInput({
            // @ts-expect-error Testing invalid trigger type
            trigger: { type: "invalid_trigger", config: {} },
          }),
        ),
      );

      let isValid: boolean;
      act(() => {
        isValid = result.current.validate();
      });

      expect(isValid!).toBe(false);
    });

    it("returns false for action with empty subject and body", () => {
      const { result } = renderHook(() =>
        useAutomationForm(
          validInput({
            actions: [
              {
                id: "a1",
                type: "send_email",
                order: 0,
                // @ts-expect-error omit is_html (has Zod default); subject/body empty → fails .min(1)
                config: { to: "", subject: "", body: "" },
              },
            ],
          }),
        ),
      );

      let isValid: boolean;
      act(() => {
        isValid = result.current.validate();
      });

      expect(isValid!).toBe(false);
    });

    it("clears previous errors when validation passes", () => {
      const { result } = renderHook(() =>
        useAutomationForm(validInput({ name: "" })),
      );

      // First validation fails
      act(() => {
        result.current.validate();
      });
      expect(result.current.isValid).toBe(false);

      // Fix the data and re-validate
      act(() => {
        result.current.updateField("name", "Fixed Name");
      });

      act(() => {
        result.current.validate();
      });

      expect(result.current.isValid).toBe(true);
      expect(result.current.errors).toEqual({});
    });
  });

  // ── setErrors ──────────────────────────────────────────────────────────

  describe("setErrors", () => {
    it("replaces errors entirely", () => {
      const { result } = renderHook(() => useAutomationForm());

      act(() => {
        result.current.setErrors({ name: "Error 1" });
      });
      expect(result.current.getFieldError("name")).toBe("Error 1");

      act(() => {
        result.current.setErrors({ trigger: "Error 2" });
      });
      expect(result.current.getFieldError("name")).toBeUndefined();
      expect(result.current.getFieldError("trigger")).toBe("Error 2");
    });
  });

  // ── clearErrors ────────────────────────────────────────────────────────

  describe("clearErrors", () => {
    it("clears all errors and restores isValid to true", () => {
      const { result } = renderHook(() => useAutomationForm());

      act(() => {
        result.current.setErrors({
          name: "A",
          trigger: "B",
          "actions.0.config.subject": "C",
        });
      });
      expect(result.current.isValid).toBe(false);

      act(() => {
        result.current.clearErrors();
      });

      expect(result.current.errors).toEqual({});
      expect(result.current.isValid).toBe(true);
    });
  });

  // ── getFieldError ──────────────────────────────────────────────────────

  describe("getFieldError", () => {
    it("returns undefined for a path with no error", () => {
      const { result } = renderHook(() => useAutomationForm());

      expect(result.current.getFieldError("name")).toBeUndefined();
    });

    it("returns the error message for a path with an error", () => {
      const { result } = renderHook(() => useAutomationForm());

      act(() => {
        result.current.setErrors({
          "actions.0.config.subject": "Oggetto email richiesto",
        });
      });

      expect(result.current.getFieldError("actions.0.config.subject")).toBe(
        "Oggetto email richiesto",
      );
    });
  });

  // ── isValid derivation ─────────────────────────────────────────────────

  describe("isValid", () => {
    it("is true when errors is empty", () => {
      const { result } = renderHook(() => useAutomationForm());

      expect(result.current.isValid).toBe(true);
    });

    it("becomes false when errors are set", () => {
      const { result } = renderHook(() => useAutomationForm());

      act(() => {
        result.current.setErrors({ name: "Required" });
      });

      expect(result.current.isValid).toBe(false);
    });

    it("becomes true again after clearing errors", () => {
      const { result } = renderHook(() => useAutomationForm());

      act(() => {
        result.current.setErrors({ name: "Required" });
      });
      act(() => {
        result.current.clearErrors();
      });

      expect(result.current.isValid).toBe(true);
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("validates update_ticket action correctly", () => {
      const { result } = renderHook(() =>
        useAutomationForm(
          validInput({
            actions: [
              {
                id: "a1",
                type: "update_ticket" as const,
                order: 0,
                config: { status: "in-progress" as const },
              },
            ],
          }),
        ),
      );

      let isValid: boolean;
      act(() => {
        isValid = result.current.validate();
      });

      expect(isValid!).toBe(true);
    });

    it("validates assign_ticket action correctly", () => {
      const { result } = renderHook(() =>
        useAutomationForm(
          validInput({
            actions: [
              {
                id: "a1",
                type: "assign_ticket" as const,
                order: 0,
                config: { assignee_id: "user-123" },
              },
            ],
          }),
        ),
      );

      let isValid: boolean;
      act(() => {
        isValid = result.current.validate();
      });

      expect(isValid!).toBe(true);
    });

    it("rejects update_ticket when no field is set", () => {
      const { result } = renderHook(() =>
        useAutomationForm(
          validInput({
            actions: [
              {
                id: "a1",
                type: "update_ticket" as const,
                order: 0,
                config: {},
              },
            ],
          }),
        ),
      );

      let isValid: boolean;
      act(() => {
        isValid = result.current.validate();
      });

      expect(isValid!).toBe(false);
    });

    it("rejects description exceeding 1000 characters", () => {
      const { result } = renderHook(() =>
        useAutomationForm(
          validInput({ description: "x".repeat(1001) }),
        ),
      );

      let isValid: boolean;
      act(() => {
        isValid = result.current.validate();
      });

      expect(isValid!).toBe(false);
    });

    it("handles conditions with complex nested fields", () => {
      const { result } = renderHook(() =>
        useAutomationForm(
          validInput({
            conditions: {
              conditions: [
                {
                  id: "c1",
                  field: "ticket.priority",
                  operator: "eq" as const,
                  value: "high",
                  valueType: "string" as const,
                },
                {
                  id: "c2",
                  field: "ticket.status",
                  operator: "in" as const,
                  value: ["pending", "in-progress"],
                  valueType: "list" as const,
                },
              ],
              logic: "AND" as const,
            },
          }),
        ),
      );

      let isValid: boolean;
      act(() => {
        isValid = result.current.validate();
      });

      expect(isValid!).toBe(true);
    });
  });
});
