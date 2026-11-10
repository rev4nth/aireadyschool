import { NavLink } from "react-router-dom";
import {
  BookOpenCheck,
  Brain,
  ChartColumnIncreasing,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileStack,
  HelpCircle,
  LayoutDashboard,
  Map,
  MessageSquareText,
  Settings,
  UserRound,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const learnNav = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/materials", label: "My Materials", icon: FileStack },
  { to: "/topics", label: "Topic Map", icon: Map },
  { to: "/quiz", label: "Diagnostic Quiz", icon: ClipboardList },
  { to: "/gaps", label: "Knowledge Gaps", icon: Brain },
  { to: "/revision", label: "Revision Plan", icon: BookOpenCheck },
];

const aiNav = [{ to: "/assistant", label: "AI Study Assistant", icon: MessageSquareText }];
const progressNav = [{ to: "/analytics", label: "Analytics", icon: ChartColumnIncreasing }];
const accountNav = [
  { to: "/profile", label: "Profile", icon: UserRound },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/settings", label: "Help & Support", icon: HelpCircle, hash: "#help" },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

function NavGroup({
  title,
  items,
  collapsed,
  onClose,
}: {
  title: string;
  items: Array<{ to: string; label: string; icon: typeof LayoutDashboard; hash?: string }>;
  collapsed: boolean;
  onClose: () => void;
}) {
  return (
    <div className="space-y-1">
      {!collapsed ? (
        <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
          {title}
        </p>
      ) : (
        <div className="pt-3" />
      )}
      {items.map(({ to, label, icon: Icon, hash }) => (
        <NavLink
          key={`${to}-${label}`}
          to={hash ? `${to}${hash}` : to}
          title={collapsed ? label : undefined}
          onClick={onClose}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              collapsed && "justify-center px-2",
              isActive
                ? "bg-white/10 text-white"
                : "text-white/65 hover:bg-white/5 hover:text-white",
            )
          }
        >
          <Icon className="h-4 w-4 shrink-0 opacity-90" />
          {!collapsed ? <span className="truncate">{label}</span> : null}
        </NavLink>
      ))}
    </div>
  );
}

export function Sidebar({ open, onClose, collapsed, onToggleCollapsed }: SidebarProps) {
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
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar text-sidebar-foreground transition-all lg:static lg:translate-x-0",
          collapsed ? "w-[72px]" : "w-[248px]",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className={cn("flex h-14 items-center gap-2 px-3", collapsed && "justify-center")}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <BookOpenCheck className="h-4 w-4" />
          </div>
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">GapFinder AI</p>
              <p className="truncate text-[11px] text-white/45">Find what you don’t know</p>
            </div>
          ) : null}
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

        <nav className="flex-1 overflow-y-auto px-2 pb-3">
          <NavGroup title="Learn" items={learnNav} collapsed={collapsed} onClose={onClose} />
          <NavGroup title="AI Learning" items={aiNav} collapsed={collapsed} onClose={onClose} />
          <NavGroup title="Progress" items={progressNav} collapsed={collapsed} onClose={onClose} />
          <NavGroup title="Account" items={accountNav} collapsed={collapsed} onClose={onClose} />
        </nav>

        <div className="border-t border-white/10 p-2">
          <Button
            variant="ghost"
            className={cn(
              "w-full text-white/70 hover:bg-white/5 hover:text-white",
              collapsed ? "justify-center px-0" : "justify-start",
            )}
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            {!collapsed ? <span className="ml-2 text-sm">Collapse</span> : null}
          </Button>
        </div>
      </aside>
    </>
  );
}
