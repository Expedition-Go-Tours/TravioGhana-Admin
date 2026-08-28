import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleOAuthProvider, useGoogleOneTapLogin } from "@react-oauth/google";
import { useAuth } from "@/auth/useAuth";
import { getDefaultRoute } from "@/lib/permissions";

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
      <div className="relative flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-green-100 via-green-50/50 to-green-950/15 p-4 overflow-hidden">
      <div className="noise-overlay" />
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
        className="relative w-full max-w-sm"
      >
        <div className="double-bezel">
          <div className="double-bezel-inner p-8">
            <div className="mb-8 flex flex-col items-center text-center">
              <h1 className="font-display text-xl font-semibold tracking-tight text-text-primary">Welcome back</h1>
              <p className="mt-1 text-sm text-text-secondary">Sign in to your admin account</p>
            </div>

            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="group flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-surface-base px-4 py-3 text-sm font-medium text-text-primary shadow-sm transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] hover:shadow-soft hover:border-border-muted active:scale-[0.98] disabled:opacity-50"
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
              <div className="flex-1 border-t border-border-muted" />
              <span className="text-xs font-medium text-text-tertiary">OR</span>
              <div className="flex-1 border-t border-border-muted" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
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
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Password
                  </Label>
                  <button type="button" className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">
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
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-destructive/20 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive"
                  role="alert"
                >
                  {error}
                </motion.div>
              )}
              <Button type="submit" className="w-full h-11" disabled={loading}>
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

            <p className="mt-8 text-center text-xs text-text-tertiary/60">
              Travio Ghana Admin Portal &mdash; Authorized access only
            </p>
          </div>
        </div>
      </motion.div>
    </div>
    </GoogleOAuthProvider>
  );
}
