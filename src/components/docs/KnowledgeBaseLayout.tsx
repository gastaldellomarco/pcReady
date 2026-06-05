import { useState } from "react";
import type { ReactNode } from "react";
import { Menu, BookOpenText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/use-mobile";
import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { DocsSidebarMobile } from "@/components/docs/DocsSidebarMobile";
import { KB_SECTIONS } from "@/components/docs/loadKBStructure";

export type { DocsSection, DocsArticle } from "@/components/docs/loadKBStructure";

/** The approximate height of the TopBar. Used to position the fixed KB sidebar. */
const TOPBAR_H = 56;

/** Width of the AppShell sidebar, needed to compute negative margin break-out. */
const APP_SIDEBAR_W = 240;

/** Width of the KB sidebar (desktop). */
const KB_SIDEBAR_W = 280;

/**
 *
 */
export interface KnowledgeBaseLayoutProps {
  children: ReactNode;
  activeHash: string;
  onNavigate: (hash: string) => void;
}

/**
 * Full-width layout for the Knowledge Base.
 *
 * Strategy:
 * - Desktop: a **fixed** KB sidebar (280px, z-50) overlays the AppShell sidebar (240px, z-40).
 *   Negative margins on the wrapper break out of AppShell's <main> padding so the content
 *   area can span the full viewport to the right.
 * - Mobile: the AppShell sidebar is already hidden; we render a top bar with hamburger
 *   and a Sheet drawer for KB navigation.
 */
export function KnowledgeBaseLayout({
  children,
  activeHash,
  onNavigate,
}: KnowledgeBaseLayoutProps) {
  const { t } = useTranslation("common");
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebar = (
    <DocsSidebar sections={KB_SECTIONS} activeHash={activeHash} onNavigate={onNavigate} />
  );

  return (
    <>
      {/* Desktop: fixed KB sidebar that overlays AppShell's sidebar.
          z-50 > AppShell's z-40 so the KB sidebar is fully visible. */}
      {!isMobile && (
        <aside
          className="fixed top-0 left-0 bottom-0 z-50 flex flex-col border-r"
          style={{
            width: KB_SIDEBAR_W,
            background: "var(--surface)",
            borderColor: "var(--border)",
          }}
        >
          {/* KB header — padded to align with TopBar */}
          <div
            className="flex items-center gap-2.5 px-5 shrink-0 border-b"
            style={{ height: TOPBAR_H, borderColor: "var(--border)" }}
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
          {sidebar}
        </aside>
      )}

      {/* Wrapper with negative margins to break out of AppShell's <main> padding.
          Desktop only (isMobile = false, >= 960px). At that width, AppShell already uses md:px-7
          (28px padding-x) and md:py-6 (24px padding-y), so the hardcoded values are correct.
          Below 960px (isMobile = true) no negative margins are applied — the KB uses the
          AppShell's natural padding without a sidebar offset. */}
      <div
        className="flex min-h-0 flex-1 flex-col"
        style={{
          marginLeft: isMobile ? undefined : -(APP_SIDEBAR_W + 28),
          marginRight: isMobile ? undefined : -28,
          marginTop: isMobile ? undefined : -24,
          marginBottom: isMobile ? undefined : -24,
          paddingLeft: isMobile ? undefined : KB_SIDEBAR_W,
          background: "var(--background)",
        }}
      >
        {/* Mobile top bar */}
        {isMobile && (
          <div
            className="flex items-center gap-3 px-4 py-3 border-b shrink-0"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <button
              className="touch-target rounded-lg"
              onClick={() => setMobileOpen(true)}
              style={{ color: "var(--text)" }}
              aria-label={t("sidebar.openMenu", "Open menu")}
            >
              <Menu className="size-5" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <BookOpenText className="size-4 shrink-0" style={{ color: "var(--accent)" }} />
              <span
                className="text-sm font-bold truncate"
                style={{ fontFamily: "var(--font-head)" }}
              >
                Knowledge Base
              </span>
            </div>
          </div>
        )}
        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>

      {/* Mobile drawer */}
      <DocsSidebarMobile open={mobileOpen} onOpenChange={setMobileOpen}>
        {sidebar}
      </DocsSidebarMobile>
    </>
  );
}
