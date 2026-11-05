import { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { CommandPalette } from "./CommandPalette";
import { useAdminRole } from "@/auth/useAdminRole";
import { useTokenRefresh } from "@/hooks/useTokenRefresh";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  useAdminRole(true);
  useTokenRefresh();
  useSessionTimeout();

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  // A new route starts at the top of its own content. Without this, opening a
  // record from a long list inherited the previous page's scroll offset.
  useEffect(() => {
    document.querySelector("main")?.scrollTo({ top: 0, behavior: "auto" });
  }, [location.pathname]);

  return (
    <div className="flex h-screen flex-col bg-surface-muted">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar open={sidebarOpen} onClose={closeSidebar} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <CommandPalette />
          <main className="flex flex-1 flex-col overflow-y-auto p-4 md:p-6 lg:p-8">
            <div
              key={location.pathname}
              className="admin-page mx-auto min-h-0 w-full max-w-[1440px] flex-1 motion-reduce:animate-none"
            >
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}