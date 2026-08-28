import { useCallback } from "react";
import { Copy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SlugFieldProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

export function SlugField({ value, onChange, error, disabled }: SlugFieldProps) {
  const baseUrl = "travioghana.com/blog";

  const handleCopy = useCallback(() => {
    if (value) navigator.clipboard.writeText(`${baseUrl}/${value}`);
  }, [value]);

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">Slug</Label>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="article-slug"
            disabled={disabled}
            className={error ? "border-destructive pr-10" : "pr-10"}
          />
          {value && !disabled && (
            <button
              type="button"
              onClick={handleCopy}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              title="Copy URL"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      {value && (
        <p className="text-xs text-muted-foreground">
          {baseUrl}/<span className="text-primary font-medium">{value}</span>
        </p>
      )}
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}
