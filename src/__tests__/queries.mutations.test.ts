import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({ inserted: [] as unknown[] }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from(table: string) {
      return {
        insert(payload: unknown) {
          // record the payload for assertions
          calls.inserted.push({ table, payload });
          return {
            select: () => ({
              single: async () => ({ data: { id: "gen-id", ...(payload as any) }, error: null }),
            }),
            // support direct await supabase.from(...).insert(...)
            then: async (cb: any) => cb({ data: payload, error: null }),
          };
        },
      };
    },
  },
}));

describe("queries mutations", () => {
  beforeEach(() => {
    calls.inserted = [];
  });

  it("createDevice inserts into devices", async () => {
    const { createDevice } = await import("@/lib/queries/inventory");
    const payload = { client_id: "c1", serial: "S123" };
    const res = await createDevice(payload as any);
    expect(res).toMatchObject({ id: "gen-id", client_id: "c1", serial: "S123" });
    expect(calls.inserted.length).toBeGreaterThan(0);
    expect((calls.inserted[0] as any).table).toBe("devices");
    expect((calls.inserted[0] as any).payload).toMatchObject(payload);
  });

  it("addTicketStatusHistory inserts into ticket_status_history", async () => {
    const { addTicketStatusHistory } = await import("@/lib/queries/tickets");
    const payload = { from_status: null, to_status: "pending", changed_by: "u1" };
    const res = await addTicketStatusHistory("ticket-1", payload as any);
    expect(res).toBe(true);
    expect(calls.inserted.some((c: any) => c.table === "ticket_status_history")).toBe(true);
  });

  it("insertActivity inserts into activity_log", async () => {
    const { insertActivity } = await import("@/lib/queries/activity");
    const payload = { type: "user", message: "Test", actor_id: "u1" };
    const res = await insertActivity(payload as any);
    expect(res).toBe(true);
    expect(calls.inserted.some((c: any) => c.table === "activity_log")).toBe(true);
  });

  it("createTicketNote inserts into ticket_notes", async () => {
    const { createTicketNote } = await import("@/lib/queries/ticketNotes");
    const payload = { ticket_id: "t1", author_id: "u1", content: "note" };
    const res = await createTicketNote(payload as any);
    expect(res).toBe(true);
    expect(calls.inserted.some((c: any) => c.table === "ticket_notes")).toBe(true);
  });
});
