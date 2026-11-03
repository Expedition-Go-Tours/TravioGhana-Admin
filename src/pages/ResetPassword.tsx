import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import AuthShell from "@/features/auth/AuthShell";
import PasswordField from "@/features/auth/PasswordField";
import { mapAuthError, type AuthError } from "@/features/auth/authErrors";

const MIN_LENGTH = 8;

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);
  const [done, setDone] = useState(false);
  const [linkExpired, setLinkExpired] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const mismatch = confirm.length > 0 && confirm !== password;
  const tooShort = password.length > 0 && password.length < MIN_LENGTH;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < MIN_LENGTH) {
      setError({ kind: "validation", message: "Password must be at least 8 characters", retryable: false });
      return;
    }
    if (confirm !== password) {
      setError({ kind: "validation", message: "The two passwords do not match.", retryable: false });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.post("/auth/reset-password", { token, password });
      setDone(true);
    } catch (err) {
      const mapped = mapAuthError(err);
      // A rejected token is not a form error: the link is the problem.
      if (mapped.kind === "validation" && mapped.message !== "Password must be at least 8 characters") {
        setLinkExpired(true);
        return;
      }
      setError(mapped);
    } finally {
      setLoading(false);
    }
  };

  const expiredLink = !token || linkExpired;

  return (
    <AuthShell
      title={expiredLink ? "This reset link is no longer valid" : "Set a new password"}
      subtitle={
        expiredLink
          ? "Reset links expire after 15 minutes, and each one can only be used once."
          : "Choose a password with at least 8 characters."
      }
      footer={
        <Link
          to={expiredLink ? "/admin/forgot-password" : "/admin/login"}
          className="font-medium text-primary transition-colors hover:text-primary/80"
        >
          {expiredLink ? "Request a new link" : "Back to sign in"}
        </Link>
      }
    >
      {done ? (
        <div className="rounded-xl border border-success/20 bg-success/5 px-4 py-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-text-primary">Password updated</p>
              <p className="mt-1 text-sm text-text-secondary">
                You can now sign in with your new password.
              </p>
              <Link
                to="/admin/login"
                className="mt-2 inline-block text-sm font-medium text-primary transition-colors hover:text-primary/80"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      ) : expiredLink ? (
        <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-text-primary">Start over to get a fresh link</p>
              <p className="mt-1 text-sm text-text-secondary">
                Request another reset email and open the newest link in it.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="new-password"
              className="text-[13px] font-medium text-text-secondary"
            >
              New password
            </label>
            <PasswordField
              value={password}
              onChange={setPassword}
              disabled={loading}
              autoComplete="new-password"
              autoFocus
              invalid={tooShort}
              describedBy="password-rules"
            />
            <p id="password-rules" className="text-xs text-text-tertiary">
              {tooShort
                ? "Use at least 8 characters."
                : "At least 8 characters. A passphrase is easier to remember than a short scramble."}
            </p>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="confirm-password"
              className="text-[13px] font-medium text-text-secondary"
            >
              Confirm new password
            </label>
            <PasswordField
              value={confirm}
              onChange={setConfirm}
              disabled={loading}
              autoComplete="new-password"
              invalid={mismatch}
            />
            {mismatch && (
              <p className="text-xs text-destructive" role="alert">
                The two passwords do not match.
              </p>
            )}
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
            {loading ? "Saving..." : "Set new password"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
