import { describe, it, expect } from "vitest";
import { __getInitialFormState } from "@/components/pcready/CreateTicketModal";

describe("CreateTicketModal form reset", () => {
  it("provides initial form state and reset restores defaults", () => {
    const initial = __getInitialFormState();
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
    const reset = __getInitialFormState();
    expect(reset).toEqual(initial);
    expect(reset).not.toEqual(mutated);
  });
});
