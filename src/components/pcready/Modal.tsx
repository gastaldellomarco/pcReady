import { X } from "lucide-react";
import { type ReactNode, useEffect } from "react";

export function Modal({ open, onClose, title, children, footer, size = "md" }:
  { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; size?: "md" | "lg" }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,.45)", backdropFilter: "blur(3px)" }}
      onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className="pc-anim-in flex flex-col max-h-[90vh] w-full"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          boxShadow: "var(--shadow-lg)",
          maxWidth: size === "lg" ? "680px" : "560px",
        }}>
        <div className="flex items-center justify-between px-[22px] py-[16px] border-b" style={{ borderColor: "var(--border)" }}>
          <span className="text-[15px] font-bold" style={{ fontFamily: "var(--font-head)" }}>{title}</span>
          <button onClick={onClose} className="pc-btn-icon"><X className="w-3 h-3" /></button>
        </div>
        <div className="overflow-y-auto px-[22px] py-[20px] flex-1">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 px-[22px] py-[14px] border-t"
            style={{ borderColor: "var(--border)", background: "var(--surface2)" }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
