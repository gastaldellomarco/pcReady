import type { TicketPriority, TicketType } from "@/lib/pcready";

/**
 *
 */
export function getInitialCreateTicketFormState() {
  return {
    client_id: "",
    device_id: "",
    requester_contact_id: "",
    requester: "",
    free_requester: false,
    ticket_type: "device" as TicketType,
    priority: "med" as TicketPriority,
    assignee_id: "",
    ticket_category: "",
    software: "",
    notes: "",
  };
}
