import { lazy, Suspense } from "react";
import { MDXProvider } from "@mdx-js/react";
import type { ComponentType } from "react";
import { MermaidDiagram } from "@/components/docs/MermaidDiagram";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { ARTICLE_IMPORTS } from "@/components/docs/loadKBStructure";

// ---------------------------------------------------------------
// MDX article imports (lazy-loaded)
// ---------------------------------------------------------------

const LandingPage = lazy(() => import("@/content/docs/index.mdx"));

/** Pre-computed lazy components — `lazy()` must be called at module top-level, not inside render. */
const LazyArticles: Record<string, ComponentType> = {};
for (const [hash, loader] of Object.entries(ARTICLE_IMPORTS)) {
  LazyArticles[hash] = lazy(loader);
}

// ---------------------------------------------------------------
// MDX component overrides
// ---------------------------------------------------------------

/**
 * Map Markdown constructs to custom React components via MDXProvider.
 */
const mdxComponents = {
  // Strip the wrapping <pre> that MDX adds around code blocks — our CodeBlock
  // and MermaidDiagram components render their own container.
  pre: ({ children }: any) => <>{children}</>,

  // Use our MermaidDiagram component for ```mermaid code fences.
  // In MDX v3, fenced code blocks are passed to the `code` component
  // with className = "language-mermaid".
  code: ({
    className,
    children,
  }: {
    className?: string;
    children?: string;
  }) => {
    const language = className?.replace("language-", "");

    // Mermaid diagrams
    if (language === "mermaid" && typeof children === "string") {
      return <MermaidDiagram className="my-6">{children}</MermaidDiagram>;
    }

    // Fenced code blocks (have a language-xxx class)
    if (language) {
      return (
        <CodeBlock language={language}>
          {typeof children === "string" ? children : String(children ?? "")}
        </CodeBlock>
      );
    }

    // Inline code — render as simple styled code element
    return (
      <code
        className="rounded px-1.5 py-0.5 text-[13px]"
        style={{
          fontFamily: "var(--font-mono)",
          background: "var(--surface2)",
          color: "var(--danger)",
        }}
      >
        {children}
      </code>
    );
  },

  // Style links
  a: (props: any) => (
    <a
      {...props}
      className="underline decoration-1 underline-offset-2"
      style={{ color: "var(--accent)" }}
      target={props.href?.startsWith("http") ? "_blank" : undefined}
      rel={props.href?.startsWith("http") ? "noopener noreferrer" : undefined}
    />
  ),

  // Style tables
  table: (props: any) => (
    <div className="my-4 overflow-x-auto rounded-lg border" style={{ borderColor: "var(--border)" }}>
      <table
        className="w-full text-sm"
        style={{ borderCollapse: "collapse" }}
        {...props}
      />
    </div>
  ),
  th: (props: any) => (
    <th
      className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider"
      style={{
        background: "var(--surface2)",
        color: "var(--text2)",
        borderBottom: "1px solid var(--border)",
      }}
      {...props}
    />
  ),
  td: (props: any) => (
    <td
      className="px-4 py-2.5"
      style={{
        borderBottom: "1px solid var(--border)",
        color: "var(--text)",
      }}
      {...props}
    />
  ),

  // Style blockquotes as callouts
  blockquote: (props: any) => (
    <blockquote
      className="my-4 rounded-lg border-l-4 px-4 py-3 text-sm"
      style={{
        borderLeftColor: "var(--accent)",
        background: "var(--accent2)",
        color: "var(--text2)",
      }}
      {...props}
    />
  ),

  // Style horizontal rules
  hr: (props: any) => (
    <hr className="my-8" style={{ borderColor: "var(--border)" }} {...props} />
  ),

  // Style images
  img: (props: any) => (
    <img
      alt=""
      className="my-4 max-w-full rounded-lg border"
      style={{ borderColor: "var(--border)" }}
      loading="lazy"
      {...props}
    />
  ),
};

// ---------------------------------------------------------------
// DocsContent component
// ---------------------------------------------------------------

/**
 *
 */
export interface DocsContentProps {
  /** The active article hash (e.g. "02-architecture/01-system-overview"). Empty = landing page. */
  activeHash: string;
}

/**
 * Renders the MDX content for the currently active article.
 *
 * Falls back to the landing page when no hash is set or the hash doesn't match
 * any known article. Shows a loading skeleton during lazy import.
 */
export function DocsContent({ activeHash }: DocsContentProps) {
  const ArticleComponent = LazyArticles[activeHash] ?? LandingPage;

  return (
    <MDXProvider components={mdxComponents}>
      <div className="px-5 py-6 md:px-10 md:py-10 max-w-4xl mx-auto">
        {/* MDX article prose styling */}
        <style>{mdxProseStyles}</style>
        <div className="mdx-prose">
          <Suspense fallback={<ArticleSkeleton />}>
            <ArticleComponent />
          </Suspense>
        </div>
      </div>
    </MDXProvider>
  );
}

// ---------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------

function ArticleSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-7 w-48 rounded" style={{ background: "var(--surface2)" }} />
      <div className="h-4 w-96 rounded" style={{ background: "var(--surface2)" }} />
      <div className="h-4 w-80 rounded" style={{ background: "var(--surface2)" }} />
      <div className="h-32 w-full rounded-lg" style={{ background: "var(--surface2)" }} />
    </div>
  );
}

// ---------------------------------------------------------------
// MDX prose styles (scoped to .mdx-prose)
// ---------------------------------------------------------------

const mdxProseStyles = `
  .mdx-prose h1 {
    font-family: var(--font-head);
    font-size: 30px;
    font-weight: 700;
    letter-spacing: -0.5px;
    line-height: 1.15;
    margin-bottom: 16px;
    color: var(--text);
  }
  .mdx-prose h2 {
    font-family: var(--font-head);
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.3px;
    line-height: 1.35;
    margin-top: 36px;
    margin-bottom: 14px;
    color: var(--text);
  }
  .mdx-prose h3 {
    font-family: var(--font-head);
    font-size: 16px;
    font-weight: 600;
    letter-spacing: -0.2px;
    line-height: 1.4;
    margin-top: 28px;
    margin-bottom: 10px;
    color: var(--text);
  }
  .mdx-prose p {
    font-size: 15px;
    line-height: 1.7;
    margin-bottom: 14px;
    color: var(--text);
  }
  .mdx-prose ul,
  .mdx-prose ol {
    padding-left: 20px;
    margin-bottom: 14px;
  }
  .mdx-prose li {
    font-size: 15px;
    line-height: 1.7;
    margin-bottom: 4px;
    color: var(--text);
  }
  .mdx-prose strong {
    font-weight: 600;
    color: var(--text);
  }
  .mdx-prose code {
    font-family: var(--font-mono);
    font-size: 13px;
    background: var(--surface2);
    padding: 1px 5px;
    border-radius: 4px;
    color: var(--danger);
  }
  .mdx-prose pre code {
    background: transparent;
    padding: 0;
    border-radius: 0;
    color: inherit;
  }
`;
