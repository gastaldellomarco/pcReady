import type { ActionDef } from "@/types/automation";
import type {
  AutomationAction,
  UpdateTicketAction,
  UpdateDeviceAction,
} from "@/domain/automation";

/**
 * Converts a legacy ActionDef to the new AutomationAction format
 */
export function fromActionDef(def: ActionDef): AutomationAction {
  const base = {
    id: def.id,
    order: 0,
  };

  switch (def.type) {
    case "send_email":
      return {
        ...base,
        type: "send_email",
        config: {
          to: (def.config?.to as string) || "",
          subject: (def.config?.subject as string) || "",
          body: (def.config?.body as string) || "",
          is_html: (def.config?.is_html as boolean) || false,
        },
      };

    case "update_ticket_status":
      return {
        ...base,
        type: "update_ticket",
        config: {
          ticket_id: (def.config?.ticket_id as string) || undefined,
          status: (def.config?.status as UpdateTicketAction["config"]["status"]) || undefined,
        },
      };

    case "create_notification":
      return {
        ...base,
        type: "create_notification",
        config: {
          user_id: (def.config?.user_id as string) || undefined,
          type: (def.config?.type as string) || "ticket_status_changed",
          title: (def.config?.title as string) || "",
          body: (def.config?.body as string) || "",
          link: (def.config?.link as string) || undefined,
        },
      };

    case "update_device_status":
      return {
        ...base,
        type: "update_device",
        config: {
          device_id: (def.config?.device_id as string) || undefined,
          status: (def.config?.status as UpdateDeviceAction["config"]["status"]) || undefined,
        },
      };

    case "assign_ticket":
      return {
        ...base,
        type: "assign_ticket",
        config: {
          ticket_id: (def.config?.ticket_id as string) || undefined,
          assignee_id: (def.config?.assignee_id as string) || "",
        },
      };

    default:
      // Fallback to send_email for unknown types
      return {
        ...base,
        type: "send_email",
        config: { to: "", subject: "", body: "", is_html: false },
      };
  }
}

/**
 * Converts an array of legacy ActionDefs to AutomationActions
 */
export function fromActionDefs(defs: ActionDef[]): AutomationAction[] {
  return defs.map((def, index) => ({
    ...fromActionDef(def),
    order: index,
  }));
}

/**
 * Converts an AutomationAction to the legacy ActionDef format for API
 */
export function toActionDef(action: AutomationAction): ActionDef {
  const base = {
    id: action.id,
  };

  switch (action.type) {
    case "send_email":
      return {
        ...base,
        type: "send_email",
        config: action.config,
      };

    case "update_ticket":
      // Map to legacy update_ticket_status
      return {
        ...base,
        type: "update_ticket_status",
        config: {
          ticket_id: action.config.ticket_id,
          status: action.config.status,
          // priority and assignee are not supported by legacy API
        },
      };

    case "add_comment":
      // Map to create_notification as fallback (API may not support add_comment directly)
      return {
        ...base,
        type: "create_notification",
        config: {
          type: "ticket_comment",
          title: "Nuovo commento",
          body: action.config.content,
        },
      };

    case "create_ticket":
      // Map to create_notification as fallback (API may not support create_ticket yet)
      return {
        ...base,
        type: "create_notification",
        config: {
          type: "auto_create_ticket",
          title: action.config.title,
          body: action.config.description,
        },
      };

    case "create_notification":
      return {
        ...base,
        type: "create_notification",
        config: action.config,
      };

    case "assign_ticket":
      return {
        ...base,
        type: "assign_ticket",
        config: action.config,
      };

    case "update_device":
      // Map to legacy update_device_status
      return {
        ...base,
        type: "update_device_status",
        config: {
          device_id: action.config.device_id,
          status: action.config.status,
        },
      };

    default:
      return {
        ...base,
        type: "send_email",
        config: { to: "", subject: "", body: "" },
      };
  }
}

/**
 * Converts an array of AutomationActions to legacy ActionDefs
 */
export function toActionDefs(actions: AutomationAction[]): ActionDef[] {
  return actions
    .sort((a, b) => a.order - b.order)
    .map(toActionDef);
}

/**
 * Creates an empty action list
 */
export function createEmptyActionsList(): { actions: AutomationAction[] } {
  return {
    actions: [],
  };
}

/**
 * Validates an action configuration
 */
export function validateAction(action: AutomationAction): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  switch (action.type) {
    case "send_email":
      if (!action.config.subject) errors.push("Oggetto email richiesto");
      if (!action.config.body) errors.push("Corpo email richiesto");
      break;

    case "update_ticket":
      if (!action.config.status && !action.config.priority && !action.config.assignee_id) {
        errors.push("Almeno un campo da aggiornare (stato, priorità o assegnatario)");
      }
      break;

    case "add_comment":
      if (!action.config.content) errors.push("Contenuto del commento richiesto");
      break;

    case "create_ticket":
      if (!action.config.title) errors.push("Titolo del ticket richiesto");
      if (!action.config.description) errors.push("Descrizione del ticket richiesta");
      break;

    case "create_notification":
      if (!action.config.title) errors.push("Titolo notifica richiesto");
      if (!action.config.body) errors.push("Messaggio notifica richiesto");
      break;

    case "assign_ticket":
      if (!action.config.assignee_id) errors.push("Assegnatario richiesto");
      break;

    case "update_device":
      if (!action.config.status && !action.config.location_id) {
        errors.push("Almeno un campo da aggiornare (stato o sede)");
      }
      break;
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates an actions list
 */
export function validateActionsList(actions: AutomationAction[]): { valid: boolean; errors: string[] } {
  if (actions.length === 0) {
    return { valid: false, errors: ["Almeno un'azione richiesta"] };
  }

  const allErrors: string[] = [];
  actions.forEach((action, index) => {
    const validation = validateAction(action);
    if (!validation.valid) {
      allErrors.push(`Azione ${index + 1} (${action.type}): ${validation.errors.join(", ")}`);
    }
  });

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
  };
}
