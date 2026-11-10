import { useState } from "react";
import { Link } from "react-router-dom";
import { Flame, LogOut, Menu, Moon, Sun, UserRound } from "lucide-react";
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
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur md:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick} aria-label="Open menu">
        <Menu />
      </Button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-muted-foreground">Welcome back,</p>
        <p className="truncate font-display text-lg font-semibold leading-tight">{displayName}</p>
      </div>

      <div className="hidden items-center gap-2 sm:flex">
        <Select
          aria-label="Current subject"
          className="w-44"
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

      <div className="flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-sm">
        <Flame className="h-4 w-4 text-warning" />
        <span className="font-medium">{profile?.study_streak ?? 0}</span>
        <span className="hidden text-muted-foreground sm:inline">day streak</span>
      </div>

      <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
        {theme === "dark" ? <Sun /> : <Moon />}
      </Button>

      <div className="relative">
        <Button
          variant="outline"
          size="icon"
          aria-label="Profile menu"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <UserRound />
        </Button>
        <div
          className={cn(
            "absolute right-0 mt-2 w-48 rounded-lg border border-border bg-popover p-1 shadow-lg transition",
            menuOpen ? "visible opacity-100" : "invisible opacity-0",
          )}
        >
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
