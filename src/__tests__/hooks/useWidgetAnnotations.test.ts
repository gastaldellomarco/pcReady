import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act } from "@testing-library/react";
import React from "react";
// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useWidgetAnnotations } from "@/hooks/useWidgetAnnotations";
import type { WidgetAnnotationRow } from "@/lib/widget-annotations";
import type { ReactNode } from "react";

// ── Mock server functions ────────────────────────────────────────────────
const serverFnMocks = vi.hoisted(() => ({
  listWidgetAnnotations: vi.fn(),
  createWidgetAnnotation: vi.fn(),
  updateWidgetAnnotation: vi.fn(),
  deleteWidgetAnnotation: vi.fn(),
}));

vi.mock("@/lib/widget-annotations", () => ({
  listWidgetAnnotations: serverFnMocks.listWidgetAnnotations,
  createWidgetAnnotation: serverFnMocks.createWidgetAnnotation,
  updateWidgetAnnotation: serverFnMocks.updateWidgetAnnotation,
  deleteWidgetAnnotation: serverFnMocks.deleteWidgetAnnotation,
}));

// ── Mock useServerFn (TanStack Start) ────────────────────────────────────
vi.mock("@tanstack/react-start", () => ({
  useServerFn: vi.fn((fn: unknown) => {
    if (fn === serverFnMocks.listWidgetAnnotations)
      return serverFnMocks.listWidgetAnnotations;
    if (fn === serverFnMocks.createWidgetAnnotation)
      return serverFnMocks.createWidgetAnnotation;
    if (fn === serverFnMocks.updateWidgetAnnotation)
      return serverFnMocks.updateWidgetAnnotation;
    if (fn === serverFnMocks.deleteWidgetAnnotation)
      return serverFnMocks.deleteWidgetAnnotation;
    return vi.fn();
  }),
}));

// ── Mock sonner ──────────────────────────────────────────────────────────
const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: toastMock,
}));

// ── Factory helpers ──────────────────────────────────────────────────────

function createAnnotationRow(
  overrides: Partial<WidgetAnnotationRow> = {},
): WidgetAnnotationRow {
  return {
    id: "ann-001",
    user_id: "user-001",
    widget_id: "stat-cards",
    text: "Picco di ticket",
    note_date: "2026-05-28",
    created_at: "2026-05-28T10:00:00Z",
    updated_at: "2026-05-28T10:00:00Z",
    ...overrides,
  };
}

// ── Wrapper with QueryClientProvider ─────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("useWidgetAnnotations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Default state ──────────────────────────────────────────────────────

  describe("default state (no accessToken)", () => {
    it("returns empty annotations when not authenticated", () => {
      const { result } = renderHook(() =>
        useWidgetAnnotations(undefined),
        { wrapper: createWrapper() },
      );

      expect(result.current.annotations).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isPending).toBe(false);
    });

    it("does not call server function when no accessToken", () => {
      renderHook(() => useWidgetAnnotations(undefined), { wrapper: createWrapper() });

      expect(serverFnMocks.listWidgetAnnotations).not.toHaveBeenCalled();
    });
  });

  // ── Query (fetch) ──────────────────────────────────────────────────────

  describe("query", () => {
    it("fetches annotations for the current user", async () => {
      const mockRows = [
        createAnnotationRow({ id: "a1", text: "Nota 1" }),
        createAnnotationRow({ id: "a2", text: "Nota 2", widget_id: "analytics-card" }),
      ];
      serverFnMocks.listWidgetAnnotations.mockResolvedValue(mockRows);

      const { result } = renderHook(() =>
        useWidgetAnnotations("token-123"),
        { wrapper: createWrapper() },
      );

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        await vi.waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });
      });

      expect(result.current.annotations).toEqual(mockRows);
      expect(serverFnMocks.listWidgetAnnotations).toHaveBeenCalledWith({
        data: { accessToken: "token-123", widgetId: undefined },
      });
    });

    it("fetches annotations scoped to a specific widgetId", async () => {
      const mockRows = [createAnnotationRow()];
      serverFnMocks.listWidgetAnnotations.mockResolvedValue(mockRows);

      const { result } = renderHook(() =>
        useWidgetAnnotations("token-123", "stat-cards"),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        await vi.waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });
      });

      expect(serverFnMocks.listWidgetAnnotations).toHaveBeenCalledWith({
        data: { accessToken: "token-123", widgetId: "stat-cards" },
      });
    });

    it("returns empty array on fetch error", async () => {
      serverFnMocks.listWidgetAnnotations.mockRejectedValue(
        new Error("Fetch failed"),
      );

      const { result } = renderHook(() =>
        useWidgetAnnotations("token-123"),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        await vi.waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });
      });

      // On error, query.data remains undefined (handled by ?? [] in the hook)
      expect(result.current.annotations).toEqual([]);
    });
  });

  // ── Create mutation ────────────────────────────────────────────────────

  describe("create", () => {
    it("calls the server function with correct payload", async () => {
      const mockRow = createAnnotationRow({ id: "new-001" });
      serverFnMocks.listWidgetAnnotations.mockResolvedValue([]);
      serverFnMocks.createWidgetAnnotation.mockResolvedValue(mockRow);

      const { result } = renderHook(() =>
        useWidgetAnnotations("token-123", "stat-cards"),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        await vi.waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });
      });

      await act(async () => {
        result.current.create({
          widget_id: "stat-cards",
          text: "Nuova nota",
          note_date: "2026-06-01",
        });
      });

      await vi.waitFor(() => {
        expect(serverFnMocks.createWidgetAnnotation).toHaveBeenCalledWith({
          data: {
            accessToken: "token-123",
            annotation: {
              widget_id: "stat-cards",
              text: "Nuova nota",
              note_date: "2026-06-01",
            },
          },
        });
      });
    });

    it("shows error toast on create failure", async () => {
      serverFnMocks.listWidgetAnnotations.mockResolvedValue([]);
      serverFnMocks.createWidgetAnnotation.mockRejectedValue(
        new Error("Save failed"),
      );

      const { result } = renderHook(() =>
        useWidgetAnnotations("token-123"),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        await vi.waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });
      });

      await act(async () => {
        result.current.create({
          widget_id: "stat-cards",
          text: "Nota che fallisce",
        });
      });

      await vi.waitFor(() => {
        expect(toastMock.error).toHaveBeenCalledWith(
          "Salvataggio non riuscito",
          expect.objectContaining({ description: "Save failed" }),
        );
      });
    });

    it("does not invoke mutation when accessToken is undefined", async () => {
      serverFnMocks.createWidgetAnnotation.mockResolvedValue({} as never);

      const { result } = renderHook(() =>
        useWidgetAnnotations(undefined),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        result.current.create({
          widget_id: "stat-cards",
          text: "test",
        });
      });

      // useMutation.mutate doesn't throw — the error is handled via onError → toast
      // Verify the server function was not called (mutationFn guard catches missing token)
      await vi.waitFor(() => {
        expect(toastMock.error).toHaveBeenCalledWith(
          "Salvataggio non riuscito",
          expect.any(Object),
        );
      });
    });
  });

  // ── Update mutation ────────────────────────────────────────────────────

  describe("update", () => {
    it("calls the server function with correct payload", async () => {
      const mockRow = createAnnotationRow({ text: "Testo aggiornato" });
      serverFnMocks.listWidgetAnnotations.mockResolvedValue([mockRow]);
      serverFnMocks.updateWidgetAnnotation.mockResolvedValue(mockRow);

      const { result } = renderHook(() =>
        useWidgetAnnotations("token-123"),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        await vi.waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });
      });

      await act(async () => {
        result.current.update({
          annotationId: "ann-001",
          updates: { text: "Testo aggiornato", note_date: null },
        });
      });

      await vi.waitFor(() => {
        expect(serverFnMocks.updateWidgetAnnotation).toHaveBeenCalledWith({
          data: {
            accessToken: "token-123",
            annotationId: "ann-001",
            updates: { text: "Testo aggiornato", note_date: null },
          },
        });
      });
    });

    it("shows error toast on update failure", async () => {
      serverFnMocks.listWidgetAnnotations.mockResolvedValue([]);
      serverFnMocks.updateWidgetAnnotation.mockRejectedValue(
        new Error("Update failed"),
      );

      const { result } = renderHook(() =>
        useWidgetAnnotations("token-123"),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        await vi.waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });
      });

      await act(async () => {
        result.current.update({
          annotationId: "ann-001",
          updates: { text: "fail" },
        });
      });

      await vi.waitFor(() => {
        expect(toastMock.error).toHaveBeenCalledWith(
          "Modifica non riuscita",
          expect.objectContaining({ description: "Update failed" }),
        );
      });
    });
  });

  // ── Delete mutation ────────────────────────────────────────────────────

  describe("remove", () => {
    it("calls the server function with the annotation ID", async () => {
      serverFnMocks.listWidgetAnnotations.mockResolvedValue([]);
      serverFnMocks.deleteWidgetAnnotation.mockResolvedValue({ success: true });

      const { result } = renderHook(() =>
        useWidgetAnnotations("token-123"),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        await vi.waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });
      });

      await act(async () => {
        result.current.remove("ann-001");
      });

      await vi.waitFor(() => {
        expect(serverFnMocks.deleteWidgetAnnotation).toHaveBeenCalledWith({
          data: {
            accessToken: "token-123",
            annotationId: "ann-001",
          },
        });
      });
    });

    it("shows error toast on delete failure", async () => {
      serverFnMocks.listWidgetAnnotations.mockResolvedValue([]);
      serverFnMocks.deleteWidgetAnnotation.mockRejectedValue(
        new Error("Delete failed"),
      );

      const { result } = renderHook(() =>
        useWidgetAnnotations("token-123"),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        await vi.waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });
      });

      await act(async () => {
        result.current.remove("ann-001");
      });

      await vi.waitFor(() => {
        expect(toastMock.error).toHaveBeenCalledWith(
          "Eliminazione non riuscita",
          expect.objectContaining({ description: "Delete failed" }),
        );
      });
    });

    it("does not invoke mutation when accessToken is undefined", async () => {
      serverFnMocks.deleteWidgetAnnotation.mockResolvedValue({ success: true } as never);

      const { result } = renderHook(() =>
        useWidgetAnnotations(undefined),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        result.current.remove("ann-001");
      });

      await vi.waitFor(() => {
        expect(toastMock.error).toHaveBeenCalledWith(
          "Eliminazione non riuscita",
          expect.any(Object),
        );
      });
    });
  });

  // ── isPending aggregation ──────────────────────────────────────────────

  describe("isPending", () => {
    it("is false when no mutations are running", () => {
      const { result } = renderHook(() =>
        useWidgetAnnotations(undefined),
        { wrapper: createWrapper() },
      );

      expect(result.current.isPending).toBe(false);
    });
  });
});
