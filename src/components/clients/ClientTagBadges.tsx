/**
 * Compact tag badges for client cards and detail headers.
 */
export function ClientTagBadges({
  tags,
  compact,
}: {
  tags: import("@/lib/queries/clients").ClientTag[];
  compact?: boolean;
}) {
  if (!tags.length) return null;
  return (
    <div className={compact ? "mt-2 flex flex-wrap gap-1" : "mt-2 flex flex-wrap gap-1.5"}>
      {tags.slice(0, compact ? 3 : 8).map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-bold"
          style={{
            borderColor: tag.color || "var(--border)",
            background: "var(--surface2)",
            color: tag.color || "var(--text3)",
          }}
        >
          {tag.name}
        </span>
      ))}
      {compact && tags.length > 3 && (
        <span className="rounded-full bg-surface2 px-2 py-0.5 text-[10.5px] font-bold text-text3">
          +{tags.length - 3}
        </span>
      )}
    </div>
  );
}
