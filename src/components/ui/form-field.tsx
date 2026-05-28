import type { ReactNode } from "react";

/**
 * Reusable form field wrapper with a `<label>` and children.
 * Duplicated 7 times across the codebase before extraction.
 *
 * @param label - Label text rendered above the children.
 * @param children - Form control(s) to render below the label.
 */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="pc-label">{label}</label>
      {children}
    </div>
  );
}
