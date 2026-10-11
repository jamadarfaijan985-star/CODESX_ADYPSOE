import {
  ChevronDownIcon,
  LogOutIcon,
  SettingsIcon,
  UserIcon,
} from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useAuth } from "../auth/AuthContext.jsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function initials(name) {
  return String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

/** Account dropdown: Profile · Account Settings · Logout. */
export default function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    const result = await logout();
    if (result.serverConfirmed) {
      toast.success("Signed out.");
    } else {
      toast.warning("Signed out locally — the server could not be reached.");
    }
    navigate("/login", { replace: true });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="rf-userchip rf-userchip--btn"
          aria-label="Account menu"
        >
          <span className="rf-avatar" aria-hidden="true">
            {initials(user?.name)}
          </span>
          <span className="rf-userchip__meta">
            <b>{user?.name}</b>
            <small>{user?.email}</small>
          </span>
          <ChevronDownIcon className="rf-userchip__caret" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="rf-menu">
        <DropdownMenuLabel className="rf-menu__label">
          <span className="rf-menu__name">{user?.name}</span>
          <span className="rf-menu__mail">{user?.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="rf-menu__item"
          onSelect={() => navigate("/profile")}
        >
          <UserIcon aria-hidden="true" /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem
          className="rf-menu__item"
          onSelect={() => navigate("/settings")}
        >
          <SettingsIcon aria-hidden="true" /> Account Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="rf-menu__item rf-menu__item--danger"
          onSelect={handleLogout}
        >
          <LogOutIcon aria-hidden="true" /> Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
