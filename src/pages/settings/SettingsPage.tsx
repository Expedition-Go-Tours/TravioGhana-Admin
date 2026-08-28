import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ErrorBoundary } from "react-error-boundary";
import { RefreshCw, AlertTriangle, SlidersHorizontal, ShieldCheck, Users, Server } from "lucide-react";
import { useAdminRole } from "@/auth/useAdminRole";
import { GeneralTab } from "./GeneralTab";
import { RolesTab } from "./RolesTab";
import { AdminUsersTab } from "./AdminUsersTab";
import { SystemTab } from "./SystemTab";
import { isSuperAdmin } from "@/hooks/usePermission";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/PageHeader";
import { cn } from "@/lib/utils";

const TABS: { id: string; label: string; desc: string; icon: ReactNode; adminOnly: boolean }[] = [
  { id: "general", label: "General", desc: "Platform, branding, booking rules", icon: <SlidersHorizontal className="h-4 w-4" />, adminOnly: false },
  { id: "roles", label: "Admin Roles", desc: "Manage roles and permissions", icon: <ShieldCheck className="h-4 w-4" />, adminOnly: true },
  { id: "users", label: "Admin Users", desc: "Manage admin accounts", icon: <Users className="h-4 w-4" />, adminOnly: true },
  { id: "system", label: "System", desc: "Maintenance and health", icon: <Server className="h-4 w-4" />, adminOnly: true },
];

const contentVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.15, ease: "easeIn" as const } },
};

function TabFallback({ error, resetErrorBoundary }: { error: unknown; resetErrorBoundary: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border/60 bg-surface-base px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500/20 to-red-600/10 mb-4 ring-1 ring-red-500/20">
        <AlertTriangle className="h-6 w-6 text-red-500" />
      </div>
      <h3 className="text-base font-semibold text-text-primary mb-1">Something went wrong</h3>
      <p className="text-sm text-text-secondary mb-6 max-w-md">
        {(error instanceof Error ? error.message : "An unexpected error occurred while rendering this section.")}
      </p>
      <Button variant="outline" size="sm" onClick={resetErrorBoundary} className="gap-2 shadow-sm">
        <RefreshCw className="h-4 w-4" /> Try Again
      </Button>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">
      <div className="w-full lg:w-60 lg:shrink-0 space-y-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="space-y-1 flex-1">
              <Skeleton className={cn("h-3.5", i === 0 ? "w-20" : i === 1 ? "w-24" : "w-16")} />
              <Skeleton className="h-2.5 w-28" />
            </div>
          </div>
        ))}
      </div>
      <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, s) => (
          <div key={s} className="rounded-xl border border-border/60 bg-surface-base p-6 space-y-5 shadow-sm">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-44" />
              </div>
            </div>
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-10 w-full rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general");
  const superAdmin = isSuperAdmin();
  const { isLoading: roleLoading } = useAdminRole(true);

  const visibleTabs = TABS.filter((t) => !t.adminOnly || superAdmin);
  const activeTabId = !superAdmin ? "general" : activeTab;

  if (roleLoading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-40" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <SettingsSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title="System Settings"
        subtitle="Configure and manage all system preferences"
      />

      <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">
        <nav className="w-full lg:w-60 lg:shrink-0" aria-label="Settings sections">
          <div className="flex lg:flex-col gap-0.5 overflow-x-auto scrollbar-none">
            {visibleTabs.map((tab) => {
              const isActive = activeTabId === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors shrink-0",
                    isActive
                      ? "bg-text-primary/10 font-medium"
                      : "text-text-secondary hover:bg-surface-muted/60 hover:text-text-primary",
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="settingsNavActive"
                      className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-text-primary hidden lg:block"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <div className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                    isActive ? "bg-text-primary/10 text-text-primary" : "bg-surface-muted text-text-secondary",
                  )}>
                    {tab.icon}
                  </div>
                  <div className="min-w-0">
                    <div className={cn("text-sm truncate", isActive ? "font-semibold text-text-primary" : "text-text-primary")}>
                      {tab.label}
                    </div>
                    <div className="text-[11px] text-text-tertiary truncate leading-tight hidden lg:block">{tab.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </nav>

        <div className="flex-1 min-w-0 max-w-4xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTabId}
              variants={contentVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <ErrorBoundary FallbackComponent={TabFallback} key={activeTabId}>
                {activeTabId === "general" && <GeneralTab />}
                {activeTabId === "roles" && superAdmin && <RolesTab />}
                {activeTabId === "users" && superAdmin && <AdminUsersTab />}
                {activeTabId === "system" && superAdmin && <SystemTab />}
              </ErrorBoundary>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}