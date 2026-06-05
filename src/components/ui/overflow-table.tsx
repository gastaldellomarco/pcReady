import * as React from "react";
import { cn } from "@/lib/utils";

type Props = React.PropsWithChildren<{
  className?: string;
  tableClassName?: string;
}>;

/**
 *
 */
export default function OverflowTable({ children, className, tableClassName }: Props) {
  return (
    <div
      className={cn("max-w-full overflow-x-auto rounded-md border overscroll-x-contain", className)}
      tabIndex={0}
      role="region"
      aria-label="Tabella con scorrimento orizzontale"
    >
      <div className={cn("min-w-full", tableClassName)}>{children}</div>
    </div>
  );
}
