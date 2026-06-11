// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Mock State ───────────────────────────────────────────────────────

const mockState = vi.hoisted(() => ({
  calendarEventsData: null as any,
  calendarEventsError: null as Error | null,
  ticketsData: null as unknown as any[],
  ticketsError: null as Error | null,
  clientsData: null as unknown as any[],
  clientsError: null as Error | null,
  ticketDeleteError: null as Error | null,
  ticketInsertError: null as Error | null,
  reminderDeleteError: null as Error | null,
  reminderInsertError: null as Error | null,
}));

// ── Thenable Builder ─────────────────────────────────────────────────

/** Creates a thenable that reads mockState at resolve time (not closure time). */
function thenable(resolveData: () => { data: any; error: Error | null }) {
  const self: Record<string, any> = {};
  self.then = (resolve: any, reject: any) => {
    const { data, error } = resolveData();
    if (error) reject(error);
    else resolve({ data, error: null });
  };
  // Chainable methods return self
  for (const m of ["select", "lte", "order", "eq", "not", "or", "range", "insert", "update", "delete"]) {
    self[m] = () => self;
  }
  // Terminal: .single() returns the raw {data, error} wrapper
  self.single = () => {
    const { data, error } = resolveData();
    return error ? Promise.reject(error) : Promise.resolve({ data, error: null });
  };
  self.maybeSingle = () => {
    const { data, error } = resolveData();
    return error ? Promise.reject(error) : Promise.resolve({ data, error: null });
  };
  return self;
}

vi.mock("@/integrations/supabase/client", () => {
  // Resolver functions that read from mockState at call time
  const resolvers: Record<string, () => { data: any; error: Error | null }> = {
    calendar_events: () => ({ data: mockState.calendarEventsData, error: mockState.calendarEventsError }),
    tickets: () => ({ data: mockState.ticketsData, error: mockState.ticketsError }),
    clients: () => ({ data: mockState.clientsData, error: mockState.clientsError }),
    calendar_event_tickets: () => ({
      data: null,
      error: mockState.ticketDeleteError || mockState.ticketInsertError,
    }),
    calendar_event_reminders: () => ({
      data: null,
      error: mockState.reminderDeleteError || mockState.reminderInsertError,
    }),
  };

  return {
    supabase: {
      from: vi.fn((table: string) => {
        const resolveFn = resolvers[table] ?? (() => ({ data: null, error: null }));
        return thenable(resolveFn);
      }),
    },
  };
});

// ── Test Data ────────────────────────────────────────────────────────

const baseEvent = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  title: "Test Event",
  description: null,
  start_at: "2025-06-10T09:00:00.000Z",
  end_at: "2025-06-10T10:00:00.000Z",
  all_day: false,
  event_type: "intervention",
  ticket_id: null,
  assignee_id: null,
  client_id: null,
  color: null,
  estimated_duration_minutes: null,
  notes: null,
  availability_status: null,
  recurrence_frequency: null,
  recurrence_interval: null,
  recurrence_until: null,
  recurrence_count: null,
  recurrence_days: null,
  recurrence_series_id: null,
  recurrence_parent_id: null,
  recurrence_exception_date: null,
  external_provider: null,
  external_event_id: null,
  external_updated_at: null,
  sync_status: null,
  created_by: null,
  created_at: "2025-06-10T08:00:00.000Z",
  updated_at: "2025-06-10T08:00:00.000Z",
};

const userId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

// ── Tests ────────────────────────────────────────────────────────────

describe("data/calendar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.calendarEventsData = [];
    mockState.calendarEventsError = null;
    mockState.ticketsData = [];
    mockState.ticketsError = null;
    mockState.clientsData = [];
    mockState.clientsError = null;
    mockState.ticketDeleteError = null;
    mockState.ticketInsertError = null;
    mockState.reminderDeleteError = null;
    mockState.reminderInsertError = null;
  });

  // ── fetchCalendarEvents ───────────────────────────────────────────

  describe("fetchCalendarEvents", () => {
    it("returns empty array when no events", async () => {
      const { fetchCalendarEvents } = await import("@/lib/data/calendar");
      const result = await fetchCalendarEvents({
        rangeStart: new Date("2025-06-01"),
        rangeEnd: new Date("2025-06-30"),
      });
      expect(result).toEqual([]);
    });

    it("returns mapped events with joined data", async () => {
      const { fetchCalendarEvents } = await import("@/lib/data/calendar");
      mockState.calendarEventsData = [
        {
          ...baseEvent,
          id: "evt-1",
          title: "Intervento PC #42",
          client: { id: "c1", name: "Mario", company_name: "ACME S.r.l." },
          ticket: { ticket_code: "TKT-042" },
          calendar_event_tickets: [],
          calendar_event_reminders: [],
          assignee: { full_name: "Tech One", initials: "TO" },
        },
      ];

      const result = await fetchCalendarEvents({
        rangeStart: new Date("2025-06-01"),
        rangeEnd: new Date("2025-06-30"),
      });

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Intervento PC #42");
      expect(result[0].client_name).toBe("ACME S.r.l.");
      expect(result[0].ticket_code).toBe("TKT-042");
      expect(result[0].assignee_name).toBe("Tech One");
    });

    it("does not expand non-recurring events", async () => {
      const { fetchCalendarEvents } = await import("@/lib/data/calendar");
      mockState.calendarEventsData = [
        { ...baseEvent, id: "evt-1", recurrence_frequency: null },
      ];

      const result = await fetchCalendarEvents({
        rangeStart: new Date("2025-06-01"),
        rangeEnd: new Date("2025-06-30"),
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("evt-1");
      expect(result[0].occurrence_id).toBeUndefined();
    });

    it("throws on Supabase error", async () => {
      const { fetchCalendarEvents } = await import("@/lib/data/calendar");
      mockState.calendarEventsError = new Error("Connection lost");

      await expect(
        fetchCalendarEvents({
          rangeStart: new Date("2025-06-01"),
          rangeEnd: new Date("2025-06-30"),
        }),
      ).rejects.toThrow("Connection lost");
    });

    // ── Recurrence expansion ──────────────────────────────────────

    it("expands daily recurring event within range", async () => {
      const { fetchCalendarEvents } = await import("@/lib/data/calendar");
      const rangeStart = new Date("2025-06-01");
      const rangeEnd = new Date("2025-06-15T23:59:59.999Z");
      mockState.calendarEventsData = [
        {
          ...baseEvent,
          id: "evt-daily",
          recurrence_frequency: "daily",
          recurrence_interval: 1,
          start_at: "2025-06-10T09:00:00.000Z",
          end_at: "2025-06-10T10:00:00.000Z",
          ticket: null,
          client: null,
          calendar_event_tickets: [],
          calendar_event_reminders: [],
          assignee: null,
        },
      ];

      const result = await fetchCalendarEvents({ rangeStart, rangeEnd });
      // June 10-15 = 6 occurrences
      expect(result).toHaveLength(6);
      expect(result[0].occurrence_id).toBe("evt-daily");
      expect(result[0].is_recurring_instance).toBe(true);
      expect(result[0].occurrence_date).toBe("2025-06-10");
      expect(result[0].title).toBe("Test Event");
    });

    it("expands weekly recurring event within range", async () => {
      const { fetchCalendarEvents } = await import("@/lib/data/calendar");
      const rangeStart = new Date("2025-06-01");
      const rangeEnd = new Date("2025-06-30T23:59:59.999Z");
      mockState.calendarEventsData = [
        {
          ...baseEvent,
          id: "evt-weekly",
          recurrence_frequency: "weekly",
          recurrence_interval: 1,
          start_at: "2025-06-02T09:00:00.000Z", // Monday
          end_at: "2025-06-02T10:00:00.000Z",
          ticket: null,
          client: null,
          calendar_event_tickets: [],
          calendar_event_reminders: [],
          assignee: null,
        },
      ];

      const result = await fetchCalendarEvents({ rangeStart, rangeEnd });
      // June 2, 9, 16, 23, 30 = 5 occurrences
      expect(result).toHaveLength(5);
      expect(result[0].occurrence_date).toBe("2025-06-02");
      expect(result[1].occurrence_date).toBe("2025-06-09");
      expect(result[2].occurrence_date).toBe("2025-06-16");
      expect(result[3].occurrence_date).toBe("2025-06-23");
      expect(result[4].occurrence_date).toBe("2025-06-30");
      expect(result[0].id).toBe("evt-weekly__2025-06-02");
    });

    it("expands monthly recurring event", async () => {
      const { fetchCalendarEvents } = await import("@/lib/data/calendar");
      const rangeStart = new Date("2025-01-01");
      const rangeEnd = new Date("2025-06-30T23:59:59.999Z");
      mockState.calendarEventsData = [
        {
          ...baseEvent,
          id: "evt-monthly",
          recurrence_frequency: "monthly",
          recurrence_interval: 1,
          start_at: "2025-01-15T09:00:00.000Z",
          end_at: "2025-01-15T10:00:00.000Z",
          ticket: null,
          client: null,
          calendar_event_tickets: [],
          calendar_event_reminders: [],
          assignee: null,
        },
      ];

      const result = await fetchCalendarEvents({ rangeStart, rangeEnd });
      // Jan 15, Feb 15, Mar 15, Apr 15, May 15, Jun 15 = 6 occurrences
      expect(result).toHaveLength(6);
      expect(result[0].occurrence_date).toBe("2025-01-15");
      expect(result[5].occurrence_date).toBe("2025-06-15");
    });

    it("respects recurrence_interval (every 2 weeks)", async () => {
      const { fetchCalendarEvents } = await import("@/lib/data/calendar");
      const rangeStart = new Date("2025-06-01");
      const rangeEnd = new Date("2025-06-30T23:59:59.999Z");
      mockState.calendarEventsData = [
        {
          ...baseEvent,
          id: "evt-biweekly",
          recurrence_frequency: "weekly",
          recurrence_interval: 2,
          start_at: "2025-06-02T09:00:00.000Z",
          end_at: "2025-06-02T10:00:00.000Z",
          ticket: null,
          client: null,
          calendar_event_tickets: [],
          calendar_event_reminders: [],
          assignee: null,
        },
      ];

      const result = await fetchCalendarEvents({ rangeStart, rangeEnd });
      // June 2, 16, 30 = 3 occurrences
      expect(result).toHaveLength(3);
      expect(result[0].occurrence_date).toBe("2025-06-02");
      expect(result[1].occurrence_date).toBe("2025-06-16");
      expect(result[2].occurrence_date).toBe("2025-06-30");
    });

    it("stops at recurrence_until even if range extends further", async () => {
      const { fetchCalendarEvents } = await import("@/lib/data/calendar");
      const rangeStart = new Date("2025-06-01");
      const rangeEnd = new Date("2025-06-30T23:59:59.999Z");
      mockState.calendarEventsData = [
        {
          ...baseEvent,
          id: "evt-until",
          recurrence_frequency: "daily",
          recurrence_interval: 1,
          recurrence_until: "2025-06-12",
          start_at: "2025-06-10T09:00:00.000Z",
          end_at: "2025-06-10T10:00:00.000Z",
          ticket: null,
          client: null,
          calendar_event_tickets: [],
          calendar_event_reminders: [],
          assignee: null,
        },
      ];

      const result = await fetchCalendarEvents({ rangeStart, rangeEnd });
      // June 10, 11, 12 = 3 occurrences (stops at until, not rangeEnd)
      expect(result).toHaveLength(3);
      expect(result[0].occurrence_date).toBe("2025-06-10");
      expect(result[2].occurrence_date).toBe("2025-06-12");
    });

    it("stops at recurrence_count", async () => {
      const { fetchCalendarEvents } = await import("@/lib/data/calendar");
      const rangeStart = new Date("2025-06-01");
      const rangeEnd = new Date("2025-06-30T23:59:59.999Z");
      mockState.calendarEventsData = [
        {
          ...baseEvent,
          id: "evt-count",
          recurrence_frequency: "daily",
          recurrence_interval: 1,
          recurrence_count: 3,
          start_at: "2025-06-10T09:00:00.000Z",
          end_at: "2025-06-10T10:00:00.000Z",
          ticket: null,
          client: null,
          calendar_event_tickets: [],
          calendar_event_reminders: [],
          assignee: null,
        },
      ];

      const result = await fetchCalendarEvents({ rangeStart, rangeEnd });
      // Only 3 occurrences despite date range allowing more
      expect(result).toHaveLength(3);
      expect(result[0].occurrence_date).toBe("2025-06-10");
      expect(result[1].occurrence_date).toBe("2025-06-11");
      expect(result[2].occurrence_date).toBe("2025-06-12");
    });

    it("skips exception dates", async () => {
      const { fetchCalendarEvents } = await import("@/lib/data/calendar");
      const rangeStart = new Date("2025-06-01");
      const rangeEnd = new Date("2025-06-30T23:59:59.999Z");
      mockState.calendarEventsData = [
        // The recurring series event
        {
          ...baseEvent,
          id: "evt-series",
          recurrence_frequency: "daily",
          recurrence_interval: 1,
          start_at: "2025-06-10T09:00:00.000Z",
          end_at: "2025-06-10T10:00:00.000Z",
          ticket: null,
          client: null,
          calendar_event_tickets: [],
          calendar_event_reminders: [],
          assignee: null,
        },
        // The exception: overrides June 12 with different data
        {
          ...baseEvent,
          id: "evt-exc",
          recurrence_series_id: "evt-series",
          recurrence_exception_date: "2025-06-12",
          recurrence_frequency: null,
          recurrence_parent_id: "evt-series",
          title: "Moved to afternoon",
          start_at: "2025-06-12T14:00:00.000Z",
          end_at: "2025-06-12T15:00:00.000Z",
          ticket: null,
          client: null,
          calendar_event_tickets: [],
          calendar_event_reminders: [],
          assignee: null,
        },
      ];

      const result = await fetchCalendarEvents({ rangeStart, rangeEnd });
      // June 10-30 daily = 21 occurrences minus 1 exception (June 12) + 1 exception event = 21
      // The exception event passes through as non-recurring
      const seriesOccurrences = result.filter((e) => e.occurrence_id === "evt-series");
      const exceptionEvent = result.find((e) => e.id === "evt-exc");
      expect(seriesOccurrences).toHaveLength(20); // 21 days minus June 12
      expect(exceptionEvent).toBeTruthy();
      expect(exceptionEvent!.title).toBe("Moved to afternoon");
    });

    it("preserves occurrence metadata correctly", async () => {
      const { fetchCalendarEvents } = await import("@/lib/data/calendar");
      const rangeStart = new Date("2025-06-01");
      const rangeEnd = new Date("2025-06-15T23:59:59.999Z");
      mockState.calendarEventsData = [
        {
          ...baseEvent,
          id: "evt-meta",
          title: "Team Meeting",
          recurrence_frequency: "weekly",
          recurrence_interval: 1,
          start_at: "2025-06-02T09:00:00.000Z",
          end_at: "2025-06-02T10:00:00.000Z",
          ticket: null,
          client: null,
          calendar_event_tickets: [],
          calendar_event_reminders: [],
          assignee: null,
        },
      ];

      const result = await fetchCalendarEvents({ rangeStart, rangeEnd });
      const firstOccurrence = result[0];
      expect(firstOccurrence.occurrence_id).toBe("evt-meta");
      expect(firstOccurrence.occurrence_date).toBe("2025-06-02");
      expect(firstOccurrence.is_recurring_instance).toBe(true);
      expect(firstOccurrence.id).toBe("evt-meta__2025-06-02");
      expect(firstOccurrence.title).toBe("Team Meeting");
      expect(firstOccurrence.start_at).toBe("2025-06-02T09:00:00.000Z");
      expect(firstOccurrence.end_at).toBe("2025-06-02T10:00:00.000Z");
    });

    it("mixes recurring and non-recurring events", async () => {
      const { fetchCalendarEvents } = await import("@/lib/data/calendar");
      const rangeStart = new Date("2025-06-01");
      const rangeEnd = new Date("2025-06-15T23:59:59.999Z");
      mockState.calendarEventsData = [
        {
          ...baseEvent,
          id: "evt-daily",
          recurrence_frequency: "daily",
          recurrence_interval: 1,
          start_at: "2025-06-10T09:00:00.000Z",
          end_at: "2025-06-10T10:00:00.000Z",
          ticket: null,
          client: null,
          calendar_event_tickets: [],
          calendar_event_reminders: [],
          assignee: null,
        },
        {
          ...baseEvent,
          id: "evt-once",
          title: "One-off Meeting",
          recurrence_frequency: null,
          start_at: "2025-06-05T14:00:00.000Z",
          end_at: "2025-06-05T15:00:00.000Z",
          ticket: null,
          client: null,
          calendar_event_tickets: [],
          calendar_event_reminders: [],
          assignee: null,
        },
      ];

      const result = await fetchCalendarEvents({ rangeStart, rangeEnd });
      // 6 daily occurrences (June 10-15) + 1 non-recurring = 7, sorted by start_at
      expect(result).toHaveLength(7);
      // First should be the one-off (June 5)
      expect(result[0].id).toBe("evt-once");
      expect(result[0].title).toBe("One-off Meeting");
      expect(result[0].is_recurring_instance).toBeUndefined();
      // Rest should be daily occurrences
      const recurringOccurrences = result.filter((e) => e.is_recurring_instance);
      expect(recurringOccurrences).toHaveLength(6);
    });

    it("does not expand events with recurrence_parent_id (exceptions/children)", async () => {
      const { fetchCalendarEvents } = await import("@/lib/data/calendar");
      const rangeStart = new Date("2025-06-01");
      const rangeEnd = new Date("2025-06-30T23:59:59.999Z");
      mockState.calendarEventsData = [
        // A child event (individual occurrence edit) should NOT be expanded
        {
          ...baseEvent,
          id: "evt-child",
          recurrence_frequency: "daily", // frequency still set but has parent → isRecurring=false
          recurrence_parent_id: "evt-parent",
          start_at: "2025-06-10T09:00:00.000Z",
          end_at: "2025-06-10T10:00:00.000Z",
          ticket: null,
          client: null,
          calendar_event_tickets: [],
          calendar_event_reminders: [],
          assignee: null,
        },
      ];

      const result = await fetchCalendarEvents({ rangeStart, rangeEnd });
      // Only 1: the child event passes through as-is, not expanded
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("evt-child");
      expect(result[0].is_recurring_instance).toBeUndefined();
    });

    it("does not include occurrences where end_at is before rangeStart", async () => {
      const { fetchCalendarEvents } = await import("@/lib/data/calendar");
      // Range starts after the first occurrence ends
      const rangeStart = new Date("2025-06-12");
      const rangeEnd = new Date("2025-06-20T23:59:59.999Z");
      mockState.calendarEventsData = [
        {
          ...baseEvent,
          id: "evt-range",
          recurrence_frequency: "daily",
          recurrence_interval: 1,
          start_at: "2025-06-10T09:00:00.000Z",
          end_at: "2025-06-10T10:00:00.000Z",
          ticket: null,
          client: null,
          calendar_event_tickets: [],
          calendar_event_reminders: [],
          assignee: null,
        },
      ];

      const result = await fetchCalendarEvents({ rangeStart, rangeEnd });
      // June 10 ends 10:00, rangeStart is June 12 midnight → June 10 occurrence excluded
      // Remaining: June 12-20 = 9 occurrences
      expect(result).toHaveLength(9);
      expect(result[0].occurrence_date).toBe("2025-06-12");
    });
  });

  // ── fetchCalendarTicketOptions ─────────────────────────────────────

  describe("fetchCalendarTicketOptions", () => {
    it("returns ticket options", async () => {
      const { fetchCalendarTicketOptions } = await import("@/lib/data/calendar");
      mockState.ticketsData = [
        { id: "t1", ticket_code: "TKT-001", client: "ACME", client_id: "c1", status: "in-progress" },
      ];

      const result = await fetchCalendarTicketOptions("");
      expect(result).toHaveLength(1);
      expect(result[0].ticket_code).toBe("TKT-001");
    });

    it("throws on error", async () => {
      const { fetchCalendarTicketOptions } = await import("@/lib/data/calendar");
      mockState.ticketsError = new Error("DB error");
      await expect(fetchCalendarTicketOptions("")).rejects.toThrow("DB error");
    });
  });

  // ── fetchCalendarClientOptions ─────────────────────────────────────

  describe("fetchCalendarClientOptions", () => {
    it("returns client options", async () => {
      const { fetchCalendarClientOptions } = await import("@/lib/data/calendar");
      mockState.clientsData = [
        { id: "c1", name: "Mario", company_name: "ACME S.r.l." },
      ];

      const result = await fetchCalendarClientOptions("");
      expect(result).toHaveLength(1);
      expect(result[0].company_name).toBe("ACME S.r.l.");
    });

    it("throws on error", async () => {
      const { fetchCalendarClientOptions } = await import("@/lib/data/calendar");
      mockState.clientsError = new Error("DB error");
      await expect(fetchCalendarClientOptions("")).rejects.toThrow("DB error");
    });
  });

  // ── createCalendarEvent ────────────────────────────────────────────

  describe("createCalendarEvent", () => {
    it("creates event and returns stripped result", async () => {
      const { createCalendarEvent } = await import("@/lib/data/calendar");
      mockState.calendarEventsData = { ...baseEvent, id: "evt-new", title: "New Event" };

      const result = await createCalendarEvent(
        {
          title: "New Event",
          start_at: "2025-06-10T09:00:00.000Z",
          end_at: "2025-06-10T10:00:00.000Z",
          event_type: "intervention",
          ticket_ids: [],
          reminders: [],
        },
        userId,
      );

      expect(result.title).toBe("New Event");
      expect(result.id).toBe("evt-new");
      expect(result.client_name).toBeNull();
    });

    it("throws on insert error", async () => {
      const { createCalendarEvent } = await import("@/lib/data/calendar");
      mockState.calendarEventsError = new Error("Constraint violation");

      await expect(
        createCalendarEvent(
          {
            title: "Fail",
            start_at: "2025-06-10T09:00:00.000Z",
            end_at: "2025-06-10T10:00:00.000Z",
            event_type: "intervention",
          },
          userId,
        ),
      ).rejects.toThrow("Constraint violation");
    });
  });

  // ── updateCalendarEvent ────────────────────────────────────────────

  describe("updateCalendarEvent", () => {
    it("updates event and returns stripped result", async () => {
      const { updateCalendarEvent } = await import("@/lib/data/calendar");
      mockState.calendarEventsData = { ...baseEvent, id: "evt-up", title: "Updated Title" };

      const result = await updateCalendarEvent("evt-up", { title: "Updated Title" });

      expect(result.title).toBe("Updated Title");
      expect(result.id).toBe("evt-up");
    });

    it("throws on update error", async () => {
      const { updateCalendarEvent } = await import("@/lib/data/calendar");
      mockState.calendarEventsError = new Error("Not found");
      await expect(updateCalendarEvent("missing-id", { title: "Nope" })).rejects.toThrow("Not found");
    });
  });

  // ── deleteCalendarEvent ────────────────────────────────────────────

  describe("deleteCalendarEvent", () => {
    it("deletes event successfully", async () => {
      const { deleteCalendarEvent } = await import("@/lib/data/calendar");
      await expect(deleteCalendarEvent("evt-1")).resolves.toBeUndefined();
    });

    it("throws on delete error", async () => {
      const { deleteCalendarEvent } = await import("@/lib/data/calendar");
      mockState.calendarEventsError = new Error("Permission denied");
      await expect(deleteCalendarEvent("evt-1")).rejects.toThrow("Permission denied");
    });
  });

  // ── updateRecurringOccurrence ──────────────────────────────────────

  describe("updateRecurringOccurrence", () => {
    it("creates an exception occurrence", async () => {
      const { updateRecurringOccurrence } = await import("@/lib/data/calendar");
      mockState.calendarEventsData = { ...baseEvent, id: "evt-exc", title: "Exception" };

      const recurringEvent = {
        ...baseEvent,
        id: "evt-series",
        recurrence_frequency: "weekly" as const,
        recurrence_interval: 1,
        title: "Weekly Standup",
        occurrence_id: "evt-series",
        occurrence_date: "2025-06-10",
      };

      const result = await updateRecurringOccurrence(
        recurringEvent as any,
        { title: "Exception", notes: "Moved" },
        userId,
      );

      expect(result.title).toBe("Exception");
    });
  });
});
