import { Star } from "lucide-react";

interface ScriptFavoriteButtonProps {
  scriptId: string;
  favored: boolean;
  onToggle: (scriptId: string, favored: boolean) => void;
  size?: "sm" | "md";
}

/**
 *
 */
export function ScriptFavoriteButton({
  scriptId,
  favored,
  onToggle,
  size = "md",
}: ScriptFavoriteButtonProps) {
  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    onToggle(scriptId, favored);
  }

  const iconSize = size === "sm" ? "size-3.5" : "size-4";
  const btnSize = size === "sm" ? "w-6 h-6" : "w-8 h-8";

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`${btnSize} rounded-full flex items-center justify-center transition-colors hover:bg-surface2`}
      title={favored ? "Remove from favorites" : "Add to favorites"}
    >
      <Star
        className={`${iconSize} transition-colors ${
          favored ? "fill-amber-400 text-amber-400" : "text-text3"
        }`}
      />
    </button>
  );
}
