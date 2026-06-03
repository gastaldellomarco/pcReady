import { useVirtualizer, type VirtualItem, type Virtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";

/**
 *
 */
export interface UseVirtualListOptions {
  /** Number of items in the list */
  count: number;
  /** Estimated size per item (fallback before measureElement runs) */
  estimateSize: number | (() => number);
  /** Number of extra items rendered outside the visible window (default: 15) */
  overscan?: number;
  /** Minimum item count before virtualization activates (default: 50) */
  threshold?: number;
  /** Override the threshold-based enabled check */
  enabled?: boolean;
}

/**
 *
 */
export interface UseVirtualListReturn<T extends HTMLElement = HTMLDivElement> {
  /** Ref to attach to the scrollable container element */
  containerRef: React.RefObject<T | null>;
  /** The Virtualizer instance (for use as measureElement ref target) */
  virtualizer: Virtualizer<T, Element>;
  /** Virtual items to render, or [] when under threshold */
  virtualItems: VirtualItem[];
  /** Total scroll height of all items, or 0 when under threshold */
  totalSize: number;
}

/**
 * Shared hook for virtualized lists using @tanstack/react-virtual.
 *
 * Extracts the common pattern used across inventory, tickets, clients, and contacts pages:
 * - measureElement for dynamic height
 * - conditional enable based on a threshold
 * - getVirtualItems / getTotalSize cached via useMemo
 *
 * @example
 * ```tsx
 * const { containerRef, virtualizer, virtualItems, totalSize } = useVirtualList({
 *   count: rows.length,
 *   estimateSize: 40,
 *   overscan: 15,
 *   threshold: 50,
 * });
 *
 * // Container:
 * <div ref={containerRef} style={{ maxHeight: '...', overflow: 'auto' }}>
 *   <table>...</table>
 * </div>
 *
 * // Virtual items:
 * // <tr ref={virtualizer.measureElement} ...>
 * ```
 */
export function useVirtualList<T extends HTMLElement = HTMLDivElement>({
  count,
  estimateSize,
  overscan = 15,
  threshold = 50,
  enabled: enabledProp,
}: UseVirtualListOptions): UseVirtualListReturn<T> {
  const containerRef = useRef<T>(null);
  const shouldEnable = enabledProp ?? (count > threshold);

  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => containerRef.current,
    estimateSize: typeof estimateSize === "number" ? () => estimateSize : estimateSize,
    measureElement: (el) => el.getBoundingClientRect().height,
    overscan,
    enabled: shouldEnable,
  });

  const virtualItems = shouldEnable ? virtualizer.getVirtualItems() : [];
  const totalSize = shouldEnable ? virtualizer.getTotalSize() : 0;

  return { containerRef, virtualizer, virtualItems, totalSize };
}
