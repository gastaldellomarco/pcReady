import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({
  inserted: [] as unknown[],
  updates: [] as unknown[],
}));

const authGetUser = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ data: { user: { id: "auth-user-1" } }, error: null }),
);

const profilesMaybeSingle = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    data: {
      notify_ticket_assigned: true,
      notify_ticket_status_changed: true,
      notify_ticket_completed: true,
      notify_automation_failed: true,
      notify_device_status_changed: true,
      notify_checklist_completed: true,
      notify_mentions: true,
    },
    error: null,
  }),
);

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    auth: {
      getUser: (...args: unknown[]) => authGetUser(...args),
    },
    from(table: string) {
      if (table === "user_profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: (...args: unknown[]) => profilesMaybeSingle(...args),
        };
      }

      if (table === "user_roles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: [{ user_id: "11111111-1111-4111-8111-111111111111" }],
            error: null,
          }),
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
    profilesMaybeSingle.mockResolvedValue({
      data: {
        notify_ticket_assigned: true,
        notify_ticket_status_changed: true,
        notify_ticket_completed: true,
        notify_automation_failed: true,
        notify_device_status_changed: true,
        notify_checklist_completed: true,
        notify_mentions: true,
      },
      error: null,
    });
    authGetUser.mockResolvedValue({ data: { user: { id: "auth-user-1" } }, error: null });
  });

  it("getAuthedNotificationUser returns user for valid token", async () => {
    const { getAuthedNotificationUser } = await import("@/lib/notifications.server");
    await expect(getAuthedNotificationUser("tok")).resolves.toMatchObject({ id: "auth-user-1" });
  });

  it("getAuthedNotificationUser throws when token invalid", async () => {
    authGetUser.mockResolvedValueOnce({ data: { user: null }, error: new Error("x") });
    const { getAuthedNotificationUser } = await import("@/lib/notifications.server");
    await expect(getAuthedNotificationUser("bad")).rejects.toSatisfy(
      (e: unknown) => e instanceof Response && e.status === 401,
    );
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

  it("skips insert when user disabled ticket_assigned notifications", async () => {
    profilesMaybeSingle.mockResolvedValueOnce({
      data: { notify_ticket_assigned: false },
      error: null,
    });
    const { createNotificationForUser } = await import("@/lib/notifications.server");
    const notification = await createNotificationForUser({
      userId: "11111111-1111-4111-8111-111111111111",
      type: "ticket_assigned",
      title: "X",
      body: null,
      payload: null,
      link: null,
    });
    expect(notification).toBeNull();
    expect(calls.inserted).toHaveLength(0);
  });

  it("creates notification for types without preference column", async () => {
    const { createNotificationForUser } = await import("@/lib/notifications.server");
    const notification = await createNotificationForUser({
      userId: "11111111-1111-4111-8111-111111111111",
      type: "ticket_comment",
      title: "Commento",
      body: "Testo",
      payload: null,
      link: null,
    });
    expect(notification?.id).toBe("notification-1");
  });

  it("creates notifications for all admins", async () => {
    const { createNotificationForAdmins } = await import("@/lib/notifications.server");
    await createNotificationForAdmins({
      type: "automation_failed",
      title: "Errore",
      body: "Dettaglio",
      payload: null,
      link: "/automations",
    });
    expect(calls.inserted.length).toBeGreaterThanOrEqual(1);
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
