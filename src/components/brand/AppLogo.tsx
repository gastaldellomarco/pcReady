import { cn } from "@/lib/utils";

type AppLogoVariant = "icon" | "horizontal" | "vertical";
type AppLogoTone = "default" | "dark" | "mono";

interface AppLogoProps {
  variant?: AppLogoVariant;
  tone?: AppLogoTone;
  className?: string;
  iconClassName?: string;
  showWordmark?: boolean;
}

/**
 *
 */
export function AppLogo({
  variant = "horizontal",
  tone = "default",
  className,
  iconClassName,
  showWordmark,
}: AppLogoProps) {
  const wordmarkVisible = showWordmark ?? variant !== "icon";
  const vertical = variant === "vertical";
  const primary = tone === "mono" ? "currentColor" : tone === "dark" ? "#FFFFFF" : "var(--primary)";
  const check = tone === "mono" ? "currentColor" : tone === "dark" ? "#FFFFFF" : "var(--success)";
  const screen = tone === "dark" ? "rgba(255,255,255,0.14)" : "var(--primary-light)";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 text-text-primary",
        vertical && "flex-col gap-2 text-center",
        className,
      )}
      aria-label="pcReady"
    >
      <svg
        viewBox="0 0 48 48"
        role="img"
        aria-hidden="true"
        className={cn("h-8 w-8 flex-shrink-0", iconClassName)}
      >
        <rect
          x="5"
          y="8"
          width="38"
          height="27"
          rx="6"
          fill={screen}
          stroke={primary}
          strokeWidth="3"
        />
        <path
          d="M17 22.5 22.2 27.5 32 17"
          fill="none"
          stroke={check}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M20 39h8M16 43h16"
          fill="none"
          stroke={primary}
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      {wordmarkVisible ? (
        <span className="leading-none tracking-tight" style={{ fontFamily: "var(--font-head)" }}>
          <span className="font-normal text-text-secondary">pc</span>
          <span className={tone === "mono" ? "font-semibold" : "font-semibold text-primary"}>
            Ready
          </span>
        </span>
      ) : null}
    </div>
  );
}
