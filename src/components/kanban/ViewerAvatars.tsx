/**
 * Displays a row of overlapping avatar circles for viewers of a kanban card.
 *
 * Shows up to 3 avatars; if there are more, a "+N" overflow badge is appended.
 * Returns `null` when the viewers array is empty.
 */
export function ViewerAvatars({ viewers }: { viewers: { initials: string; full_name: string; user_id?: string }[] }) {
  if (!viewers.length) return null;
  const max = 3;
  const shown = viewers.slice(0, max);
  const extra = viewers.length - max;
  return (
    <div className="flex items-center -space-x-1.5">
      {shown.map((v, i) => (
        <span
          key={v.full_name + i}
          className="relative inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 text-[7px] font-bold leading-none"
          style={{
            background: "var(--accent2)",
            color: "var(--accent)",
            borderColor: "var(--surface1)",
          }}
          title={v.full_name}
        >
          {v.initials}
        </span>
      ))}
      {extra > 0 && (
        <span
          className="relative inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 text-[7px] font-bold leading-none"
          style={{
            background: "var(--surface3)",
            color: "var(--text3)",
            borderColor: "var(--surface1)",
          }}
          title={`+${extra} altri`}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
