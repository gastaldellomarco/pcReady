import { useEffect, useId, useState } from "react";
import mermaid from "mermaid";

const MERMAID_INITIALIZED = Symbol("mermaid-initialized");

/**
 * Initialize mermaid once globally. Must be called before any render.
 */
function ensureMermaidInitialized() {
  if ((globalThis as any)[MERMAID_INITIALIZED]) return;
  (globalThis as any)[MERMAID_INITIALIZED] = true;

  mermaid.initialize({
    startOnLoad: false,
    theme: "default",
    securityLevel: "loose",
  });
}

/**
 *
 */
export interface MermaidDiagramProps {
  /** Raw mermaid diagram source (without the ```mermaid fence). */
  children: string;
  className?: string;
}

/**
 * Client-side Mermaid diagram renderer.
 *
 * Renders a mermaid diagram string to SVG. Shows a loading placeholder during
 * rendering and an error message on failure.
 */
export function MermaidDiagram({ children, className }: MermaidDiagramProps) {
  const id = useId().replace(/:/g, "");
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    ensureMermaidInitialized();

    mermaid
      .render(`mermaid-${id}`, children)
      .then(({ svg: rendered }) => {
        if (!cancelled) setSvg(rendered);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
  }, [children, id]);

  if (error) {
    return (
      <div
        className="rounded-lg border px-4 py-3 text-xs"
        style={{
          background: "var(--danger-bg)",
          borderColor: "var(--danger)",
          color: "var(--danger)",
          fontFamily: "var(--font-mono)",
        }}
      >
        Mermaid error: {error}
      </div>
    );
  }

  if (!svg) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border py-12 text-sm text-text3"
        style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
      >
        Rendering diagram…
      </div>
    );
  }

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: svg }}
      style={{ overflowX: "auto" }}
    />
  );
}
