import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { BookOpenText } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";

/**
 *
 */
export interface DocsSidebarMobileProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

/**
 * Mobile Knowledge Base sidebar — renders as a Sheet drawer from the left.
 */
export function DocsSidebarMobile({ open, onOpenChange, children }: DocsSidebarMobileProps) {
  const { t } = useTranslation("common");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="flex w-[300px] max-w-[86vw] flex-col p-0"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
          color: "var(--text)",
        }}
      >
        <SheetTitle className="sr-only">
          Knowledge Base
        </SheetTitle>
        <SheetDescription className="sr-only">
          {t("docs.sidebarDescription", "Knowledge Base navigation sidebar")}
        </SheetDescription>
        {/* KB header in mobile drawer */}
        <div
          className="flex items-center gap-2.5 px-5 py-4 border-b shrink-0"
          style={{ borderColor: "var(--border)" }}
        >
          <div
            className="flex size-8 items-center justify-center rounded-lg"
            style={{ background: "var(--accent2)", color: "var(--accent)" }}
          >
            <BookOpenText className="size-4" />
          </div>
          <div className="min-w-0">
            <div
              className="text-sm font-bold truncate"
              style={{ fontFamily: "var(--font-head)" }}
            >
              Knowledge Base
            </div>
            <div className="text-[10px] text-text3">pcReady documentation</div>
          </div>
        </div>
        {children}
      </SheetContent>
    </Sheet>
  );
}
