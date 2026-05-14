import { X } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";

const MODAL_MAX_WIDTH: Record<"md" | "lg" | "xl", string> = {
  md: "560px",
  lg: "680px",
  xl: "920px",
};

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg" | "xl";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[500] flex items-start justify-center px-4 py-8 overflow-y-auto"
      style={{ background: "rgba(0,0,0,.45)", backdropFilter: "blur(3px)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="pc-anim-in flex flex-col w-full my-auto"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          boxShadow: "var(--shadow-lg)",
          maxWidth: MODAL_MAX_WIDTH[size],
          maxHeight: "calc(100vh - 4rem)",
        }}
      >
        <div
          className="flex items-center justify-between px-[22px] py-[16px] border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <span className="text-[15px] font-bold" style={{ fontFamily: "var(--font-head)" }}>
            {title}
          </span>
          <button onClick={onClose} className="pc-btn-icon">
            <X className="w-3 h-3" />
          </button>
        </div>
        <div className="overflow-y-auto px-[22px] py-[20px] flex-1">{children}</div>
        {footer && (
          <div
            className="flex justify-end gap-2 px-[22px] py-[14px] border-t"
            style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
