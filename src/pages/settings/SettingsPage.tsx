import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
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

type TabGroup = "Workspace" | "Access" | "System";

const TAB_GROUPS: TabGroup[] = ["Workspace", "Access", "System"];

const TABS: {
  id: string;
  label: string;
  desc: string;
  icon: ReactNode;
  group: TabGroup;
  adminOnly: boolean;
}[] = [
  {
    id: "general",
    label: "General",
    desc: "Platform identity, money rules, and booking defaults.",
    icon: <SlidersHorizontal className="h-4 w-4" />,
    group: "Workspace",
    adminOnly: false,
  },
  {
    id: "roles",
    label: "Admin roles",
    desc: "Define what each admin can see and do.",
    icon: <ShieldCheck className="h-4 w-4" />,
    group: "Access",
    adminOnly: true,
  },
  {
    id: "users",
    label: "Admin users",
    desc: "Grant, change, or revoke admin access.",
    icon: <Users className="h-4 w-4" />,
    group: "Access",
    adminOnly: true,
  },
  {
    id: "system",
    label: "System",
    desc: "Operational status and maintenance controls.",
    icon: <Server className="h-4 w-4" />,
    group: "System",
    adminOnly: true,
  },
];

function TabFallback({ error, resetErrorBoundary }: { error: unknown; resetErrorBoundary: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface-base px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-status-rejected/10">
        <AlertTriangle className="h-6 w-6 text-status-rejected-text" />
      </div>
      <h3 className="mb-1 text-base font-semibold text-text-primary">This section could not load</h3>
      <p className="mb-6 max-w-md text-sm leading-relaxed text-text-secondary">
        {error instanceof Error ? error.message : "An unexpected error occurred while rendering this section."}
      </p>
      <Button variant="outline" size="sm" onClick={resetErrorBoundary} className="gap-2">
        <RefreshCw className="h-4 w-4" /> Try again
      </Button>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[212px_minmax(0,1fr)] lg:gap-8">
      <div className="hidden space-y-6 lg:block">
        {Array.from({ length: 3 }).map((_, group) => (
          <div key={group} className="space-y-1.5">
            <Skeleton className="ml-3 h-2.5 w-16" />
            {Array.from({ length: group === 1 ? 2 : 1 }).map((_, item) => (
              <div key={item} className="flex items-center gap-2.5 px-3 py-2">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-3.5 w-24" />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="min-w-0 space-y-5">
        <div className="border-b border-border pb-5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-2.5 h-6 w-36" />
          <Skeleton className="mt-2 h-4 w-72 max-w-full" />
        </div>
        {Array.from({ length: 2 }).map((_, card) => (
          <div key={card} className="overflow-hidden rounded-xl border border-border bg-surface-base">
            <div className="flex items-center gap-3 px-6 py-4">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-64 max-w-full" />
              </div>
            </div>
            <div className="space-y-5 border-t border-border px-6 py-5">
              {Array.from({ length: 3 }).map((_, row) => (
                <div key={row} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1.5">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-3 w-56 max-w-full" />
                  </div>
                  <Skeleton className="h-10 w-full rounded-md sm:w-[260px]" />
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
  const [searchParams, setSearchParams] = useSearchParams();
  const superAdmin = isSuperAdmin();
  const { isLoading: roleLoading } = useAdminRole(true);

  const visibleTabs = TABS.filter((tab) => !tab.adminOnly || superAdmin);
  const requestedTab = searchParams.get("tab");
  const activeTabId =
    !superAdmin || !requestedTab || !visibleTabs.some((tab) => tab.id === requestedTab)
      ? "general"
      : requestedTab;
  const activeTab = TABS.find((tab) => tab.id === activeTabId) ?? TABS[0];

  function selectTab(id: string) {
    const next = new URLSearchParams(searchParams);
    if (id === "general") next.delete("tab");
    else next.set("tab", id);
    setSearchParams(next, { replace: true });
  }

  if (roleLoading) {
    return (
      <div className="mx-auto max-w-[1180px] space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <SettingsSkeleton />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1180px] space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Workspace configuration, access control, and platform health."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[212px_minmax(0,1fr)] lg:gap-8">
        <nav aria-label="Settings sections" className="min-w-0 lg:sticky lg:top-20 lg:self-start">
          <div className="grid grid-cols-2 gap-1.5 lg:flex lg:flex-col lg:gap-6">
            {TAB_GROUPS.map((group) => {
              const tabs = visibleTabs.filter((tab) => tab.group === group);
              if (tabs.length === 0) return null;

              return (
                <div key={group} className="contents lg:flex lg:flex-col lg:gap-0.5">
                  <p className="hidden px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-text-tertiary lg:block">
                    {group}
                  </p>
                  {tabs.map((tab) => {
                    const active = tab.id === activeTabId;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => selectTab(tab.id)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                          active
                            ? "bg-primary/10 font-semibold text-primary"
                            : "font-medium text-text-secondary hover:bg-surface-muted hover:text-text-primary",
                        )}
                      >
                        <span className={cn("flex h-4 w-4 items-center justify-center", active ? "text-primary" : "text-text-tertiary")}>
                          {tab.icon}
                        </span>
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </nav>

        <div className="min-w-0">
          <div className="mb-5 border-b border-border pb-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-tertiary">
              {activeTab.group}
            </p>
            <h2 className="mt-1.5 text-[22px] font-semibold leading-7 tracking-[-0.02em] text-text-primary">
              {activeTab.label}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-text-tertiary">{activeTab.desc}</p>
          </div>

          <ErrorBoundary FallbackComponent={TabFallback} resetKeys={[activeTabId]}>
            {activeTabId === "general" && <GeneralTab />}
            {activeTabId === "roles" && superAdmin && <RolesTab />}
            {activeTabId === "users" && superAdmin && <AdminUsersTab />}
            {activeTabId === "system" && superAdmin && <SystemTab />}
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
