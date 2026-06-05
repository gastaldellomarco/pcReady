"use client";

/**
 * MobileCardView — converts table data to vertical card layout for mobile.
 *
 * Use this in place of `<table>` inside `overflow-x-auto` on mobile viewports.
 * Each row becomes a card with labeled fields stacked vertically.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 *
 */
export interface MobileCardColumn<T> {
  /** Label displayed left of the value */
  label: string;
  /** Accessor key or function to extract the value. Required if render is not provided */
  accessor?: keyof T | ((row: T) => React.ReactNode);
  /** Optional custom render, overrides accessor */
  render?: (row: T) => React.ReactNode;
  /** Whether this field acts as the primary "title" of the card */
  primary?: boolean;
  /** Hide this column on desktop (show only on mobile) */
  mobileOnly?: boolean;
  /** Hide this column on mobile (show only on desktop) */
  desktopOnly?: boolean;
}

/**
 *
 */
export interface MobileCardViewProps<T> {
  data: T[];
  columns: MobileCardColumn<T>[];
  keyField: keyof T;
  onRowClick?: (row: T) => void;
  className?: string;
  emptyMessage?: string;
}

/**
 *
 */
export function MobileCardView<T extends Record<string, any>>({
  data,
  columns,
  keyField,
  onRowClick,
  className,
  emptyMessage = "Nessun dato",
}: MobileCardViewProps<T>) {
  if (!data.length) {
    return <div className="py-8 text-center text-sm text-text3">{emptyMessage}</div>;
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {data.map((row) => {
        const primaryCol = columns.find((c) => c.primary);
        const secondaryCols = columns.filter((c) => !c.primary && !c.desktopOnly);

        return (
          <div
            key={String(row[keyField])}
            className="rounded-[10px] border px-4 py-3 transition-colors"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
            }}
            onClick={() => onRowClick?.(row)}
            role={onRowClick ? "button" : undefined}
            tabIndex={onRowClick ? 0 : undefined}
            onKeyDown={
              onRowClick
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onRowClick(row);
                    }
                  }
                : undefined
            }
          >
            {/* Primary field (title) */}
            {primaryCol && (
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1 text-[14px] font-semibold leading-snug break-anywhere">
                  {primaryCol.render
                    ? primaryCol.render(row)
                    : typeof primaryCol.accessor === "function"
                      ? (primaryCol.accessor as (row: T) => React.ReactNode)(row)
                      : primaryCol.accessor != null
                        ? row[primaryCol.accessor]
                        : undefined}
                </div>
              </div>
            )}

            {/* Secondary fields */}
            <div className="flex flex-col gap-1.5">
              {secondaryCols.map((col) => {
                const accessor = col.accessor;
                const value = col.render
                  ? col.render(row)
                  : typeof accessor === "function"
                    ? accessor(row)
                    : accessor != null
                      ? row[accessor]
                      : undefined;

                if (value == null || value === "" || value === false) return null;

                return (
                  <div
                    key={String(col.label)}
                    className="flex items-start justify-between gap-2 text-[12.5px]"
                  >
                    <span className="shrink-0 text-text3 font-medium min-w-[80px]">
                      {col.label}
                    </span>
                    <span className="flex-1 text-right break-anywhere">{value}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
