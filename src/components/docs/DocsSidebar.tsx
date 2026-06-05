import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { DocsSection } from "@/components/docs/loadKBStructure";
import { sectionIcon } from "@/components/docs/loadKBStructure";

/**
 *
 */
export interface DocsSidebarProps {
  sections: DocsSection[];
  activeHash: string;
  onNavigate: (hash: string) => void;
}

/**
 * Knowledge Base sidebar — auto-generated from the content structure.
 * Uses Accordion for collapsible sections and highlights the active article.
 */
export function DocsSidebar({ sections, activeHash, onNavigate }: DocsSidebarProps) {
  /** Derive which accordion sections should be open from the active article hash. */
  const openSections = sections
    .filter((section) => section.articles.some((a) => a.hash === activeHash))
    .map((section) => section.id);

  // If no active hash, default to first section open
  const value = openSections.length > 0 ? openSections : [sections[0]?.id].filter(Boolean);

  return (
    <ScrollArea className="flex-1">
      <Accordion
        type="multiple"
        value={value}
        className="px-3 py-2"
      >
        {sections.map((section) => {
          const Icon = sectionIcon(section.icon);
          const isSectionActive = section.articles.some((a) => a.hash === activeHash);

          return (
            <AccordionItem
              key={section.id}
              value={section.id}
              className="border-0"
              style={{ borderColor: "var(--border)" }}
            >
              <AccordionTrigger
                className="py-2 px-2 rounded-lg text-[13px] font-semibold hover:no-underline"
                style={{
                  color: isSectionActive ? "var(--accent)" : "var(--text)",
                  background: isSectionActive ? "var(--accent2)" : "transparent",
                  fontFamily: "var(--font-head)",
                  minHeight: 38,
                }}
              >
                <span className="flex items-center gap-2">
                  <Icon className="size-3.5 shrink-0" style={{ opacity: isSectionActive ? 1 : 0.65 }} />
                  {section.label}
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-0 pt-0.5">
                <div className="flex flex-col gap-0.5 pl-7 pr-1">
                  {section.articles.map((article) => {
                    const isActive = article.hash === activeHash;
                    return (
                      <button
                        key={article.id}
                        type="button"
                        className="w-full text-left rounded-md px-2.5 py-1.5 text-[12.5px] font-medium transition-colors"
                        style={{
                          background: isActive ? "var(--accent2)" : "transparent",
                          color: isActive ? "var(--accent)" : "var(--text2)",
                          fontWeight: isActive ? 600 : 500,
                        }}
                        onClick={() => onNavigate(article.hash)}
                      >
                        {article.label}
                      </button>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </ScrollArea>
  );
}
