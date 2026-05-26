import { useEffect, useState } from "react";
import { listBundleMonthlyUsage } from "./bundles";

export function useMonthlyUsage(deps: {
  assignmentsDataUpdatedAt: number | undefined;
  usageDataUpdatedAt: number | undefined;
}) {
  const [monthlyUsage, setMonthlyUsage] = useState<any[]>([]);

  useEffect(() => {
    listBundleMonthlyUsage()
      .then((usage) => setMonthlyUsage(usage as any[]))
      .catch(() => setMonthlyUsage([]));
  }, [deps.assignmentsDataUpdatedAt, deps.usageDataUpdatedAt]);

  return monthlyUsage;
}
