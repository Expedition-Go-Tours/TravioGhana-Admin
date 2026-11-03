import { describe, expect, it } from "vitest";
import { AxiosError } from "axios";
import { mapAuthError } from "@/features/auth/authErrors";

/** Shape helpers: the mapper accepts axios errors and plain error objects. */
const httpError = (status: number, message?: string) =>
  new AxiosError("request failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    statusText: "",
    headers: {},
    config: {},
    data: message ? { message } : {},
  } as never);

const networkError = () => new AxiosError("Network Error", "ERR_NETWORK");

describe("mapAuthError", () => {
  it("treats a missing response as a network failure", () => {
    const mapped = mapAuthError(networkError());
    expect(mapped.kind).toBe("network");
    expect(mapped.retryable).toBe(true);
    expect(mapped.message).toBe("We can’t reach the server right now.");
    expect(mapped.hint).toBe("Check your connection and try again.");
  });

  it("never says which credential was wrong", () => {
    const mapped = mapAuthError(httpError(401, "Invalid credentials"));
    expect(mapped.kind).toBe("invalid");
    expect(mapped.message).toBe("Email or password is incorrect.");
    // Ambiguous on purpose: nothing that says the account exists or that the
    // password alone was wrong.
    expect(mapped.message).not.toMatch(/no account|not found|unknown email|wrong password/i);
    expect(mapped.hint).toBeUndefined();
    expect(mapped.retryable).toBe(false);
  });

  it("keeps short, known validation messages", () => {
    const mapped = mapAuthError(httpError(400, "Password must be at least 8 characters"));
    expect(mapped.kind).toBe("validation");
    expect(mapped.message).toBe("Password must be at least 8 characters");
    expect(mapped.retryable).toBe(false);
  });

  it("does not surface unknown server strings", () => {
    const mapped = mapAuthError(
      httpError(400, "Prisma error: connection pool exhausted at /api/v1/users"),
    );
    expect(mapped.kind).toBe("validation");
    expect(mapped.message).toBe("Check the details you entered and try again.");
    expect(mapped.message).not.toMatch(/Prisma/i);
  });

  it("maps rate limiting to a wait-and-retry message", () => {
    for (const status of [423, 429]) {
      const mapped = mapAuthError(httpError(status, "Too many login attempts"));
      expect(mapped.kind).toBe("locked");
      expect(mapped.retryable).toBe(true);
      expect(mapped.hint).toMatch(/try again/i);
      expect(mapped.message).not.toMatch(/login attempts/i);
    }
  });

  it("tells a 403 user who to contact", () => {
    const mapped = mapAuthError(httpError(403, "Admin role required"));
    expect(mapped.kind).toBe("forbidden");
    expect(mapped.hint).toContain("administrator");
    expect(mapped.retryable).toBe(false);
  });

  it("treats 5xx as a reachability problem", () => {
    for (const status of [500, 502, 503]) {
      const mapped = mapAuthError(httpError(status, "Internal server error at /auth/login"));
      expect(mapped.kind).toBe("network");
      expect(mapped.retryable).toBe(true);
      expect(mapped.message).not.toMatch(/Internal/i);
    }
  });

  it("handles a thrown non-axios value", () => {
    expect(mapAuthError(new Error("boom")).kind).toBe("network");
    expect(mapAuthError(null).kind).toBe("network");
    expect(mapAuthError("nope").kind).toBe("network");
  });
});
