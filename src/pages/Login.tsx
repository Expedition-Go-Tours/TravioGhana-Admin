import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleOAuthProvider, useGoogleOneTapLogin } from "@react-oauth/google";
import { useAuth } from "@/auth/useAuth";
import { getDefaultRoute } from "@/lib/permissions";
import travioWordmark from "@/assets/travio-ghana-wordmark.png";
import travioWordmarkDark from "@/assets/travio-ghana-wordmark-on-dark.png";

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
        // Silent — the login page surfaces its own error state.
      }
    },
    onError: () => {},
    cancel_on_tap_outside: false,
  });

  return null;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, loginWithGoogle, isAuthenticated } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      navigate(getDefaultRoute(), { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSuccess = () => navigate(getDefaultRoute(), { replace: true });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const success = await login(email, password);
      if (success) handleSuccess();
    } catch (err: unknown) {
      if (err && typeof err === "object" && "response" in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setError(axiosErr.response?.data?.message || "Invalid email or password");
      } else {
        setError("Unable to connect. Check your internet.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    await loginWithGoogle();
  };

  if (isAuthenticated) {
    return null;
  }

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <OneTapHandler onSuccess={handleSuccess} />
      <div className="flex min-h-[100dvh] items-center justify-center bg-surface-muted px-4 py-10">
        <div className="w-full max-w-[400px]">
          <div className="mb-6 flex justify-center">
            <img src={travioWordmark} alt="Travio Ghana" className="h-12 w-auto dark:hidden" />
            <img src={travioWordmarkDark} alt="" aria-hidden="true" className="hidden h-12 w-auto dark:block" />
          </div>

          <div className="rounded-xl border border-border bg-surface-base p-6 sm:p-8">
            <div className="mb-7 text-center">
              <h1 className="text-[26px] font-light leading-8 tracking-[-0.26px] text-text-primary">Welcome back</h1>
              <p className="mt-1 text-sm text-text-secondary">Sign in to your admin account</p>
            </div>

            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="flex h-11 w-full items-center justify-center gap-3 rounded-full border border-input bg-surface-base px-4 text-sm font-medium text-text-primary transition-colors hover:border-text-tertiary hover:bg-surface-muted disabled:opacity-50"
            >
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              {loading ? "Signing in..." : "Continue with Google"}
            </button>

            <div className="my-6 flex items-center gap-4">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[11px] font-medium tracking-[0.08em] text-text-tertiary">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>

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
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-[13px] font-medium text-text-secondary">
                    Password
                  </Label>
                  <button type="button" className="text-xs font-medium text-primary transition-colors hover:text-primary/80">
                    Forgot?
                  </button>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                  autoComplete="current-password"
                />
              </div>
              {error && (
                <div
                  className="rounded-xl border border-destructive/20 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive"
                  role="alert">
                  {error}
                </div>
              )}
              <Button type="submit" className="h-11 w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-text-tertiary">
            Travio Ghana Admin Portal &mdash; authorized access only
          </p>
        </div>
      </div>
    </GoogleOAuthProvider>
  );
}