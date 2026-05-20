import * as React from "react";
import { cn } from "@/lib/utils";

type Props = React.PropsWithChildren<{
  className?: string;
  tableClassName?: string;
}>;

export default function OverflowTable({ children, className, tableClassName }: Props) {
  return (
    <div className={cn("border rounded-md overflow-x-auto-table max-w-full", className)}>
      <div className={cn("min-w-full", tableClassName)}>{children}</div>
    </div>
  );
}
