import matter from "gray-matter";
import {
  Rocket,
  Workflow,
  Database,
  GitBranch,
  Plug,
  FileText,
  type LucideIcon,
} from "lucide-react";
import type { ComponentType } from "react";

// ---------------------------------------------------------------
// Types (moved here so both KnowledgeBaseLayout and DocsSidebar
// can import from a single source of truth)
// ---------------------------------------------------------------

/**
 *
 */
export interface DocsSection {
  id: string;
  label: string;
  icon: string;
  articles: DocsArticle[];
}

/**
 *
 */
export interface DocsArticle {
  id: string;
  label: string;
  hash: string;
}

// ---------------------------------------------------------------
// Section metadata — the only hand-maintained config.
// Add an entry here when creating a new section directory.
// ---------------------------------------------------------------

const SECTION_META: Record<string, { label: string; icon: string }> = {
  "01-onboarding": { label: "Onboarding & Setup", icon: "Rocket" },
  "02-architecture": { label: "Architecture & Flow", icon: "Workflow" },
  "03-database": { label: "Database Schema", icon: "Database" },
  "04-features": { label: "Feature Lifecycle", icon: "GitBranch" },
  "05-api": { label: "API & Integrations", icon: "Plug" },
};

/** Map of icon name string → lucide-react component. */
export const ICON_MAP: Record<string, LucideIcon> = {
  Rocket,
  Workflow,
  Database,
  GitBranch,
  Plug,
};

/** Resolve a section icon string to a lucide-react component. */
export function sectionIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] ?? FileText;
}

/**
 * Eager glob returning raw file contents (used for frontmatter parsing).
 * Uses a relative pattern from this file (src/components/docs/).
 * Keys look like:  "../../content/docs/01-onboarding/01-local-setup.mdx"
 */
const rawModules = import.meta.glob("../../content/docs/**/*.mdx", {
  eager: true,
  query: "?raw",
}) as Record<string, string>;

/**
 * Lazy glob returning MDX component imports.
 * Uses the same relative pattern so keys match rawModules exactly.
 */
const mdxModules = import.meta.glob("../../content/docs/**/*.mdx") as Record<
  string,
  () => Promise<{ default: ComponentType }>
>;

// ---------------------------------------------------------------
// Build helpers
// ---------------------------------------------------------------

/** Strip the base path and return "dir/file" (without .mdx extension). */
function relativeKey(absolutePath: string): string {
  // Normalize: strip any leading segments up to content/docs/, remove .mdx (and optional ?query), forward slashes only
  const cleaned = absolutePath
    .replace(/(?:.*?\/)?content[/\\]docs[/\\]/, "")
    .replace(/\.mdx(\?.*)?$/, "")
    .replace(/\\/g, "/");
  return cleaned;
}

/** Extract the parent directory from a relative key like "01-onboarding/01-local-setup". */
function parentDir(relKey: string): string {
  return relKey.split("/")[0];
}

/** Extract the filename from a relative key like "01-onboarding/01-local-setup". */
function filename(relKey: string): string {
  return relKey.split("/").pop() ?? relKey;
}

// ---------------------------------------------------------------
// Parse & build
// ---------------------------------------------------------------

interface ParsedArticle {
  /** Relative path w/o extension, e.g. "01-onboarding/01-local-setup" */
  key: string;
  /** Article id = filename w/o extension, e.g. "01-local-setup" */
  id: string;
  /** Section dir, e.g. "01-onboarding" */
  section: string;
  /** Title from YAML frontmatter, falls back to filename */
  title: string;
  /** Order from YAML frontmatter, falls back to filename numeric prefix */
  order: number;
}

/** Extract a human-readable article title from the filename when frontmatter has no title. */
function fallbackTitle(id: string): string {
  // Strip numeric prefix (e.g. "01-local-setup" → "local-setup")
  const stripped = id.replace(/^\d+-/, "");
  // Replace hyphens with spaces and title-case each word
  return stripped
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseArticles(): ParsedArticle[] {
  const articles: ParsedArticle[] = [];

  for (const [absolutePath, rawText] of Object.entries(rawModules)) {
    const key = relativeKey(absolutePath);

    // Skip the landing page (index.mdx at root)
    if (!key.includes("/")) continue;

    const section = parentDir(key);
    const id = filename(key);

    let title = fallbackTitle(id);
    let order = 0;

    try {
      const { data } = matter(rawText);
      if (typeof data.title === "string") title = data.title;
      if (typeof data.order === "number") order = data.order;
    } catch {
      // If frontmatter parsing fails, fall back to defaults
    }

    // If no order in frontmatter, try to extract from numeric filename prefix
    if (order === 0) {
      const numMatch = id.match(/^(\d+)/);
      if (numMatch) order = Number.parseInt(numMatch[1], 10);
    }

    articles.push({ key, id, section, title, order });
  }

  return articles;
}

// ---------------------------------------------------------------
// Build KB_SECTIONS (sorted, grouped by directory)
// ---------------------------------------------------------------

function buildSections(articles: ParsedArticle[]): DocsSection[] {
  // Group by section directory
  const groups = new Map<string, ParsedArticle[]>();
  for (const a of articles) {
    const list = groups.get(a.section) ?? [];
    list.push(a);
    groups.set(a.section, list);
  }

  const sections: DocsSection[] = [];

  for (const [dir, dirArticles] of groups) {
    const meta = SECTION_META[dir] ?? { label: dir, icon: "FileText" };

    // Sort articles by order field
    dirArticles.sort((a, b) => a.order - b.order);

    sections.push({
      id: dir,
      label: meta.label,
      icon: meta.icon,
      articles: dirArticles.map((a) => ({
        id: a.id,
        label: a.title,
        hash: a.key, // e.g. "01-onboarding/01-local-setup"
      })),
    });
  }

  // Sort sections by directory numeric prefix
  sections.sort((a, b) => {
    const aNum = Number.parseInt(a.id.match(/^(\d+)/)?.[1] ?? "0", 10);
    const bNum = Number.parseInt(b.id.match(/^(\d+)/)?.[1] ?? "0", 10);
    return aNum - bNum;
  });

  return sections;
}

// ---------------------------------------------------------------
// Build ARTICLE_IMPORTS (hash → lazy MDX component import)
// ---------------------------------------------------------------

function buildArticleImports(): Record<string, () => Promise<{ default: ComponentType }>> {
  const imports: Record<string, () => Promise<{ default: ComponentType }>> = {};

  for (const [absolutePath, loader] of Object.entries(mdxModules)) {
    const key = relativeKey(absolutePath);

    // Skip landing page — handled separately in DocsContent
    if (!key.includes("/")) continue;

    imports[key] = loader;
  }

  return imports;
}

// ---------------------------------------------------------------
// Exports (computed once at module init — the globs are resolved at build time)
// ---------------------------------------------------------------

/** Auto-generated section structure from the filesystem. */
export const KB_SECTIONS: DocsSection[] = buildSections(parseArticles());

/** Auto-generated map of article hash → lazy MDX component import. */
export const ARTICLE_IMPORTS: Record<
  string,
  () => Promise<{ default: ComponentType }>
> = buildArticleImports();

// ---------------------------------------------------------------
// Dev-only debug: verify key consistency between the two exports
// ---------------------------------------------------------------

if (import.meta.env.DEV) {
  const sectionHashes = new Set<string>();
  for (const s of KB_SECTIONS) {
    for (const a of s.articles) sectionHashes.add(a.hash);
  }
  const importHashes = new Set(Object.keys(ARTICLE_IMPORTS));

  // Find mismatches between KB_SECTIONS and ARTICLE_IMPORTS
  const onlyInSections = [...sectionHashes].filter((h) => !importHashes.has(h));
  const onlyInImports = [...importHashes].filter((h) => !sectionHashes.has(h));

  console.debug(
    `[KB Scanner] ${KB_SECTIONS.length} sections, ${sectionHashes.size} article hashes, ${importHashes.size} MDX imports`,
  );

  if (onlyInSections.length > 0) {
    console.warn(
      "[KB Scanner] Hashes in KB_SECTIONS but missing from ARTICLE_IMPORTS:",
      onlyInSections,
    );
  }
  if (onlyInImports.length > 0) {
    console.warn(
      "[KB Scanner] Hashes in ARTICLE_IMPORTS but missing from KB_SECTIONS:",
      onlyInImports,
    );
  }
  if (onlyInSections.length === 0 && onlyInImports.length === 0) {
    console.debug("[KB Scanner] All section hashes match ARTICLE_IMPORTS keys ✓");
  }
}
