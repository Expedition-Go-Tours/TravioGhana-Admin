import { Inbox } from "lucide-react";

interface SectionEmptyProps {
  message?: string;
}

export function SectionEmpty({ message = "No data yet" }: SectionEmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-text-secondary" aria-live="polite">
      <Inbox className="mb-2 h-6 w-6" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
