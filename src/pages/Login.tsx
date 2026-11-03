import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleOAuthProvider, useGoogleOneTapLogin } from "@react-oauth/google";
import { useAuth } from "@/auth/useAuth";
import { getDefaultRoute } from "@/lib/permissions";
import AuthShell from "@/features/auth/AuthShell";
import PasswordField from "@/features/auth/PasswordField";
import { mapAuthError, type AuthError } from "@/features/auth/authErrors";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

function OneTapHandler({ onSuccess }: { onSuccess: () => void }) {
  const { loginWithGoogleOneTap } = useAuth();

  useGoogleOneTapLogin({
    onSuccess: async (credentialResponse) => {
      const credential = credentialResponse.credential;
      if (!credential) return;
      try {
        const ok = await loginWithGoogleOneTap(credential);
        if (ok) onSuccess();
      } catch {
        // Silent — the form below is the reliable path and shows its own error.
      }
    },
    onError: () => {},
    // Dismissible: an admin sign-in must never trap a third-party prompt over
    // the form.
    cancel_on_tap_outside: true,
  });

  return null;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, loginWithGoogle, isAuthenticated } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const sessionExpired = searchParams.get("reason") === "expired";

  useEffect(() => {
    if (isAuthenticated) {
      navigate(getDefaultRoute(), { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Move focus to the message so a failed sign-in is announced and reachable
  // without re-reading the whole form.
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const handleSuccess = useCallback(
    () => navigate(getDefaultRoute(), { replace: true }),
    [navigate],
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email.trim().toLowerCase(), password);
      handleSuccess();
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <OneTapHandler onSuccess={handleSuccess} />
      <AuthShell
        title="Sign in to the admin console"
        subtitle="Use your Travio Ghana staff account."
        footer={
          <>
            Authorized access only. All activity is logged.
            <br />
            <a
              href="https://www.travioghana.com"
              className="font-medium text-primary transition-colors hover:text-primary/80"
            >
              travioghana.com
            </a>
          </>
        }
      >
        {sessionExpired && (
          <div
            className="mb-4 rounded-xl border border-warning/30 bg-warning/10 px-3.5 py-2.5 text-sm text-warning"
            role="status"
          >
            Your session expired. Sign in to continue.
          </div>
        )}

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
              autoFocus
              spellCheck={false}
              autoCapitalize="none"
              inputMode="email"
              className="h-11"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-[13px] font-medium text-text-secondary">
                Password
              </Label>
              <Link
                to="/admin/forgot-password"
                className="text-xs font-medium text-primary transition-colors hover:text-primary/80"
              >
                Forgot password?
              </Link>
            </div>
            <PasswordField
              value={password}
              onChange={setPassword}
              disabled={loading}
              describedBy={error ? "login-error" : undefined}
            />
          </div>

          {error && (
            <div
              ref={errorRef}
              id="login-error"
              tabIndex={-1}
              role="alert"
              className="rounded-xl border border-destructive/20 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive outline-none"
            >
              {error.message}
              {error.hint && <p className="mt-0.5 text-xs text-destructive/80">{error.hint}</p>}
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            className="h-11 w-full"
            disabled={loading}
            aria-busy={loading}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <div className="my-6 flex items-center gap-4">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[11px] font-medium tracking-[0.08em] text-text-tertiary">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <button
          type="button"
          onClick={() => void loginWithGoogle()}
          disabled={loading}
          className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-input bg-surface-base px-4 text-sm font-medium text-text-primary transition-colors hover:border-text-tertiary hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Continue with Google
        </button>
      </AuthShell>
    </GoogleOAuthProvider>
  );
}
