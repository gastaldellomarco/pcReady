import { Link } from "@tanstack/react-router";
import { Menu, Plus, Boxes, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { useTickets } from "@/hooks/use-tickets";

/* ── Search box sub-component ───────────────────────────────── */

function SearchBox() {
  const { t } = useTranslation("common");
  const { search, setSearch } = useTickets();
  return (
    <div
      className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-[7px]"
      style={{ background: "var(--surface2)", border: "1px solid var(--border2)" }}
    >
      <Search className="size-3 text-text3" />
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("search.placeholder", "Cerca ticket, modello, seriale...")}
        aria-label={t("search.label", "Cerca")}
        className="bg-transparent outline-none text-[13px] w-44"
      />
    </div>
  );
}

/* ── TopBar component ────────────────────────────────────────── */

/**
 *
 */
export interface TopBarProps {
  /** Current page title displayed in the header */
  pageTitle: string;
  /** Whether to show the mobile hamburger menu button */
  isMobile: boolean;
  /** Called when the mobile hamburger is clicked */
  onMobileMenuOpen: () => void;
  /** Called when the "New Ticket" button is clicked */
  onCreateTicket: () => void;
}

/**
 *
 */
export function TopBar({ pageTitle, isMobile, onMobileMenuOpen, onCreateTicket }: TopBarProps) {
  const { t } = useTranslation("common");

  return (
    <header
      className="sticky top-0 z-30 flex min-h-14 items-center gap-2 border-b px-3 py-2 md:px-7"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      {isMobile && (
        <button
          className="pc-btn-icon touch-target"
          onClick={onMobileMenuOpen}
          title={t("sidebar.openMenu", "Apri menu")}
        >
          <Menu className="size-4" />
        </button>
      )}
      <h1
        className="min-w-0 flex-1 truncate text-[16px] font-bold tracking-tight sm:text-[17px]"
        style={{ fontFamily: "var(--font-head)" }}
      >
        {pageTitle}
      </h1>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <SearchBox />
        <NotificationBell />
        <Link to="/inventory" className="pc-btn pc-btn-ghost pc-btn-sm hidden sm:inline-flex">
          <Boxes className="size-3" /> {t("sidebar.inventory", "Inventario")}
        </Link>
        <button
          onClick={onCreateTicket}
          className="pc-btn pc-btn-primary pc-btn-sm hidden sm:inline-flex"
        >
          <Plus className="size-3" /> {t("sidebar.newTicket", "Nuovo Ticket")}
        </button>
        <button
          onClick={onCreateTicket}
          className="pc-btn-icon touch-target sm:hidden"
          aria-label={t("sidebar.newTicket", "Nuovo ticket")}
        >
          <Plus className="size-4" />
        </button>
      </div>
    </header>
  );
}
