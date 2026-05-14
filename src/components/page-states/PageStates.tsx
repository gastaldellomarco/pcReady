import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type PageStateVariant = "app" | "portal";

function shellClass(variant: PageStateVariant) {
  return variant === "portal"
    ? "rounded-lg border border-border bg-card p-6 text-center shadow-sm"
    : "pc-card p-6 text-center";
}

export function PageFetchError({
  title = "Impossibile completare la richiesta",
  message,
  onRetry,
  variant = "app",
  className,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  variant?: PageStateVariant;
  className?: string;
}) {
  return (
    <div className={cn(shellClass(variant), className)}>
      <h2 className="text-base font-semibold text-destructive">{title}</h2>
      <p className={cn("mt-2 text-sm", variant === "portal" ? "text-muted-foreground" : "text-text3")}>
        {message}
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {onRetry && (
          <Button type="button" variant="default" size="sm" onClick={onRetry}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Riprova
          </Button>
        )}
        <Button type="button" variant={onRetry ? "outline" : "default"} size="sm" onClick={() => window.location.reload()}>
          Ricarica pagina
        </Button>
      </div>
    </div>
  );
}

export function PageEmptyState({
  icon: Icon = Inbox,
  title,
  description,
  children,
  variant = "app",
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  children?: ReactNode;
  variant?: PageStateVariant;
  className?: string;
}) {
  return (
    <div className={cn(shellClass(variant), className)}>
      <Icon
        className={cn(
          "mx-auto h-10 w-10",
          variant === "portal" ? "text-muted-foreground" : "text-text3",
        )}
        aria-hidden
      />
      <h2 className={cn("mt-3 text-base font-semibold", variant === "portal" ? "text-foreground" : "text-text")}>
        {title}
      </h2>
      {description && (
        <p className={cn("mt-2 text-sm", variant === "portal" ? "text-muted-foreground" : "text-text3")}>
          {description}
        </p>
      )}
      {children ? <div className="mt-4 flex flex-wrap justify-center gap-2">{children}</div> : null}
    </div>
  );
}

export function ListSkeleton({
  rows = 6,
  variant = "app",
  className,
}: {
  rows?: number;
  variant?: PageStateVariant;
  className?: string;
}) {
  const cardClass =
    variant === "portal"
      ? "rounded-lg border border-border bg-card p-4 space-y-2"
      : "pc-card p-4 space-y-2";

  return (
    <div className={cn("flex flex-col gap-3", className)} aria-busy aria-label="Caricamento in corso">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={cardClass}>
          <Skeleton className="h-4 w-1/3 max-w-[200px]" />
          <Skeleton className="h-3 w-2/3 max-w-[320px]" />
          <Skeleton className="h-3 w-1/2 max-w-[240px]" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeletonRows({
  rows = 8,
  columns = 5,
  cellClassName = "px-3 py-2.5",
}: {
  rows?: number;
  columns?: number;
  cellClassName?: string;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-b border-border last:border-0">
          {Array.from({ length: columns }).map((_, c) => (
            <td key={c} className={cellClassName}>
              <Skeleton className="h-3 w-full max-w-[140px]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function TableSkeleton({
  rows = 8,
  columns = 5,
  showToolbar = true,
  variant = "app",
  className,
}: {
  rows?: number;
  columns?: number;
  showToolbar?: boolean;
  variant?: PageStateVariant;
  className?: string;
}) {
  const wrap =
    variant === "portal"
      ? "rounded-lg border border-border bg-card overflow-hidden"
      : "pc-card overflow-hidden";

  return (
    <div className={cn(wrap, className)} aria-busy aria-label="Caricamento tabella">
      {showToolbar && (
        <div className="flex flex-wrap gap-2 border-b border-border p-3">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-28" />
          <Skeleton className="ml-auto h-9 w-24" />
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {Array.from({ length: columns }).map((_, c) => (
                <th key={c} className="px-3 py-2">
                  <Skeleton className="h-3 w-20" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <TableSkeletonRows rows={rows} columns={columns} />
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CardGridSkeleton({
  cards = 6,
  columnsClass = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
  variant = "app",
  className,
}: {
  cards?: number;
  columnsClass?: string;
  variant?: PageStateVariant;
  className?: string;
}) {
  const cardClass =
    variant === "portal"
      ? "rounded-lg border border-border bg-card p-4 space-y-3"
      : "pc-card p-4 space-y-3";

  return (
    <div className={cn(columnsClass, className)} aria-busy aria-label="Caricamento schede">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className={cardClass}>
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
    </div>
  );
}
