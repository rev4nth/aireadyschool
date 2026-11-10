import { useState } from "react";
import { Link } from "react-router-dom";
import { LogOut, Menu, Moon, Sun, UserRound } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { useSubject } from "@/contexts/SubjectContext";
import { useQuery } from "@tanstack/react-query";
import { getProfile } from "@/services/profile";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { subjects, currentSubjectId, setCurrentSubjectId } = useSubject();
  const [menuOpen, setMenuOpen] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: getProfile,
    enabled: Boolean(user),
  });

  const displayName =
    profile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Student";

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card px-4 md:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick} aria-label="Open menu">
        <Menu />
      </Button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
      </div>

      <div className="flex min-w-0 items-center gap-2">
        <label className="hidden text-xs font-medium text-muted-foreground sm:block">Subject</label>
        <Select
          aria-label="Current subject"
          className="h-9 w-[min(100%,220px)] border-border bg-background"
          value={currentSubjectId ?? ""}
          onChange={(e) => setCurrentSubjectId(e.target.value || null)}
        >
          <option value="" disabled>
            Select subject
          </option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>

      <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
        {theme === "dark" ? <Sun /> : <Moon />}
      </Button>

      <div className="relative">
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9"
          aria-label="Profile menu"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <UserRound />
        </Button>
        <div
          className={cn(
            "absolute right-0 mt-2 w-44 rounded-lg border border-border bg-popover p-1 shadow-md transition",
            menuOpen ? "visible opacity-100" : "invisible opacity-0",
          )}
        >
          <div className="border-b border-border px-3 py-2">
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <Link
            to="/profile"
            className="block rounded-md px-3 py-2 text-sm hover:bg-muted"
            onClick={() => setMenuOpen(false)}
          >
            Profile
          </Link>
          <Link
            to="/settings"
            className="block rounded-md px-3 py-2 text-sm hover:bg-muted"
            onClick={() => setMenuOpen(false)}
          >
            Settings
          </Link>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-destructive hover:bg-muted"
            onClick={() => {
              setMenuOpen(false);
              void logout();
            }}
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
