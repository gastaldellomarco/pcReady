import type { ConditionDef } from "@/types/automation";
import type {
  AutomationCondition,
  ConditionsGroup,
  ConditionOperator,
} from "@/domain/automation";

/**
 * Maps legacy ConditionDef type to operator string
 */
const LEGACY_TYPE_TO_OPERATOR: Record<string, ConditionOperator> = {
  field_equals: "eq",
  field_not_equals: "neq",
  field_greater_than: "gt",
  field_less_than: "lt",
  field_contains: "contains",
  priority_high: "eq",
  tag_contains: "contains",
};

/**
 * Maps legacy condition types to field names
 */
const LEGACY_TYPE_TO_FIELD: Record<string, string> = {
  priority_high: "ticket.priority",
  tag_contains: "ticket.tags",
};

/**
 * Maps operator to legacy condition type
 */
const OPERATOR_TO_LEGACY_TYPE: Record<ConditionOperator, string> = {
  eq: "field_equals",
  neq: "field_not_equals",
  gt: "field_greater_than",
  lt: "field_less_than",
  contains: "field_contains",
  in: "field_equals",
};

/**
 * Converts a legacy ConditionDef to AutomationCondition
 */
export function fromConditionDef(def: ConditionDef): AutomationCondition {
  // Handle special legacy types that don't have explicit fields
  if (LEGACY_TYPE_TO_FIELD[def.type]) {
    const field = LEGACY_TYPE_TO_FIELD[def.type];
    const value =
      def.type === "priority_high"
        ? "high"
        : def.config?.value || "";

    return {
      id: def.id,
      field,
      operator: LEGACY_TYPE_TO_OPERATOR[def.type] || "eq",
      value,
      valueType: field === "ticket.priority" ? "string" : "string",
      label: field,
    };
  }

  // Handle standard field_* types
  const operator = LEGACY_TYPE_TO_OPERATOR[def.type] || "eq";
  const value = def.config?.value || "";

  return {
    id: def.id,
    field: def.config?.field || "",
    operator,
    value,
    valueType: "string",
    label: def.config?.field,
  };
}

/**
 * Converts an array of legacy ConditionDefs to ConditionsGroup
 */
export function fromConditionDefs(defs: ConditionDef[]): ConditionsGroup {
  return {
    conditions: defs.map(fromConditionDef),
    logic: "AND", // Legacy assumes AND implicitly
  };
}

/**
 * Converts AutomationCondition to legacy ConditionDef format
 */
export function toConditionDef(cond: AutomationCondition): ConditionDef {
  // Determine the legacy type based on operator
  const type =
    OPERATOR_TO_LEGACY_TYPE[cond.operator] || "field_equals";

  // Handle value serialization
  let value: string;
  if (Array.isArray(cond.value)) {
    value = cond.value.join(",");
  } else {
    value = String(cond.value);
  }

  return {
    id: cond.id,
    type: type as ConditionDef["type"],
    config: {
      field: cond.field,
      value,
    },
  };
}

/**
 * Converts ConditionsGroup to array of legacy ConditionDefs
 *
 * Special handling for OR logic:
 * - When logic is OR, we need to create multiple conditions
 * - "in" operator with multiple values gets expanded
 */
export function toConditionDefs(group: ConditionsGroup): ConditionDef[] {
  const result: ConditionDef[] = [];

  for (const cond of group.conditions) {
    // Handle "in" operator expansion
    if (cond.operator === "in" && Array.isArray(cond.value)) {
      if (group.logic === "OR") {
        // For OR logic, each value in "in" becomes a separate condition
        for (const val of cond.value) {
          result.push({
            id: `${cond.id}-${val}`,
            type: "field_equals",
            config: {
              field: cond.field,
              value: val,
            },
          });
        }
      } else {
        // For AND logic, "in" means the field equals any of the values
        // We create multiple field_equals which effectively work as OR within the condition
        // The overall AND logic applies between different conditions
        for (const val of cond.value) {
          result.push({
            id: `${cond.id}-${val}`,
            type: "field_equals",
            config: {
              field: cond.field,
              value: val,
            },
          });
        }
      }
    } else {
      // Standard conversion
      result.push(toConditionDef(cond));
    }
  }

  return result;
}

/**
 * Creates an empty conditions group
 */
export function createEmptyConditionsGroup(): ConditionsGroup {
  return {
    conditions: [],
    logic: "AND",
  };
}

/**
 * Validates a conditions group
 */
export function validateConditionsGroup(
  group: ConditionsGroup
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const cond of group.conditions) {
    if (!cond.field) {
      errors.push(`Condition ${cond.id}: field is required`);
    }
    if (!cond.operator) {
      errors.push(`Condition ${cond.id}: operator is required`);
    }
    if (cond.value === "" || cond.value === undefined || cond.value === null) {
      errors.push(`Condition ${cond.id}: value is required`);
    }
    if (
      cond.operator === "in" &&
      Array.isArray(cond.value) &&
      cond.value.length === 0
    ) {
      errors.push(`Condition ${cond.id}: at least one value is required for "in" operator`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
