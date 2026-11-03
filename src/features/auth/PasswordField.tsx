import { useId, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PasswordFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoComplete?: string;
  autoFocus?: boolean;
  placeholder?: string;
  invalid?: boolean;
  /** Extra id(s) for aria-describedby (error text, password rules). */
  describedBy?: string;
}

/**
 * Password input with a reveal toggle and a caps-lock warning. The toggle is a
 * real button inside the label row so keyboard and screen-reader users reach it
 * without tabbing past the field first.
 */
export default function PasswordField({
  value,
  onChange,
  disabled,
  autoComplete = "current-password",
  autoFocus,
  placeholder = "••••••••",
  invalid,
  describedBy,
}: PasswordFieldProps) {
  const inputId = useId();
  const [revealed, setRevealed] = useState(false);
  const [capsOn, setCapsOn] = useState(false);

  const handleKey = (event: KeyboardEvent<HTMLInputElement>) => {
    setCapsOn(event.getModifierState?.("CapsLock") ?? false);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <div>
      <div className="relative">
        <Input
          id={inputId}
          type={revealed ? "text" : "password"}
          value={value}
          onChange={handleChange}
          onKeyUp={handleKey}
          onKeyDown={handleKey}
          onBlur={() => setCapsOn(false)}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn("h-11 pr-12", invalid && "border-destructive")}
        />
        <button
          type="button"
          onClick={() => setRevealed((shown) => !shown)}
          disabled={disabled}
          aria-label={revealed ? "Hide password" : "Show password"}
          aria-pressed={revealed}
          className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-surface-muted hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {revealed ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>

      <p
        aria-live="polite"
        className={cn(
          "mt-1.5 text-xs text-warning",
          !capsOn && "sr-only",
        )}
      >
        {capsOn ? "Caps Lock is on." : ""}
      </p>
    </div>
  );
}
