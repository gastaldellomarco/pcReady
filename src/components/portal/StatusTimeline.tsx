import { STATUS_META, type TicketStatus } from "@/lib/pcready";

interface StatusHistoryItem {
  id: string;
  ticket_id: string;
  from_status: TicketStatus | null;
  to_status: TicketStatus;
  changed_by: string | null;
  changed_at: string;
  note: string | null;
  actor?: { full_name: string; initials: string } | null;
}

interface StatusTimelineProps {
  history: StatusHistoryItem[];
  currentStatus?: TicketStatus;
}

export function StatusTimeline({ history, currentStatus }: StatusTimelineProps) {
  if (!history || history.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        Nessuno storico disponibile per questo ticket.
      </div>
    );
  }

  // Sort by date ascending to show timeline from oldest to newest
  const sortedHistory = [...history].sort(
    (a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime()
  );

  // Determine which statuses have been completed based on history
  const completedStatuses = new Set<TicketStatus>();
  const reachedStatuses = new Set<TicketStatus>();
  
  for (const item of sortedHistory) {
    reachedStatuses.add(item.to_status);
    if (item.from_status) {
      completedStatuses.add(item.from_status);
    }
  }

  const allStatuses: TicketStatus[] = ["pending", "in-progress", "testing", "ready"];
  const currentStatusFromHistory = sortedHistory[sortedHistory.length - 1]?.to_status;
  const effectiveCurrentStatus = currentStatus || currentStatusFromHistory;

  return (
    <div className="space-y-4">
      {/* Visual Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-border" />
        
        <ol className="space-y-4">
          {sortedHistory.map((item, index) => {
            const toMeta = STATUS_META[item.to_status];
            const fromMeta = item.from_status ? STATUS_META[item.from_status] : null;
            const isLatest = index === sortedHistory.length - 1;
            const isInitial = item.from_status === null;
            
            return (
              <li key={item.id} className="relative flex items-start gap-3">
                {/* Status dot */}
                <div 
                  className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isLatest ? "ring-2 ring-offset-1 ring-primary" : ""
                  }`}
                  style={{
                    backgroundColor: toMeta.color,
                    boxShadow: isLatest ? `0 0 0 4px ${toMeta.color}33` : undefined,
                  }}
                >
                  <span className="text-white text-xs font-bold">
                    {index + 1}
                  </span>
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span 
                      className="text-sm font-semibold"
                      style={{ color: toMeta.color }}
                    >
                      {toMeta.label}
                    </span>
                    {isInitial && (
                      <span className="text-xs text-muted-foreground">(Creazione ticket)</span>
                    )}
                    {isLatest && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                        Attuale
                      </span>
                    )}
                  </div>
                  
                  {/* Transition info */}
                  {fromMeta && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Da: {fromMeta.label}
                    </p>
                  )}
                  
                  {/* Timestamp and actor */}
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>{formatDateTime(item.changed_at)}</span>
                    {item.actor?.full_name && (
                      <span className="flex items-center gap-1">
                        <span>•</span>
                        <span>Tecnico: {item.actor.full_name}</span>
                      </span>
                    )}
                  </div>
                  
                  {/* Optional note */}
                  {item.note && (
                    <p className="text-xs text-muted-foreground mt-1 italic">
                      &ldquo;{item.note}&rdquo;
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Status progression summary */}
      <div className="pt-2 border-t">
        <p className="text-xs font-medium text-muted-foreground mb-2">Progressione stati:</p>
        <div className="flex items-center gap-1 flex-wrap">
          {allStatuses.map((status, idx) => {
            const meta = STATUS_META[status];
            const isCompleted = completedStatuses.has(status);
            const isCurrent = status === effectiveCurrentStatus;
            const isFuture = !reachedStatuses.has(status);
            
            return (
              <div key={status} className="flex items-center">
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    isCurrent
                      ? "bg-primary text-primary-foreground"
                      : isCompleted
                      ? "text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                  style={
                    isCurrent || isCompleted
                      ? { backgroundColor: isCurrent ? undefined : meta.color }
                      : undefined
                  }
                >
                  {meta.label}
                </span>
                {idx < allStatuses.length - 1 && (
                  <span className="text-muted-foreground mx-1">→</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
