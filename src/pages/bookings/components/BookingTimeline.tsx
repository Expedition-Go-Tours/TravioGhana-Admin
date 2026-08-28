import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface TimelineStep {
  label: string;
  date: string | null;
  active: boolean;
  description?: string;
}

interface BookingTimelineProps {
  steps: TimelineStep[];
}

const dotColors = {
  active: "bg-primary border-primary/30",
  completed: "bg-status-active border-status-active/30",
  pending: "bg-border border-border/60",
};

export function BookingTimeline({ steps }: BookingTimelineProps) {
  return (
    <div className="space-y-0">
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1;
        const dotClass = step.active ? dotColors.active : step.date ? dotColors.completed : dotColors.pending;

        return (
          <div key={step.label} className="relative flex gap-3">
            {!isLast && (
              <div className={cn(
                "absolute left-[11px] top-5 w-0.5 h-full -translate-x-1/2",
                step.date ? "bg-primary/20" : "bg-border"
              )} />
            )}
            <div className="flex flex-col items-center shrink-0 pt-0.5">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={cn("h-[22px] w-[22px] rounded-full border-2 flex items-center justify-center", dotClass)}
              >
                {step.date && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="h-2 w-2 rounded-full bg-current"
                  />
                )}
              </motion.div>
            </div>
            <div className={cn("pb-5", isLast && "pb-0")}>
              <p className={cn(
                "text-xs font-medium",
                step.active ? "text-primary" : step.date ? "text-text-primary" : "text-text-tertiary"
              )}>
                {step.label}
              </p>
              {step.date && (
                <p className="text-[10px] text-text-tertiary mt-0.5">
                  {new Date(step.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
              {step.description && (
                <p className="text-[10px] text-text-secondary mt-0.5">{step.description}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
