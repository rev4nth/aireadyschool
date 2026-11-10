import { NavLink } from "react-router-dom";
import {
  BookOpenCheck,
  Brain,
  ChartColumnIncreasing,
  ClipboardList,
  FileStack,
  LayoutDashboard,
  Map,
  MessageSquareText,
  Settings,
  UserRound,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const primaryNav = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/materials", label: "Materials", icon: FileStack },
  { to: "/topics", label: "Topics", icon: Map },
  { to: "/quiz", label: "Quiz", icon: ClipboardList },
  { to: "/gaps", label: "Gaps", icon: Brain },
  { to: "/revision", label: "Plan", icon: BookOpenCheck },
];

const secondaryNav = [
  { to: "/assistant", label: "Assistant", icon: MessageSquareText },
  { to: "/analytics", label: "Analytics", icon: ChartColumnIncreasing },
];

const accountNav = [
  { to: "/profile", label: "Profile", icon: UserRound },
  { to: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

function NavGroup({
  title,
  items,
  onClose,
}: {
  title: string;
  items: typeof primaryNav;
  onClose: () => void;
}) {
  return (
    <div className="space-y-1">
      <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
        {title}
      </p>
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onClose}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-white/10 text-white"
                : "text-white/65 hover:bg-white/5 hover:text-white",
            )
          }
        >
          <Icon className="h-4 w-4 shrink-0 opacity-80" />
          {label}
        </NavLink>
      ))}
    </div>
  );
}

export function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[240px] flex-col bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <BookOpenCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-none text-white">GapFinder</p>
              <p className="mt-1 text-[11px] text-white/45">Find what you don’t know</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <X />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-4">
          <NavGroup title="Study" items={primaryNav} onClose={onClose} />
          <NavGroup title="Help" items={secondaryNav} onClose={onClose} />
          <NavGroup title="Account" items={accountNav} onClose={onClose} />
        </nav>
      </aside>
    </>
  );
}
