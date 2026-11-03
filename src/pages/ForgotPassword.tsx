import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AuthShell from "@/features/auth/AuthShell";
import { mapAuthError, type AuthError } from "@/features/auth/authErrors";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);
  const [sent, setSent] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post("/auth/forgot-password", { email: email.trim().toLowerCase() });
      setSent(true);
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle={
        sent
          ? "Follow the link we sent to set a new password."
          : "Enter the email on your account and we'll send a reset link."
      }
      footer={
        <Link
          to="/admin/login"
          className="font-medium text-primary transition-colors hover:text-primary/80"
        >
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="rounded-xl border border-success/20 bg-success/5 px-4 py-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-text-primary">Check your email</p>
              <p className="mt-1 text-sm text-text-secondary">
                If an account exists for <span className="font-medium">{email}</span>, we sent a
                reset link. It expires in 15 minutes.
              </p>
              <p className="mt-2 text-xs text-text-tertiary">
                Nothing arrived? Check spam, then try again with the address you sign in with.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-[13px] font-medium text-text-secondary">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@travioghana.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
              autoComplete="email"
              spellCheck={false}
              autoCapitalize="none"
              inputMode="email"
              className="h-11"
            />
          </div>

          {error && (
            <div
              ref={errorRef}
              tabIndex={-1}
              role="alert"
              className="rounded-xl border border-destructive/20 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive outline-none"
            >
              {error.message}
              {error.hint && <p className="mt-0.5 text-xs text-destructive/80">{error.hint}</p>}
            </div>
          )}

          <Button type="submit" size="lg" className="h-11 w-full" disabled={loading} aria-busy={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {loading ? "Sending..." : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
