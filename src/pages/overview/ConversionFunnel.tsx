import { Skeleton } from "@/components/ui/skeleton";
import { Filter } from "lucide-react";

interface ConversionFunnelProps {
  data?: {
    funnel: {
      viewed: number;
      addedToCart: number;
      startedCheckout: number;
      completed: number;
    };
    rates: {
      viewToCart: number;
      cartToCheckout: number;
      checkoutToCompleted: number;
      overallConversion: number;
    };
    dropOff: {
      viewToCart: number;
      cartToCheckout: number;
      checkoutToCompleted: number;
    };
  };
  loading?: boolean;
}

export function ConversionFunnel({ data, loading }: ConversionFunnelProps) {
  const funnel = data?.funnel;
  const rates = data?.rates;

  const steps = funnel ? [
    { label: "Viewed Tour", value: funnel.viewed, color: "hsl(var(--chart-5))" },
    { label: "Added to Cart", value: funnel.addedToCart, color: "hsl(var(--chart-5))" },
    { label: "Started Checkout", value: funnel.startedCheckout, color: "hsl(var(--chart-5))" },
    { label: "Completed Booking", value: funnel.completed, color: "hsl(var(--status-active))" },
  ] : [];

  const maxValue = steps[0]?.value || 1;

  return (
    <div className="rounded-2xl bg-surface-base border border-border/60 shadow-soft p-5 h-full">
      <div className="flex items-center gap-2 mb-5">
        <Filter className="h-4 w-4 text-text-secondary" />
        <h3 className="text-[15px] font-semibold text-text-primary">Conversion Funnel</h3>
      </div>
      
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : !funnel ? (
        <div className="py-10 text-center text-sm text-text-secondary">No funnel data available</div>
      ) : (
        <div className="space-y-4">
          {steps.map((step, index) => {
            const widthPercent = maxValue > 0 ? (step.value / maxValue) * 100 : 0;
            const conversionRate = index > 0 ? rates?.[index === 1 ? "viewToCart" : index === 2 ? "cartToCheckout" : "checkoutToCompleted"] : 100;
            
            return (
              <div key={step.label} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">{step.label}</span>
                  <span className="text-sm font-semibold text-text-primary">{step.value.toLocaleString()}</span>
                </div>
                <div className="relative h-10 bg-surface-muted rounded-xl overflow-hidden">
                  <div 
                    className="absolute inset-y-0 left-0 rounded-xl transition-all duration-700 ease-out"
                    style={{ 
                      width: `${widthPercent}%`,
                      backgroundColor: step.color,
                    }}
                  />
                  {widthPercent > 25 && (
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white">
                      {widthPercent.toFixed(0)}%
                    </span>
                  )}
                </div>
                {index > 0 && conversionRate !== undefined && (
                  <p className="text-[11px] text-text-tertiary text-right">
                    {conversionRate.toFixed(1)}% conversion
                  </p>
                )}
              </div>
            );
          })}
          
          {rates && (
            <div className="pt-4 mt-4 border-t border-border/60">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Overall Conversion</span>
                <span className="text-lg font-bold text-text-primary">{rates.overallConversion.toFixed(1)}%</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
