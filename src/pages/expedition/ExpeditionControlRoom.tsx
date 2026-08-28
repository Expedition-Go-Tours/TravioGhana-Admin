import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import ExpeditionSupplierList from "./ExpeditionSupplierList";
import ExpeditionSupplierTours from "./ExpeditionSupplierTours";

interface Supplier {
  id: string;
  name: string;
  email: string;
  photoURL: string | null;
  totalTours: number;
  onExpedition: number;
  activeOnExpedition: number;
  directCount: number;
}

type View = { type: "list" } | { type: "supplier-tours"; supplier: Supplier };

export default function ExpeditionControlRoom() {
  const [view, setView] = useState<View>({ type: "list" });

  return (
    <div className="min-h-0">
      <AnimatePresence mode="wait">
        {view.type === "list" && (
          <ExpeditionSupplierList
            key="supplier-list"
            onSelectSupplier={(supplier) => setView({ type: "supplier-tours", supplier })}
          />
        )}
        {view.type === "supplier-tours" && (
          <ExpeditionSupplierTours
            key={`supplier-${view.supplier.id}`}
            supplier={view.supplier}
            onBack={() => setView({ type: "list" })}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
