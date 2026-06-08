import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { BookOpenText, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth-context";
import {
  KnowledgeBaseLayout,
} from "@/components/docs/KnowledgeBaseLayout";
import { KB_SECTIONS, ICON_MAP } from "@/components/docs/loadKBStructure";
import { DocsContent } from "@/components/docs/DocsContent";
import type { DocsArticle, DocsSection } from "@/components/docs/loadKBStructure";

export const Route = createLazyFileRoute("/_app/docs")({
  component: KnowledgeBasePage,
});

// ---------------------------------------------------------------
// Search helpers
// ---------------------------------------------------------------

interface SearchResult {
  section: DocsSection;
  article: DocsArticle;
}

/** Flat list of every article with its parent section. */
function allArticles(): SearchResult[] {
  const results: SearchResult[] = [];
  for (const section of KB_SECTIONS) {
    for (const article of section.articles) {
      results.push({ section, article });
    }
  }
  return results;
}

/** Check if every word in the query appears in the target text (case-insensitive). */
function matchesAllWords(query: string, text: string): boolean {
  const words = query.trim().split(/\s+/);
  const lower = text.toLowerCase();
  return words.every((w) => lower.includes(w.toLowerCase()));
}

/**
 * Score: higher = better match.
 * Exact word match in title scores highest, then starts-with, then contains.
 */
function matchScore(query: string, result: SearchResult): number {
  const q = query.toLowerCase().trim();
  const title = result.article.label.toLowerCase();
  const section = result.section.label.toLowerCase();
  let score = 0;

  if (title === q) score += 100;
  else if (title.startsWith(q)) score += 50;
  else if (title.includes(q)) score += 25;

  if (section.includes(q)) score += 10;

  return score;
}

function fuzzySearch(query: string): SearchResult[] {
  const q = query.trim();
  if (!q) return [];

  return allArticles()
    .filter(
      (r) =>
        matchesAllWords(q, r.article.label) ||
        matchesAllWords(q, r.section.label),
    )
    .sort((a, b) => matchScore(q, b) - matchScore(q, a))
    .slice(0, 12);
}

// ---------------------------------------------------------------
// Highlight component
// ---------------------------------------------------------------

/** Wraps matched substrings in a highlighted <mark>. */
function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;

  const words = query.trim().split(/\s+/).filter(Boolean);
  // Build a regex that matches any of the query words (case-insensitive)
  const pattern = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const regex = new RegExp(`(${pattern})`, "i");
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark
            key={`hl-${i}`}
            className="rounded-sm px-0.5"
            style={{ background: "var(--accent2)", color: "var(--accent)" }}
          >
            {part}
          </mark>
        ) : (
          <span key={`txt-${i}`}>{part}</span>
        ),
      )}
    </>
  );
}

// ---------------------------------------------------------------
// Route
// ---------------------------------------------------------------

/** Parse the current URL hash and return the active section hash. */
function getActiveHash(): string {
  const hash = window.location.hash.replace("#", "");
  for (const section of KB_SECTIONS) {
    for (const article of section.articles) {
      if (article.hash === hash) return hash;
    }
  }
  return "";
}

function KnowledgeBasePage() {
  const { t } = useTranslation("common");
  const { loading, profile } = useAuth();
  const navigate = useNavigate();
  const canViewDocs = profile?.role === "admin" || profile?.role === "tech";

  const [activeHash, setActiveHash] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setActiveHash(getActiveHash());

    const onHashChange = () => setActiveHash(getActiveHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const handleNavigate = useCallback((hash: string) => {
    window.location.hash = hash;
  }, []);

  // Clear search when navigating to an article
  const handleSearchNavigate = useCallback(
    (hash: string) => {
      setSearchQuery("");
      handleNavigate(hash);
    },
    [handleNavigate],
  );

  // Keyboard shortcut: Ctrl+K / Cmd+K to focus search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!loading && profile && !canViewDocs) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [canViewDocs, loading, navigate, profile]);

  const searchResults = useMemo(() => fuzzySearch(searchQuery), [searchQuery]);
  const showSearch = !activeHash && searchQuery.trim().length > 0;
  const showCards = !activeHash && !showSearch;

  if (!canViewDocs) {
    return (
      <div className="pc-card p-6 text-sm text-text3">
        {t("docs.accessDenied", "Knowledge Base available only for admins and technicians.")}
      </div>
    );
  }

  return (
    <KnowledgeBaseLayout activeHash={activeHash} onNavigate={handleNavigate}>
      <div className="flex-1 overflow-y-auto">
        <DocsContent activeHash={activeHash} />

        {/* Landing page: search + section cards */}
        {!activeHash && (
          <div className="px-5 pb-10 md:px-10 max-w-4xl mx-auto">
            {/* Search input */}
            <div className="mb-6">
              <div className="relative max-w-lg mx-auto">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 size-4 pointer-events-none"
                  style={{ color: "var(--text3)" }}
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  className="w-full h-10 pl-9 pr-9 rounded-lg border text-sm outline-none transition-colors focus:border-[var(--accent)]"
                  style={{
                    background: "var(--surface)",
                    borderColor: "var(--border)",
                    color: "var(--text)",
                  }}
                  aria-label={t("docs.searchPlaceholder", "Search articles…")}
                  placeholder={t("docs.searchPlaceholder", "Search articles…")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setSearchQuery("");
                      searchInputRef.current?.blur();
                    } else if (e.key === "Enter" && searchResults.length > 0) {
                      handleSearchNavigate(searchResults[0].article.hash);
                    }
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 hover:bg-[var(--surface2)]"
                    onClick={() => {
                      setSearchQuery("");
                      searchInputRef.current?.focus();
                    }}
                    aria-label="Clear search"
                  >
                    <X className="size-3.5" style={{ color: "var(--text3)" }} />
                  </button>
                )}
                {/* Keyboard shortcut hint */}
                {!searchQuery && (
                  <kbd
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] px-1.5 py-0.5 rounded pointer-events-none hidden sm:inline-flex items-center gap-0.5"
                    style={{
                      background: "var(--surface2)",
                      color: "var(--text3)",
                      border: "1px solid var(--border)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    <span>⌘</span>K
                  </kbd>
                )}
              </div>
            </div>

            {/* Search results */}
            {showSearch && (
              <div className="space-y-1">
                {searchResults.length === 0 ? (
                  <div
                    className="text-center py-12 text-sm"
                    style={{ color: "var(--text3)" }}
                  >
                    {t("docs.noResults", "No articles match your search.")}
                  </div>
                ) : (
                  <>
                    <div
                      className="text-[11px] font-medium uppercase tracking-wider mb-3 px-1"
                      style={{ color: "var(--text3)" }}
                    >
                      {searchResults.length}{" "}
                      {searchResults.length === 1
                        ? t("docs.result", "result")
                        : t("docs.results", "results")}
                    </div>
                    {searchResults.map(({ section, article }) => {
                      const SectionIcon = ICON_MAP[section.icon] ?? BookOpenText;
                      return (
                        <button
                          key={article.hash}
                          type="button"
                          className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors hover:bg-[var(--surface2)]"
                          onClick={() => handleSearchNavigate(article.hash)}
                        >
                          <div
                            className="flex size-8 items-center justify-center rounded-md shrink-0"
                            style={{ background: "var(--accent2)", color: "var(--accent)" }}
                          >
                            <SectionIcon className="size-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] font-medium truncate" style={{ fontFamily: "var(--font-head)" }}>
                              <HighlightText text={article.label} query={searchQuery} />
                            </div>
                            <div className="text-[11px] truncate" style={{ color: "var(--text3)" }}>
                              <HighlightText text={section.label} query={searchQuery} />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            )}

            {/* Section cards */}
            {showCards && (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {KB_SECTIONS.map((section) => {
                  const IconComponent = ICON_MAP[section.icon] ?? BookOpenText;
                  const firstArticle = section.articles[0];

                  return (
                    <button
                      key={section.id}
                      type="button"
                      className="pc-card p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
                      onClick={() => handleNavigate(firstArticle.hash)}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className="flex size-9 items-center justify-center rounded-lg shrink-0"
                          style={{ background: "var(--accent2)", color: "var(--accent)" }}
                        >
                          <IconComponent className="size-4" />
                        </div>
                        <span
                          className="text-[14px] font-bold"
                          style={{ fontFamily: "var(--font-head)" }}
                        >
                          {section.label}
                        </span>
                      </div>
                      <ul className="space-y-1">
                        {section.articles.slice(0, 4).map((a) => (
                          <li
                            key={a.id}
                            className="text-[12.5px] text-text2 flex items-center gap-1.5"
                          >
                            <span className="size-1 rounded-full shrink-0" style={{ background: "var(--text3)" }} />
                            {a.label}
                          </li>
                        ))}
                        {section.articles.length > 4 && (
                          <li className="text-[11px] text-text3 pl-3.5">
                            +{section.articles.length - 4} more articles
                          </li>
                        )}
                      </ul>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </KnowledgeBaseLayout>
  );
}
