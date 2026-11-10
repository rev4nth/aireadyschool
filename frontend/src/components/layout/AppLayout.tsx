import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { SubjectProvider } from "@/contexts/SubjectContext";
import { cn } from "@/lib/utils";

const COLLAPSE_KEY = "gapfinder-sidebar-collapsed";

export function AppLayout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === "1");

  const focusMode = /\/quiz\/[^/]+\/(take|results)/.test(location.pathname);

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  return (
    <SubjectProvider>
      <div className="flex min-h-screen bg-background">
        {!focusMode ? (
          <Sidebar
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            collapsed={collapsed}
            onToggleCollapsed={() => setCollapsed((v) => !v)}
          />
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col">
          {!focusMode ? <Header onMenuClick={() => setSidebarOpen(true)} /> : null}
          <main className={cn("flex-1", focusMode ? "px-0 py-0" : "px-4 py-5 md:px-6 md:py-6")}>
            <div className={cn("mx-auto w-full", focusMode ? "max-w-none" : "max-w-6xl")}>
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SubjectProvider>
  );
}
