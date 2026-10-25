const GHANA_API_BASE = "https://api.travioghana.com/api";
const GHANA_DOMAIN = "travioghana.com";
const TRAVIO_AFRICA_DOMAIN = "travioafrica.com";

function normaliseBase(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function hostnameOf(value: string): string | null {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isDomain(hostname: string, domain: string): boolean {
  const host = hostname.toLowerCase();
  return host === domain || host.endsWith(`.${domain}`);
}

/**
 * Resolve the API origin for the Ghana admin.
 *
 * The Ghana dashboard must talk to the Ghana API host. A build that points at
 * `apiv1.travioafrica.com` still reaches the shared backend, but its auth
 * cookie is cross-site and on a different registrable domain from the Ghana
 * Google callback (`api.travioghana.com`), so Chrome drops it and every
 * request returns 401 immediately after sign-in.
 *
 * A configured Ghana/localhost URL is honoured. A TravioAfrica host is always
 * replaced, even on preview deployments, because this app is Ghana-scoped.
 */
export function resolveApiBase(
  configured: string | undefined = import.meta.env.VITE_API_URL,
  hostname: string = typeof window !== "undefined" ? window.location.hostname : "",
): string {
  const value = normaliseBase(configured || "");
  const configuredHost = hostnameOf(value);
  const onGhanaHost = isDomain(hostname, GHANA_DOMAIN);

  if (configuredHost && isDomain(configuredHost, TRAVIO_AFRICA_DOMAIN)) {
    return GHANA_API_BASE;
  }

  // No API URL at all: production Ghana pages must still reach the Ghana API.
  // Local development keeps Vite's /api proxy.
  if (onGhanaHost && !configuredHost) {
    return GHANA_API_BASE;
  }

  return value || "/api";
}

export const API_BASE_URL = resolveApiBase();
