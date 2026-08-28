import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, CornerDownLeft, Package, Building2, Loader2 } from "lucide-react";
import { getNavGroups } from "@/components/layout/navConfig";
import { usePermission } from "@/hooks/usePermission";
import { useAdminSearch } from "@/hooks/useAdminSearch";
import { SafeImage } from "@/components/shared/SafeImage";
import { cn } from "@/lib/utils";

interface PageItem {
  kind: "page";
  label: string;
  path: string;
  group: string;
  keywords: string[];
}
interface TourItem {
  kind: "tour";
  id: string;
  label: string;
  subtitle: string;
  path: string;
  group: string;
  keywords: string[];
  coverPhoto: string | null;
}
interface SupplierItem {
  kind: "supplier";
  id: string;
  label: string;
  subtitle: string;
  path: string;
  group: string;
  keywords: string[];
  photoURL: string | null;
}
type SearchItem = PageItem | TourItem | SupplierItem;

function flatten(groups: { group: string; items: { label: string; path?: string; keywords?: string[]; children?: { label: string; path: string }[] }[] }[]): PageItem[] {
  const out: PageItem[] = [];
  for (const group of groups) {
    for (const item of group.items) {
      if (item.children) {
        for (const child of item.children) {
          out.push({ kind: "page", label: `${item.label} — ${child.label}`, path: child.path, group: group.group, keywords: [...(item.keywords || []), item.label, child.label] });
        }
      } else if (item.path) {
        out.push({ kind: "page", label: item.label, path: item.path, group: group.group, keywords: [...(item.keywords || []), item.label] });
      }
    }
  }
  return out;
}

function getInPageItems(can: (key: string) => boolean): PageItem[] {
  const items: PageItem[] = [];
  if (can('payouts.view') || can('payout-methods.view')) {
    if (can('payouts.view')) {
      items.push(
        { kind: "page", label: "Payouts — Payments", path: "/admin/payouts?tab=payments", group: "Finance", keywords: ["payments", "pending", "approval", "release", "payout"] },
        { kind: "page", label: "Payouts — All Payouts", path: "/admin/payouts?tab=payouts", group: "Finance", keywords: ["payouts", "list", "history", "records"] },
      );
    }
    if (can('payout-methods.view')) {
      items.push(
        { kind: "page", label: "Payouts — Supplier Methods", path: "/admin/payouts?tab=methods", group: "Finance", keywords: ["bank", "paypal", "methods", "supplier", "verification"] },
      );
    }
  }
  return items;
}

const SEARCHABLE_TEXT = (item: SearchItem) => [item.label, item.group, ...item.keywords].join(" ").toLowerCase();

function highlightMatch(text: string, query: string) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { can, isSuperAdmin } = usePermission();

  const canSearchTours = can("tours.view");
  const canSearchSuppliers = can("suppliers.view");
  const { tours, suppliers, loading } = useAdminSearch(query, {
    toursEnabled: canSearchTours,
    suppliersEnabled: canSearchSuppliers,
  });

  const adminItems = useMemo<PageItem[]>(
    () =>
      isSuperAdmin
        ? [
            { kind: "page", label: "Activity Log", path: "/admin/activity-log", group: "Administration", keywords: ["activity", "audit", "log", "history"] },
            { kind: "page", label: "Settings", path: "/admin/settings", group: "Administration", keywords: ["settings", "config", "preferences"] },
          ]
        : [],
    [isSuperAdmin],
  );

  const items = useMemo(() => {
    const groups = [...getNavGroups(can), { group: "Administration", items: adminItems }];
    return [...flatten(groups), ...getInPageItems(can)];
  }, [can, adminItems]);

  const validPaths = useMemo(() => new Set(items.map((i) => i.path)), [items]);

  const pageResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => SEARCHABLE_TEXT(i).includes(q));
  }, [items, query]);

  const tourResults = useMemo(
    () =>
      tours.map((t) => ({
        kind: "tour" as const,
        id: t.id,
        label: t.title || "Untitled tour",
        subtitle: [t.supplierName, t.category, [t.city, t.country].filter(Boolean).join(", ")].filter(Boolean).join(" • "),
        path: `/admin/tours/${t.id}`,
        group: "Tours",
        keywords: [t.title, t.supplierName || "", t.category || "", t.city || "", t.country || ""].filter(Boolean),
        coverPhoto: t.coverPhoto,
      })),
    [tours],
  );

  const supplierResults = useMemo(
    () =>
      suppliers.map((s) => ({
        kind: "supplier" as const,
        id: s.id,
        label: s.name || "Supplier",
        subtitle: s.email || "",
        path: `/admin/suppliers/${s.id}`,
        group: "Suppliers",
        keywords: [s.name, s.email].filter(Boolean),
        photoURL: s.photoURL,
      })),
    [suppliers],
  );

  const flatResults = useMemo(() => {
    if (!query.trim()) return items;
    return [...pageResults, ...tourResults, ...supplierResults];
  }, [query, pageResults, tourResults, supplierResults, items]);

  const groups = useMemo(() => {
    if (!query.trim()) {
      return items.length ? ([["Pages", items] as [string, SearchItem[]]]) : [];
    }
    const out: [string, SearchItem[]][] = [];
    if (pageResults.length) out.push(["Pages", pageResults]);
    if (tourResults.length) out.push(["Tours", tourResults]);
    if (supplierResults.length) out.push(["Suppliers", supplierResults]);
    return out;
  }, [query, pageResults, tourResults, supplierResults, items]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onOpenCommandPalette() {
      setOpen(true);
      setHighlight(0);
      setQuery("");
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("open-command-palette", onOpenCommandPalette);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("open-command-palette", onOpenCommandPalette);
    };
  }, []);

  useEffect(() => {
    if (open) {
      const raf = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(raf);
    }
  }, [open]);

  const navigateTo = useCallback(
    (item: SearchItem) => {
      if (item.kind === "page" && !validPaths.has(item.path)) {
        console.warn(`[CommandPalette] Navigation blocked: path "${item.path}" not in permission-filtered items`);
        return;
      }
      setOpen(false);
      setQuery("");
      setHighlight(0);
      navigate(item.path);
    },
    [navigate, validPaths],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, flatResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = flatResults[highlight];
      if (target) navigateTo(target);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-sm"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
        >
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.32, 0.72, 0, 1] }}
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface-base shadow-soft-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search className="h-4 w-4 shrink-0 text-text-tertiary" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setHighlight(0); }}
                onKeyDown={handleKeyDown}
                placeholder="Search pages, tours, suppliers…"
                className="h-13 w-full bg-transparent py-4 text-sm text-text-primary placeholder:text-text-tertiary outline-none"
              />
              <kbd className="hidden shrink-0 rounded-md border border-border bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-text-tertiary sm:block">
                ESC
              </kbd>
            </div>
            <div className="max-h-[40vh] overflow-y-auto scrollbar-thin p-2">
              {flatResults.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-text-tertiary">
                  No results for “{query}”
                </p>
              ) : (
                groups.map(([group, groupItems]) => (
                  <div key={group} className="mb-1">
                    <div className="flex items-center gap-2 px-3 py-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">{group}</span>
                    </div>
                    {groupItems.map((item) => {
                      const idx = flatResults.indexOf(item);
                      const active = idx === highlight;
                      return (
                        <button
                          key={item.path}
                          onClick={() => navigateTo(item)}
                          onMouseEnter={() => setHighlight(idx)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                            active ? "bg-accent text-accent-foreground" : "text-text-primary hover:bg-surface-muted",
                          )}
                        >
                          {item.kind === "tour" && (
                            <>
                              <SafeImage
                                src={item.coverPhoto || undefined}
                                alt=""
                                className="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-border/60"
                                fallback={
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted">
                                    <Package className="h-4 w-4 text-text-tertiary" />
                                  </div>
                                }
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium">{highlightMatch(item.label, query.trim())}</span>
                                {item.subtitle && <span className="block truncate text-[11px] text-text-tertiary">{item.subtitle}</span>}
                              </span>
                            </>
                          )}
                          {item.kind === "supplier" && (
                            <>
                              <SafeImage
                                src={item.photoURL || undefined}
                                alt=""
                                className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-border/60"
                                fallback={
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted">
                                    <Building2 className="h-4 w-4 text-text-tertiary" />
                                  </div>
                                }
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium">{highlightMatch(item.label, query.trim())}</span>
                                {item.subtitle && <span className="block truncate text-[11px] text-text-tertiary">{item.subtitle}</span>}
                              </span>
                            </>
                          )}
                          {item.kind === "page" && (
                            <>
                              <span className="min-w-0 flex-1 truncate font-medium">{highlightMatch(item.label, query.trim())}</span>
                              <span className="shrink-0 text-xs text-text-tertiary">{item.group}</span>
                            </>
                          )}
                          {active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 opacity-60" />}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
              {loading && (
                <div className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-text-tertiary">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Searching…
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
