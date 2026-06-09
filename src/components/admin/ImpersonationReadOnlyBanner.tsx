import { Eye } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth-context";

/**
 * A subtle banner shown inside admin tabs when the admin is impersonating
 * a user who lacks the required permission for that feature.
 * Explains that the data shown is read-only.
 */
export function ImpersonationReadOnlyBanner() {
  const { t } = useTranslation("admin");
  const { isImpersonating, profile } = useAuth();

  if (!isImpersonating || !profile) return null;

  return (
    <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <Eye className="size-4 flex-shrink-0" />
      <div>
        <span className="font-medium">
          {t(
            "impersonation.readOnlyBanner",
            "Stai impersonando {{name}} ({{role}})",
            { name: profile.full_name, role: profile.role },
          )}
        </span>
        <span className="ml-1 text-amber-700">
          —{" "}
          {t(
            "impersonation.readOnlyHint",
            "I dati mostrati sono in sola lettura. Le modifiche richiedono il ruolo admin.",
          )}
        </span>
      </div>
    </div>
  );
}
