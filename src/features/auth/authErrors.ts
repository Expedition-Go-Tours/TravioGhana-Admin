import { AxiosError } from "axios";

/**
 * Turn any thrown auth error into fixed, user-safe copy.
 *
 * Raw API messages are never rendered: a 500 body can leak internals, and
 * "Invalid credentials" vs "account locked" tells an attacker which accounts
 * exist. Status codes decide the message; the server string is only used when
 * it is a short, specific validation message we deliberately accept below.
 */
export type AuthErrorKind =
  | "invalid"
  | "validation"
  | "locked"
  | "forbidden"
  | "network"
  | "unknown";

export interface AuthError {
  kind: AuthErrorKind;
  message: string;
  /** Second line, shown for errors where a next step exists. */
  hint?: string;
  /** True when retrying the same request can succeed. */
  retryable: boolean;
}

/** Validation strings we surface verbatim (client-side rules are the norm). */
const SAFE_MESSAGES = new Set([
  "Password must be at least 8 characters",
  "Token and password are required",
  "Please provide your email address",
]);

/**
 * 401s the backend sends on purpose: the credentials were not wrong, the
 * account simply cannot sign in this way. Collapsing them into "Email or
 * password is incorrect." leaves a Google-only user stuck on a password box
 * with no idea the button they need is right above it. Matched exactly, so an
 * arbitrary server string can never reach the screen.
 */
const SAFE_AUTH_MESSAGES: Record<string, { message: string; hint: string }> = {
  "This account uses social login. Please sign in with Google.": {
    message: "This account uses Google sign-in.",
    hint: "Use Continue with Google below — the password box cannot work for this account.",
  },
  "Password not set. Please use the forgot password option to create one.": {
    message: "This account has no password yet.",
    hint: "Use Forgot password? to set one, then sign in with it.",
  },
  "Account has been deactivated": {
    message: "This account has been deactivated.",
    hint: "Contact an administrator if you think this is a mistake.",
  },
};

function axiosStatus(err: unknown): number | undefined {
  if (err instanceof AxiosError) return err.response?.status;
  if (err && typeof err === "object" && "response" in err) {
    const response = (err as { response?: { status?: number } }).response;
    return typeof response?.status === "number" ? response.status : undefined;
  }
  return undefined;
}

function axiosMessage(err: unknown): string | undefined {
  if (err && typeof err === "object" && "response" in err) {
    const response = (err as { response?: { data?: { message?: unknown } } }).response;
    const message = response?.data?.message;
    return typeof message === "string" && message.length < 120 ? message : undefined;
  }
  return undefined;
}

export function mapAuthError(err: unknown): AuthError {
  const status = axiosStatus(err);

  // No HTTP response at all: offline, DNS, timeout, CORS, or a dropped socket.
  if (status === undefined) {
    return {
      kind: "network",
      message: "We can’t reach the server right now.",
      hint: "Check your connection and try again.",
      retryable: true,
    };
  }

  if (status === 400) {
    const serverMessage = axiosMessage(err);
    if (serverMessage && SAFE_MESSAGES.has(serverMessage)) {
      return { kind: "validation", message: serverMessage, retryable: false };
    }
    return {
      kind: "validation",
      message: "Check the details you entered and try again.",
      retryable: false,
    };
  }

  if (status === 401) {
    // Provider mismatch is the one case where the generic message is a dead
    // end: the password box cannot work and the button that does is on the
    // page. Everything else stays ambiguous — never say which of the two
    // credentials was wrong.
    const serverMessage = axiosMessage(err);
    const mapped = serverMessage ? SAFE_AUTH_MESSAGES[serverMessage] : undefined;
    if (mapped) {
      return {
        kind: "invalid",
        message: mapped.message,
        hint: mapped.hint,
        retryable: false,
      };
    }
    return {
      kind: "invalid",
      message: "Email or password is incorrect.",
      retryable: false,
    };
  }

  if (status === 403) {
    return {
      kind: "forbidden",
      message: "You don’t have access to this console.",
      hint: "Contact an administrator if you think this is a mistake.",
      retryable: false,
    };
  }

  if (status === 423 || status === 429) {
    return {
      kind: "locked",
      message: "Too many attempts.",
      hint: "Wait a few minutes and try again, or contact an administrator.",
      retryable: true,
    };
  }

  return {
    kind: "network",
    message: "We can’t reach the server right now.",
    hint: "Check your connection and try again.",
    retryable: true,
  };
}
