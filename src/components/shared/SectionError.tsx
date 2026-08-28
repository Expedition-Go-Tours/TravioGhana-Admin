import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SectionErrorProps {
  message?: string;
  onRetry?: () => void;
}

export function SectionError({
  message = "Failed to load data",
  onRetry,
}: SectionErrorProps) {
  return (
    <div
      className="flex flex-col items-center justify-center py-8 text-text-secondary"
      aria-live="polite"
    >
      <AlertCircle className="mb-2 h-8 w-8 text-status-rejected" />
      <p className="text-sm">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
