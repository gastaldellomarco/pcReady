import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

/**
 *
 */
export interface CodeBlockProps {
  /** The programming language for syntax highlighting (e.g. "ts", "sql", "bash"). */
  language?: string;
  /** The raw code content. */
  children: string;
  /** Optional filename shown as a tab above the block. */
  filename?: string;
}

/**
 * Code block with syntax highlighting (Shiki) and a copy-to-clipboard button.
 *
 * Shiki runs client-side on mount. Until then, the code is shown as plain
 * preformatted text so there's no flicker.
 */
export function CodeBlock({ language, children, filename }: CodeBlockProps) {
  const [highlighted, setHighlighted] = useState<string>("");
  const [copied, setCopied] = useState(false);

  // Syntax-highlight on mount (client-side only — Shiki needs the DOM / WASM).
  useEffect(() => {
    let cancelled = false;
    import("shiki")
      .then(({ codeToHtml }) =>
        codeToHtml(children, {
          lang: language ?? "text",
          theme: "github-dark",
        }),
      )
      .then((html) => {
        if (!cancelled) setHighlighted(html);
      })
      .catch(() => {
        // Fallback: show plain text if highlighting fails
      });
    return () => {
      cancelled = true;
    };
  }, [children, language]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }

  return (
    <div
      className="my-4 overflow-hidden rounded-lg border"
      style={{ borderColor: "var(--border)", background: "#0d1117" }}
    >
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{
          borderBottom: "1px solid #21262d",
          background: "#161b22",
        }}
      >
        <span className="text-[11px] font-medium" style={{ color: "#8b949e" }}>
          {filename ?? language ?? "code"}
        </span>
        <button
          type="button"
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] transition-colors"
          style={{ color: "#8b949e" }}
          onClick={handleCopy}
          title={copied ? "Copied!" : "Copy code"}
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
        </button>
      </div>
      {/* Code content */}
      <div className="overflow-x-auto px-4 py-3">
        {highlighted ? (
           
          <div
            className="text-[13px] leading-relaxed"
            style={{ fontFamily: "var(--font-mono)" }}
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        ) : (
          <pre
            className="text-[13px] leading-relaxed"
            style={{ fontFamily: "var(--font-mono)", color: "#c9d1d9" }}
          >
            <code>{children}</code>
          </pre>
        )}
      </div>
    </div>
  );
}
