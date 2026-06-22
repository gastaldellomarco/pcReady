import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteMaintenanceSchedule } from "@/lib/maintenance";

/**
 * React Query mutation for hard-deleting a maintenance schedule.
 *
 * RBAC: the RLS policy "Admin delete maintenance schedules" only lets users
 * with `public.has_role(auth.uid(), 'admin')` succeed; non-admin callers
 * see PostgREST return 0 affected rows. The UI is expected to gate the
 * trigger button on `useAuth().isAdmin`.
 *
 * History rows keep their device (FK cascade) but get `schedule_id = NULL`
 * thanks to the `on delete set null` declaration in the migration, so the
 * historical record stays even after the schedule is removed.
 *
 * On success the dashboard widget (key `["dashboard","maintenance-overview"]`)
 * is invalidated. The calendar view (`MaintenanceCalendarView`) uses local
 * `useState`, so the calling component should also drop the deleted item
 * from its local list to refresh the visible grid.
 */
export function useDeleteMaintenanceSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMaintenanceSchedule(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard", "maintenance-overview"] });
    },
  });
}
