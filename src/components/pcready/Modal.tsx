import { X } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";

const MODAL_MAX_WIDTH: Record<"md" | "lg" | "xl", string> = {
  md: "560px",
  lg: "680px",
  xl: "920px",
};

/**
 *
 */
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
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  // On mobile: render as bottom Drawer sheet
  if (isMobile) {
    return createPortal(
      <Drawer
        open={open}
        onOpenChange={(o) => {
          if (!o) onClose();
        }}
      >
        <DrawerContent className="max-h-[92dvh] overflow-y-auto px-4 pb-8 pt-2 safe-area-bottom">
          <DrawerHeader className="px-0">
            <DrawerTitle className="text-[16px]">{title}</DrawerTitle>
            <DrawerDescription className="sr-only">{title}</DrawerDescription>
          </DrawerHeader>
          <div className="flex flex-col gap-4">{children}</div>
          {footer && (
            <div
              className="mt-4 flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end"
              style={{ borderColor: "var(--border)" }}
            >
              {footer}
            </div>
          )}
        </DrawerContent>
      </Drawer>,
      document.body,
    );
  }

  // Desktop: render as centered modal
  return createPortal(
    <div
      className="fixed inset-0 z-[500] flex items-start justify-center overflow-y-auto p-0 sm:px-4 sm:py-8"
      style={{ background: "rgba(0,0,0,.45)", backdropFilter: "blur(3px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="pc-anim-in flex min-h-dvh w-full flex-col sm:my-auto sm:min-h-0"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "clamp(0px, 2vw, var(--radius))",
          boxShadow: "var(--shadow-lg)",
          maxWidth: MODAL_MAX_WIDTH[size],
          maxHeight: "min(100dvh, calc(100vh - 4rem))",
        }}
      >
        <div
          className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-[22px] sm:py-[16px]"
          style={{ borderColor: "var(--border)" }}
        >
          <span
            className="min-w-0 truncate text-[15px] font-bold"
            style={{ fontFamily: "var(--font-head)" }}
          >
            {title}
          </span>
          <button onClick={onClose} className="pc-btn-icon touch-target shrink-0">
            <X className="w-3 h-3" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-[22px] sm:py-[20px]">
          {children}
        </div>
        {footer && (
          <div
            className="safe-area-bottom flex flex-col-reverse gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end sm:px-[22px] sm:py-[14px]"
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
