import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({
  inserted: [] as unknown[],
  updates: [] as unknown[],
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from(table: string) {
      if (table === "user_profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi
            .fn()
            .mockResolvedValue({ data: { notify_ticket_assigned: true }, error: null }),
        };
      }

      return {
        insert(payload: unknown) {
          calls.inserted.push(payload);
          return this;
        },
        update(payload: unknown) {
          calls.updates.push(payload);
          return this;
        },
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({ error: null }),
        single: vi.fn().mockResolvedValue({
          data: {
            id: "notification-1",
            user_id: "11111111-1111-4111-8111-111111111111",
            type: "ticket_assigned",
            title: "Ticket assegnato",
            body: null,
            payload: null,
            link: null,
            read_at: null,
            created_at: "2026-05-07T00:00:00.000Z",
          },
          error: null,
        }),
      };
    },
  },
}));

describe("notifications", () => {
  beforeEach(() => {
    calls.inserted = [];
    calls.updates = [];
  });

  it("creates a notification for a user", async () => {
    const { createNotificationForUser } = await import("@/lib/notifications.server");

    const notification = await createNotificationForUser({
      userId: "11111111-1111-4111-8111-111111111111",
      type: "ticket_assigned",
      title: "Ticket assegnato",
      body: "Body",
      payload: { ticketId: "ticket-1" },
      link: "/tickets",
    });

    expect(notification?.id).toBe("notification-1");
    expect(calls.inserted[0]).toMatchObject({
      user_id: "11111111-1111-4111-8111-111111111111",
      type: "ticket_assigned",
      title: "Ticket assegnato",
    });
  });

  it("marks one notification as read", async () => {
    const { markNotificationReadForUser } = await import("@/lib/notifications.server");

    await expect(markNotificationReadForUser("user-1", "notification-1")).resolves.toEqual({
      success: true,
    });
    expect(calls.updates[0]).toHaveProperty("read_at");
  });

  it("marks all notifications as read", async () => {
    const { markAllNotificationsReadForUser } = await import("@/lib/notifications.server");

    await expect(markAllNotificationsReadForUser("user-1")).resolves.toEqual({ success: true });
    expect(calls.updates[0]).toHaveProperty("read_at");
  });
});
