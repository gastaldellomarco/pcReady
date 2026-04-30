import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { initTheme, isDark, toggleTheme } from "@/lib/theme";
import { avatarColors } from "@/lib/pcready";
import { LayoutGrid, Ticket, Trello, ListChecks, Zap, Boxes, Search, LogOut, Moon, Sun, FileDown, Plus, Terminal, Users } from "lucide-react";
import { useTickets } from "@/lib/use-tickets";
import { CreateTicketModal } from "@/components/pcready/CreateTicketModal";
import { TicketDetailModal } from "@/components/pcready/TicketDetailModal";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

const NAV_PRIMARY = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutGrid, badge: false },
  { to: "/tickets",   label: "Ticket PC", icon: Ticket,     badge: true  },
  { to: "/kanban",    label: "Kanban",    icon: Trello,     badge: false },
] as const;
const NAV_CONFIG = [
  { to: "/checklist",   label: "Checklist",   icon: ListChecks },
  { to: "/automations", label: "Automazioni", icon: Zap },
  { to: "/scripts",     label: "Script",      icon: Terminal },
  { to: "/inventory",   label: "Inventario",  icon: Boxes },
  { to: "/admin",       label: "Admin / Utenti", icon: Users, adminOnly: true },
] as const;

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/tickets": "Ticket PC",
  "/kanban": "Kanban Board",
  "/checklist": "Checklist Setup",
  "/automations": "Automazioni",
  "/scripts": "Script",
  "/inventory": "Inventario",
  "/admin": "Admin / Utenti",
};

function AppLayout() {
  const { session, profile, loading, profileLoading, authError, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [dark, setDark] = useState(false);
  const { pendingCount, openCreate } = useTickets();
  const route = useRouterState({ select: s => s.location.pathname });

  useEffect(() => { initTheme(); setDark(isDark()); }, []);
  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  if (loading || profileLoading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center text-text3 text-sm">Caricamento…</div>
    );
  }

  if (authError || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg2)" }}>
        <div className="pc-card max-w-md w-full p-6 text-center">
          <div className="text-[17px] font-bold mb-2" style={{ fontFamily: "var(--font-head)" }}>
            Profilo non disponibile
          </div>
          <p className="text-[13px] text-text3 mb-5">
            {authError || "Non e' stato possibile caricare il profilo associato alla sessione."}
          </p>
          <div className="flex justify-center gap-2">
            <button className="pc-btn pc-btn-primary" onClick={() => refreshProfile()}>
              Riprova
            </button>
            <button className="pc-btn pc-btn-ghost" onClick={() => signOut()}>
              Esci
            </button>
          </div>
        </div>
      </div>
    );
  }

  const avc = avatarColors(profile.initials);
  const title = Object.keys(PAGE_TITLES).find(k => route.startsWith(k));
  const pageTitle = title ? PAGE_TITLES[title] : "PCReady";

  return (
    <div className="flex min-h-screen">
      {/* SIDEBAR */}
      <aside
        className="fixed top-0 left-0 bottom-0 z-40 flex flex-col border-r"
        style={{
          width: "var(--sidebar, 240px)",
          background: "var(--surface)",
          borderColor: "var(--border)",
        }}
      >
        <style>{`:root { --sidebar: 240px; } @media(max-width:960px){:root{--sidebar:64px}}`}</style>

        <div className="px-[18px] py-[18px] border-b flex items-center gap-[10px]" style={{ borderColor: "var(--border)" }}>
          <div className="w-8 h-8 rounded-[8px] flex items-center justify-center flex-shrink-0" style={{ background: "var(--text)" }}>
            <svg viewBox="0 0 16 16" fill="none" stroke="var(--background)" strokeWidth={1.8} className="w-4 h-4">
              <rect x="2" y="2" width="5" height="5" rx="1" /><rect x="9" y="2" width="5" height="5" rx="1" />
              <rect x="2" y="9" width="5" height="5" rx="1" /><path d="M9 11.5h5M11.5 9v5" />
            </svg>
          </div>
          <div className="sb-text">
            <div className="text-[16px] font-bold tracking-tight leading-none" style={{ fontFamily: "var(--font-head)" }}>PCReady</div>
            <div className="text-[10px] text-text3 mt-0.5" style={{ fontFamily: "var(--font-mono)" }}>v3.0</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-[10px] py-[14px]">
          <NavSection label="Principale">
            {NAV_PRIMARY.map(item => (
              <NavLinkItem key={item.to} to={item.to} label={item.label} icon={item.icon} active={route.startsWith(item.to)} badge={item.badge ? pendingCount : undefined} />
            ))}
          </NavSection>
          <NavSection label="Configurazione">
            {NAV_CONFIG.filter(item => !("adminOnly" in item) || profile.role === "admin").map(item => (
              <NavLinkItem key={item.to} {...item} active={route.startsWith(item.to)} />
            ))}
          </NavSection>
        </nav>

        <div className="px-[14px] py-[13px] border-t flex flex-col gap-[10px]" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={() => { toggleTheme(); setDark(isDark()); }}
            className="flex items-center justify-between rounded-[7px] px-[10px] py-[6px] text-[11px] font-semibold cursor-pointer transition-colors"
            style={{ background: "var(--surface2)", border: "1px solid var(--border2)", color: "var(--text2)" }}
          >
            <span className="sb-text flex items-center gap-2">{dark ? <Sun className="w-3 h-3"/> : <Moon className="w-3 h-3"/>} Dark mode</span>
            <span className="relative inline-block w-[30px] h-[16px] rounded-full transition-colors"
              style={{ background: dark ? "var(--accent)" : "var(--border2)" }}>
              <span className="absolute top-[2px] w-[12px] h-[12px] rounded-full bg-white transition-transform"
                style={{ left: "2px", transform: dark ? "translateX(14px)" : "none", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}/>
            </span>
          </button>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-[9px] min-w-0">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                style={{ background: avc.bg, color: avc.fg, fontFamily: "var(--font-head)" }}>{profile.initials}</div>
              <div className="sb-text min-w-0">
                <div className="text-[12px] font-semibold truncate">{profile.full_name}</div>
                <div className="text-[10px] text-text3 capitalize">{roleLabel(profile.role)}</div>
              </div>
            </div>
            <button onClick={() => signOut()} className="sb-text pc-btn-icon" title="Logout">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <style>{`@media(max-width:960px){.sb-text{display:none}}`}</style>
      </aside>

      {/* MAIN */}
      <div className="flex-1 flex flex-col" style={{ marginLeft: "var(--sidebar, 240px)" }}>
        <header className="sticky top-0 z-30 h-14 px-7 flex items-center gap-3 border-b"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <h1 className="text-[17px] font-bold tracking-tight" style={{ fontFamily: "var(--font-head)" }}>{pageTitle}</h1>
          <div className="ml-auto flex items-center gap-2">
            <SearchBox />
            <Link to="/inventory" className="pc-btn pc-btn-ghost pc-btn-sm">
              <FileDown className="w-3 h-3" /> Inventario PDF
            </Link>
            <button onClick={() => openCreate()} className="pc-btn pc-btn-primary pc-btn-sm">
              <Plus className="w-3 h-3" /> Nuovo Ticket
            </button>
          </div>
        </header>
        <main className="flex-1 px-7 py-6 pc-anim-in">
          <Outlet />
        </main>
      </div>
      <CreateTicketModal />
      <TicketDetailModal />
    </div>
  );
}

function NavSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-[22px]">
      <div className="sb-text text-[9.5px] font-bold tracking-[1px] uppercase text-text3 px-2 mb-[5px]">{label}</div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function NavLinkItem({ to, label, icon: Icon, active, badge }: any) {
  return (
    <Link
      to={to}
      className="flex items-center gap-[9px] px-[9px] py-[8px] rounded-[7px] text-[13px] font-medium transition-all"
      style={{
        background: active ? "var(--accent2)" : "transparent",
        color: active ? "var(--accent)" : "var(--text2)",
        fontWeight: active ? 600 : 500,
      }}
    >
      <Icon className="w-[15px] h-[15px] flex-shrink-0" style={{ opacity: active ? 1 : 0.85 }} />
      <span className="sb-text">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="sb-text ml-auto text-white text-[9.5px] font-bold rounded-full px-[6px] py-0 min-w-[18px] text-center"
          style={{ background: "var(--accent)", fontFamily: "var(--font-mono)" }}>{badge}</span>
      )}
    </Link>
  );
}

function SearchBox() {
  const { search, setSearch } = useTickets();
  return (
    <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-[7px]"
      style={{ background: "var(--surface2)", border: "1px solid var(--border2)" }}>
      <Search className="w-3 h-3 text-text3" />
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Cerca ticket, modello, seriale..."
        className="bg-transparent outline-none text-[13px] w-44"
      />
    </div>
  );
}

function roleLabel(r: string) {
  return r === "admin" ? "Amministratore" : r === "tech" ? "Tecnico" : "Visualizzatore";
}
