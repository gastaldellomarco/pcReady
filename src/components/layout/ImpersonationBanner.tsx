import { StopCircle, Eye } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth-context";

/**
 * A highly visible red banner displayed at the top of the app
 * when an admin is impersonating another user.
 */
export function ImpersonationBanner() {
  const { t } = useTranslation("admin");
  const { isImpersonating, profile, endImpersonation } = useAuth();

  if (!isImpersonating || !profile) return null;

  return (
    <div className="flex items-center justify-between gap-3 bg-red-600 px-4 py-2.5 text-sm text-white shadow-md">
      <div className="flex items-center gap-2.5">
        <Eye className="size-4 flex-shrink-0" />
        <span className="font-medium">
          {t("impersonation.banner", "Stai impersonando {{name}} ({{role}})", {
            name: profile.full_name,
            role: profile.role,
          })}
        </span>
        <span className="hidden sm:inline text-red-200 text-xs">
          — {t("impersonation.warning", "Le azioni vengono registrate nell'audit log")}
        </span>
      </div>
      <button
        onClick={() => endImpersonation()}
        className="flex items-center gap-1.5 rounded-md bg-white/15 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-white/25"
      >
        <StopCircle className="size-3.5" />
        {t("impersonation.end", "Termina impersonificazione")}
      </button>
    </div>
  );
}
