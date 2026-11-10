import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bell, LogOut, Menu, Moon, Search, Sun, UserRound } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { useQuery } from "@tanstack/react-query";
import { getProfile } from "@/services/profile";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import { useNotifications } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SubjectSelector } from "@/components/layout/SubjectSelector";
import { cn } from "@/lib/utils";

interface HeaderProps {
  onMenuClick: () => void;
}

const CRUMBS: Record<string, string> = {
  dashboard: "Overview",
  materials: "My Materials",
  topics: "Topic Map",
  quiz: "Diagnostic Quiz",
  gaps: "Knowledge Gaps",
  revision: "Revision Plan",
  assistant: "AI Study Assistant",
  analytics: "Analytics",
  profile: "Profile",
  settings: "Settings",
};

const KIND_LABEL: Record<string, string> = {
  material: "Material",
  topic: "Topic",
  quiz: "Quiz",
  revision: "Plan",
  conversation: "Chat",
};

export function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: getProfile,
    enabled: Boolean(user),
  });

  const { query, setQuery, results, loading: searchLoading } = useGlobalSearch();
  const { notifications, count: notifCount } = useNotifications();

  const displayName =
    profile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Student";

  const segment = location.pathname.split("/").filter(Boolean)[0] || "dashboard";
  const crumb = CRUMBS[segment] || "GapFinder";

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (searchRef.current && !searchRef.current.contains(target)) setSearchOpen(false);
      if (notifRef.current && !notifRef.current.contains(target)) setNotifOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-card px-3 md:gap-3 md:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick} aria-label="Open menu">
        <Menu />
      </Button>

      <div className="min-w-0 hidden sm:block sm:max-w-[180px] md:max-w-none">
        <p className="truncate text-xs text-muted-foreground">GapFinder AI / {crumb}</p>
        <p className="truncate text-sm font-medium">{displayName}</p>
      </div>

      <div className="relative min-w-0 flex-1" ref={searchRef}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            placeholder="Search materials, topics, quizzes…"
            className="h-9 pl-8"
            aria-label="Global search"
          />
        </div>
        {searchOpen && query.trim().length >= 2 ? (
          <div className="absolute left-0 right-0 z-40 mt-1 max-h-80 overflow-auto rounded-xl border border-border bg-popover p-1 shadow-lg">
            {searchLoading ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">Searching…</p>
            ) : results.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">No matches in this subject.</p>
            ) : (
              results.map((hit) => (
                <button
                  key={hit.id}
                  type="button"
                  className="flex w-full flex-col rounded-lg px-3 py-2 text-left hover:bg-muted"
                  onClick={() => {
                    setSearchOpen(false);
                    setQuery("");
                    navigate(hit.href);
                  }}
                >
                  <span className="text-sm font-medium">{hit.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {KIND_LABEL[hit.kind] ?? hit.kind}
                    {hit.subtitle ? ` · ${hit.subtitle}` : ""}
                  </span>
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>

      <SubjectSelector className="hidden md:block" />

      <div className="relative" ref={notifRef}>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifications"
          onClick={() => {
            setNotifOpen((v) => !v);
            setMenuOpen(false);
          }}
        >
          <Bell />
          {notifCount > 0 ? (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
          ) : null}
        </Button>
        {notifOpen ? (
          <div className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-popover p-1 shadow-lg">
            <p className="px-3 py-2 text-xs font-medium text-muted-foreground">Recent activity</p>
            {notifications.length === 0 ? (
              <p className="px-3 py-3 text-sm text-muted-foreground">No notifications for this subject yet.</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className="w-full rounded-lg px-3 py-2 text-left hover:bg-muted"
                  onClick={() => {
                    setNotifOpen(false);
                    navigate(n.href);
                  }}
                >
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-muted-foreground">{n.body}</p>
                </button>
              ))
            )}
          </div>
        ) : null}
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
          onClick={() => {
            setMenuOpen((v) => !v);
            setNotifOpen(false);
          }}
        >
          <UserRound />
        </Button>
        <div
          className={cn(
            "absolute right-0 mt-2 w-52 rounded-lg border border-border bg-popover p-1 shadow-md transition",
            menuOpen ? "visible opacity-100" : "invisible opacity-0",
          )}
        >
          <div className="border-b border-border px-3 py-2">
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <div className="p-1 md:hidden">
            <SubjectSelector className="w-full" />
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
