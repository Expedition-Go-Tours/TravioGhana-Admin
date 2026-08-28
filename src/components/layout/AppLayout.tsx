import { useState, useCallback } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { CommandPalette } from "./CommandPalette";
import { pageTransition } from "@/lib/animations";
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

  return (
    <div className="flex h-screen flex-col bg-surface-muted/50">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar open={sidebarOpen} onClose={closeSidebar} onOpen={() => setSidebarOpen(true)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <CommandPalette />
          <main className="flex flex-1 flex-col overflow-y-auto p-4 md:p-6 lg:p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                variants={pageTransition}
                initial="initial"
                animate="animate"
                exit="exit"
                className="mx-auto w-full max-w-[1440px] flex-1 min-h-0"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
}
