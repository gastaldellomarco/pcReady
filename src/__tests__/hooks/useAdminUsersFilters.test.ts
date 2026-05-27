// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAdminUsersFilters } from "@/hooks/useAdminUsersFilters";
import type { AdminUserRow } from "@/lib/admin-users";

// ── Factory helper ──────────────────────────────────────────────────────

function createUser(overrides: Partial<AdminUserRow> = {}): AdminUserRow {
  return {
    id: "user-1",
    email: "mario@test.it",
    full_name: "Mario Rossi",
    initials: "MR",
    role: "tech",
    status: "active",
    created_at: "2026-01-01T00:00:00.000Z",
    last_sign_in_at: "2026-06-01T10:00:00.000Z",
    invited_at: null,
    mfa_enabled: true,
    mfa_required: false,
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("useAdminUsersFilters", () => {
  describe("default state", () => {
    it("returns all rows unfiltered", () => {
      const rows = [createUser({ id: "1" }), createUser({ id: "2" })];
      const { result } = renderHook(() => useAdminUsersFilters(rows));

      expect(result.current.filtered).toHaveLength(2);
      expect(result.current.q).toBe("");
      expect(result.current.role).toBe("");
    });

    it("returns empty array when no rows", () => {
      const { result } = renderHook(() => useAdminUsersFilters([]));

      expect(result.current.filtered).toHaveLength(0);
    });
  });

  describe("text search (q)", () => {
    it("filters by full_name (case insensitive)", () => {
      const rows = [
        createUser({ id: "1", full_name: "Mario Rossi", email: "mario@test.it" }),
        createUser({ id: "2", full_name: "Luigi Bianchi", email: "luigi@test.it" }),
      ];
      const { result } = renderHook(() => useAdminUsersFilters(rows));

      act(() => result.current.setQ("mario"));

      expect(result.current.filtered).toHaveLength(1);
      expect(result.current.filtered[0].id).toBe("1");
    });

    it("filters by email (case insensitive)", () => {
      const rows = [
        createUser({ id: "1", email: "mario@test.it" }),
        createUser({ id: "2", email: "luigi@test.it" }),
      ];
      const { result } = renderHook(() => useAdminUsersFilters(rows));

      act(() => result.current.setQ("LUIGI"));

      expect(result.current.filtered).toHaveLength(1);
      expect(result.current.filtered[0].id).toBe("2");
    });

    it("matches partial text in combined full_name + email", () => {
      const rows = [
        createUser({
          id: "1",
          full_name: "John Doe",
          email: "john@example.com",
        }),
        createUser({
          id: "2",
          full_name: "Jane Smith",
          email: "jane@example.com",
        }),
      ];
      const { result } = renderHook(() => useAdminUsersFilters(rows));

      // "doe" appears only in full_name of user 1
      act(() => result.current.setQ("doe"));
      expect(result.current.filtered).toHaveLength(1);
      expect(result.current.filtered[0].id).toBe("1");

      // "example" appears in both emails
      act(() => result.current.setQ("example"));
      expect(result.current.filtered).toHaveLength(2);
    });

    it("shows empty when search matches nothing", () => {
      const rows = [createUser({ id: "1", full_name: "Mario Rossi" })];
      const { result } = renderHook(() => useAdminUsersFilters(rows));

      act(() => result.current.setQ("zzzzz"));

      expect(result.current.filtered).toHaveLength(0);
    });

    it("clearing search shows all rows", () => {
      const rows = [
        createUser({ id: "1", email: "uno@test.it" }),
        createUser({ id: "2", email: "due@test.it" }),
      ];
      const { result } = renderHook(() => useAdminUsersFilters(rows));

      act(() => result.current.setQ("inesistente"));
      expect(result.current.filtered).toHaveLength(0);

      act(() => result.current.setQ(""));
      expect(result.current.filtered).toHaveLength(2);
    });

    it("trims whitespace in search query", () => {
      const rows = [
        createUser({ id: "1", full_name: "Mario Rossi", email: "mario@test.it" }),
        createUser({ id: "2", full_name: "Luigi Bianchi", email: "luigi@test.it" }),
      ];
      const { result } = renderHook(() => useAdminUsersFilters(rows));

      act(() => result.current.setQ("  mario  "));

      expect(result.current.filtered).toHaveLength(1);
      expect(result.current.filtered[0].id).toBe("1");
    });

    it("empty-only whitespace shows all rows", () => {
      const rows = [createUser({ id: "1" }), createUser({ id: "2" })];
      const { result } = renderHook(() => useAdminUsersFilters(rows));

      act(() => result.current.setQ("   "));

      // needle = "   ".trim() = "" → !needle is true → all match
      expect(result.current.filtered).toHaveLength(2);
    });

    it("does not match 'null' string when email is null", () => {
      const rows = [
        createUser({ id: "1", full_name: "Tizio", email: null }),
      ];
      const { result } = renderHook(() => useAdminUsersFilters(rows));

      act(() => result.current.setQ("null"));

      expect(result.current.filtered).toHaveLength(0);
    });
  });

  describe("role filter", () => {
    it("filters by role", () => {
      const rows = [
        createUser({ id: "1", role: "admin" }),
        createUser({ id: "2", role: "tech" }),
        createUser({ id: "3", role: "viewer" }),
      ];
      const { result } = renderHook(() => useAdminUsersFilters(rows));

      act(() => result.current.setRole("admin"));

      expect(result.current.filtered).toHaveLength(1);
      expect(result.current.filtered[0].id).toBe("1");
    });

    it("clearing role filter shows all", () => {
      const rows = [
        createUser({ id: "1", role: "admin" }),
        createUser({ id: "2", role: "tech" }),
      ];
      const { result } = renderHook(() => useAdminUsersFilters(rows));

      act(() => result.current.setRole("admin"));
      expect(result.current.filtered).toHaveLength(1);

      act(() => result.current.setRole(""));
      expect(result.current.filtered).toHaveLength(2);
    });

    it("returns empty for non-matching role", () => {
      const rows = [createUser({ id: "1", role: "tech" })];
      const { result } = renderHook(() => useAdminUsersFilters(rows));

      act(() => result.current.setRole("viewer"));

      expect(result.current.filtered).toHaveLength(0);
    });
  });

  describe("combined filters", () => {
    it("applies text search + role filter simultaneously", () => {
      const rows = [
        createUser({
          id: "1",
          full_name: "Mario Rossi",
          email: "mario@test.it",
          role: "admin",
        }),
        createUser({
          id: "2",
          full_name: "Mario Verdi",
          email: "mario.verdi@test.it",
          role: "tech",
        }),
        createUser({
          id: "3",
          full_name: "Luigi Bianchi",
          email: "luigi@test.it",
          role: "admin",
        }),
      ];
      const { result } = renderHook(() => useAdminUsersFilters(rows));

      act(() => {
        result.current.setQ("mario");
        result.current.setRole("admin");
      });

      // Only user 1 matches both "mario" in name AND role="admin"
      expect(result.current.filtered).toHaveLength(1);
      expect(result.current.filtered[0].id).toBe("1");
    });

    it("clearing one filter keeps the other active", () => {
      const rows = [
        createUser({ id: "1", full_name: "Mario Rossi", role: "admin" }),
        createUser({ id: "2", full_name: "Mario Verdi", role: "tech" }),
      ];
      const { result } = renderHook(() => useAdminUsersFilters(rows));

      act(() => {
        result.current.setQ("mario");
        result.current.setRole("admin");
      });
      expect(result.current.filtered).toHaveLength(1);

      // Clear only role
      act(() => result.current.setRole(""));
      expect(result.current.filtered).toHaveLength(2); // both match "mario"

      // Clear only text
      act(() => result.current.setQ(""));
      expect(result.current.filtered).toHaveLength(2); // no filters active
    });
  });

  describe("reactivity to rows changes", () => {
    it("recomputes filtered when rows change", () => {
      const rows1 = [createUser({ id: "1", full_name: "Mario" })];
      const rows2 = [
        createUser({ id: "1", full_name: "Mario" }),
        createUser({ id: "2", full_name: "Luigi" }),
      ];

      const { result, rerender } = renderHook(
        ({ rows }) => useAdminUsersFilters(rows),
        { initialProps: { rows: rows1 } },
      );

      expect(result.current.filtered).toHaveLength(1);

      rerender({ rows: rows2 });
      expect(result.current.filtered).toHaveLength(2);
    });

    it("applies active filter to new rows", () => {
      const rows1 = [createUser({ id: "1", role: "admin" })];
      const rows2 = [
        createUser({ id: "1", role: "admin" }),
        createUser({ id: "2", role: "tech" }),
      ];

      const { result, rerender } = renderHook(
        ({ rows }) => useAdminUsersFilters(rows),
        { initialProps: { rows: rows1 } },
      );

      act(() => result.current.setRole("admin"));
      expect(result.current.filtered).toHaveLength(1);

      // New rows arrive — only admin should still be shown
      rerender({ rows: rows2 });
      expect(result.current.filtered).toHaveLength(1);
      expect(result.current.filtered[0].id).toBe("1");
    });

    it("handles row with null email gracefully", () => {
      const rows = [
        createUser({
          id: "1",
          full_name: "No Email User",
          email: null,
        }),
        createUser({
          id: "2",
          full_name: "With Email",
          email: "with@email.it",
        }),
      ];
      const { result } = renderHook(() => useAdminUsersFilters(rows));

      // Searching by name that partially matches both
      act(() => result.current.setQ("Email"));

      expect(result.current.filtered).toHaveLength(2);
    });
  });
});
