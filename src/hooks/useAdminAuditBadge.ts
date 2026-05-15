import { useEffect, useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAuditLogKpi } from "@/lib/audit-log";

export function useAdminAuditBadge(accessToken: string | undefined, isAdmin: boolean) {
  const [errorCount, setErrorCount] = useState(0);
  const loadKpi = useServerFn(getAuditLogKpi);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    if (!accessToken || !isAdmin) {
      setErrorCount(0);
      return;
    }

    const fetchErrors = () => {
      loadKpi({ data: { accessToken } })
        .then((data) => setErrorCount(data.recentErrors))
        .catch(() => {});
    };

    fetchErrors();
    intervalRef.current = setInterval(fetchErrors, 60000); // Refresh every minute

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [accessToken, isAdmin, loadKpi]);

  return errorCount;
}
