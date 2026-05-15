import { useEffect, useState, useCallback, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { getMyDashboardLayout, updateMyDashboardLayout } from "@/lib/user-profile";
import {
  type WidgetId,
  type DashboardLayout,
  type WidgetLayoutItem,
  DASHBOARD_WIDGETS,
  createDefaultLayout,
} from "@/components/dashboard/widget-registry";

export function useDashboardLayout() {
  const { session } = useAuth();
  const loadLayout = useServerFn(getMyDashboardLayout);
  const saveLayout = useServerFn(updateMyDashboardLayout);
  const [layout, setLayout] = useState<DashboardLayout | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    if (!session?.access_token) return;
    setLoading(true);
    loadLayout({ data: { accessToken: session.access_token } })
      .then((data) => {
        if (data) {
          setLayout(data);
        } else {
          setLayout(createDefaultLayout());
        }
      })
      .catch(() => {
        setLayout(createDefaultLayout());
      })
      .finally(() => setLoading(false));
  }, [session?.access_token]);

  // Persist layout changes
  const persist = useCallback(
    (newLayout: DashboardLayout) => {
      if (!session?.access_token) return;
      saveLayout({ data: { accessToken: session.access_token, layout: newLayout } }).catch(() => {
        toast.error("Errore nel salvare la disposizione dei widget");
      });
    },
    [session?.access_token, saveLayout],
  );

  // Reorder: move a widget from oldIndex to newIndex
  const reorder = useCallback(
    (oldIndex: number, newIndex: number) => {
      if (!layout) return;
      const sorted = [...layout.widgets].sort((a, b) => a.order - b.order);
      const [moved] = sorted.splice(oldIndex, 1);
      sorted.splice(newIndex, 0, moved);
      const updated: WidgetLayoutItem[] = sorted.map((w, i) => ({ ...w, order: i }));
      const newLayout: DashboardLayout = { widgets: updated };
      setLayout(newLayout);
      persist(newLayout);
    },
    [layout, persist],
  );

  // Toggle visibility
  const toggleVisibility = useCallback(
    (widgetId: WidgetId) => {
      if (!layout) return;
      const updated = layout.widgets.map((w) =>
        w.id === widgetId ? { ...w, visible: !w.visible } : w,
      );
      const newLayout: DashboardLayout = { widgets: updated };
      setLayout(newLayout);
      persist(newLayout);
    },
    [layout, persist],
  );

  // Ordered and filtered widgets sorted by order, filtered by visible
  const visibleWidgets = useMemo(() => {
    if (!layout) return [];
    return [...layout.widgets]
      .filter((w) => w.visible)
      .sort((a, b) => a.order - b.order);
  }, [layout]);

  // All widgets sorted by order (for edit mode)
  const allWidgets = useMemo(() => {
    if (!layout) return DASHBOARD_WIDGETS.map((w, i) => ({ id: w.id, order: i, visible: true }));
    return [...layout.widgets].sort((a, b) => a.order - b.order);
  }, [layout]);

  return {
    layout,
    loading,
    editMode,
    setEditMode,
    visibleWidgets,
    allWidgets,
    reorder,
    toggleVisibility,
  };
}
