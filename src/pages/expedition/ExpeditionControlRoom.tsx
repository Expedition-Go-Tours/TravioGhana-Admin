import { useState } from "react";
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
      <>
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
      </>
    </div>
  );
}