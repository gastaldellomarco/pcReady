import { Badge } from "@/components/ui/badge";
import { getLatestVersionNumber } from "@/lib/versioning";
import { useEffect, useState } from "react";

interface VersionBadgeProps {
  entityType: string;
  entityId: string;
  className?: string;
}

export function VersionBadge({ entityType, entityId, className }: VersionBadgeProps) {
  const [version, setVersion] = useState<number | null>(null);

  useEffect(() => {
    if (entityId) {
      getLatestVersionNumber(entityType, entityId)
        .then(setVersion)
        .catch(() => setVersion(null));
    }
  }, [entityType, entityId]);

  if (!version) return null;

  return (
    <Badge variant="outline" className={className}>
      v{version}
    </Badge>
  );
}