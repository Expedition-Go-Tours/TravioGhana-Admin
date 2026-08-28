import { useEffect, useRef, useState } from "react";
import { searchAdminTours, type AdminTourSearchResult } from "@/services/tourService";
import { searchSuppliers, type AdminSupplierSearchResult } from "@/services/supplierService";

interface Options {
  toursEnabled?: boolean;
  suppliersEnabled?: boolean;
  minLength?: number;
  debounceMs?: number;
}

/**
 * Debounced server-side search for the admin search bar. Searches tours and
 * suppliers in parallel, keeps previous results while typing, and ignores
 * stale responses (race-safe via a sequence guard).
 */
export function useAdminSearch(query: string, options: Options = {}) {
  const {
    toursEnabled = true,
    suppliersEnabled = true,
    minLength = 2,
    debounceMs = 250,
  } = options;

  const [tours, setTours] = useState<AdminTourSearchResult[]>([]);
  const [suppliers, setSuppliers] = useState<AdminSupplierSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  const q = query.trim();
  const shouldRun = q.length >= minLength && (toursEnabled || suppliersEnabled);

  useEffect(() => {
    if (!shouldRun) {
      seq.current += 1;
      return;
    }

    const id = ++seq.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const calls: Promise<unknown>[] = [];
        if (toursEnabled) calls.push(searchAdminTours(q));
        if (suppliersEnabled) calls.push(searchSuppliers(q));

        const [t, s] = (await Promise.all(calls)) as [
          AdminTourSearchResult[] | undefined,
          AdminSupplierSearchResult[] | undefined,
        ];

        if (seq.current === id) {
          if (toursEnabled) setTours(t || []);
          if (suppliersEnabled) setSuppliers(s || []);
        }
      } catch {
        if (seq.current === id) {
          if (toursEnabled) setTours([]);
          if (suppliersEnabled) setSuppliers([]);
        }
      } finally {
        if (seq.current === id) setLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [q, shouldRun, toursEnabled, suppliersEnabled, debounceMs]);

  // While the query is too short (or search is disabled) expose empty results
  // immediately without touching state — keeps the UI race-free.
  return {
    tours: shouldRun ? tours : [],
    suppliers: shouldRun ? suppliers : [],
    loading: shouldRun && loading,
  };
}
