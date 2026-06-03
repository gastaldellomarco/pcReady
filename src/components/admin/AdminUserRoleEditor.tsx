import { UserCog } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ADMIN_ROLES, adminRoleLabel, isAppRole } from "@/lib/admin/admin-constants";
import type { AppRole } from "@/lib/auth-context";

function roleBgColor(r: AppRole) {
  if (r === "admin") return "var(--danger, #DC2626)";
  if (r === "tech") return "var(--primary, #2563EB)";
  return "var(--muted, #E6E7EA)";
}

function roleTextColor(r: AppRole) {
  if (r === "admin" || r === "tech") return "#ffffff";
  return "var(--foreground)";
}

/**
 *
 */
export function AdminUserRoleEditor({
  role,
  disabled,
  onChange,
}: {
  role: AppRole;
  disabled: boolean;
  onChange: (role: AppRole) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="inline-flex items-center gap-2">
      <UserCog className="size-3.5 text-text3" />
      {!isEditing ? (
        <button
          type="button"
          className={disabled ? "inline-block" : "inline-block cursor-pointer"}
          onClick={() => {
            if (!disabled) setIsEditing(true);
          }}
          title={adminRoleLabel(role)}
        >
          <Badge
            className="gap-2"
            style={{ background: roleBgColor(role), color: roleTextColor(role) }}
          >
            {adminRoleLabel(role)}
          </Badge>
        </button>
      ) : (
        <select
          className="pc-input h-8 min-w-[165px] py-0 text-[12px] leading-normal"
          value={role}
          disabled={disabled}
          onBlur={() => setIsEditing(false)}
          onChange={(event) => {
            if (isAppRole(event.target.value)) {
              onChange(event.target.value);
              setIsEditing(false);
            }
          }}
        >
          {ADMIN_ROLES.map((item) => (
            <option key={item} value={item}>
              {adminRoleLabel(item)}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
