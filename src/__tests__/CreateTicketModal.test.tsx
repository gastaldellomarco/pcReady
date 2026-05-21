import { describe, it, expect } from "vitest";
import { getInitialCreateTicketFormState } from "@/components/pcready/createTicketFormState";

describe("CreateTicketModal form reset", () => {
  it("provides initial form state and reset restores defaults", () => {
    const initial = getInitialCreateTicketFormState();
    expect(initial).toMatchObject({
      client_id: "",
      device_id: "",
      requester_contact_id: "",
      requester: "",
      free_requester: false,
      ticket_type: "device",
      priority: "med",
      assignee_id: "",
      ticket_category: "",
      software: "",
      notes: "",
    });
    // simulate mutated form
    const mutated = { ...initial, client_id: "c1", notes: "foo" };
    // resetting is simply getting initial state again
    const reset = getInitialCreateTicketFormState();
    expect(reset).toEqual(initial);
    expect(reset).not.toEqual(mutated);
  });
});
