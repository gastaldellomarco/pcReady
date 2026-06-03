import { Link } from "@tanstack/react-router";
import { LogOut, Settings, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OptimizedImage } from "@/components/ui/optimized-image";
import type { AuthProfile } from "@/lib/auth-context";

interface UserMenuProps {
  profile: AuthProfile;
  avatarColor: { bg: string; fg: string };
  roleLabel: string;
  onSignOut: () => void;
  onNavigate?: () => void;
}

/**
 *
 */
export function UserMenu({
  profile,
  avatarColor,
  roleLabel,
  onSignOut,
  onNavigate,
}: UserMenuProps) {
  const { t } = useTranslation("common");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex min-w-0 flex-1 items-center gap-[9px] rounded-[7px] p-1 text-left transition-colors hover:bg-surface2">
          <UserAvatar profile={profile} avatarColor={avatarColor} />
          <span className="min-w-0">
            <span className="block truncate text-[12px] font-semibold">{profile.full_name}</span>
            <span className="block text-[10px] text-text3 capitalize">{roleLabel}</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-52">
        <DropdownMenuItem asChild>
          <Link
            to="/profile"
            search={() => ({ tab: undefined }) as any}
            onClick={onNavigate}
            className="cursor-pointer"
          >
            <User className="mr-2 size-4" />
            {t("profile.title", "Profilo")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link
            to="/profile"
            search={() => ({ tab: "security" }) as any}
            onClick={onNavigate}
            className="cursor-pointer"
          >
            <Settings className="mr-2 size-4" />
            {t("profile.settings", "Impostazioni")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut} className="cursor-pointer">
          <LogOut className="mr-2 size-4" />
          {t("profile.logout", "Esci")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserAvatar({
  profile,
  avatarColor,
}: {
  profile: AuthProfile;
  avatarColor: { bg: string; fg: string };
}) {
  if (profile.avatar_url) {
    return (
      <OptimizedImage
        src={profile.avatar_url}
        alt=""
        width={28}
        height={28}
        className="h-7 w-7 flex-shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <span
      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
      style={{
        background: avatarColor.bg,
        color: avatarColor.fg,
        fontFamily: "var(--font-head)",
      }}
    >
      {profile.initials}
    </span>
  );
}
