import { io, Socket } from "socket.io-client";

const SOCKET_URL = (() => {
  const url = import.meta.env.VITE_API_URL;
  if (!url) return "";
  try { return new URL(url).origin; } catch { return ""; }
})();
const ADMIN_NOTIFICATION_EVENT = "admin-notification";

let socket: Socket | null = null;

function readAccessToken(): string | undefined {
  // Access tokens are stored in an httpOnly cookie (not readable from JS), so
  // the socket falls back to the cookie-based handshake. When the backend
  // exposes a token we pass it explicitly; otherwise we rely on the cookie
  // being sent via `withCredentials`.
  return undefined;
}

export function getAdminSocket(): Socket {
  if (!socket) {
    const token = readAccessToken();
    socket = io(SOCKET_URL, {
      withCredentials: true,
      auth: token ? { role: "admin", token } : { role: "admin" },
      transports: ["websocket", "polling"],
      reconnection: typeof navigator !== "undefined" ? navigator.onLine !== false : true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 3000,
      reconnectionDelayMax: 15000,
      randomizationFactor: 0.5,
    });

    // Pause/resume reconnection based on connectivity so a suspended tab or a
    // dropped network doesn't hammer the server.
    if (typeof window !== "undefined") {
      const online = () => socket?.connect();
      const offline = () => socket?.disconnect();
      window.addEventListener("online", online);
      window.addEventListener("offline", offline);
      // Register listeners on the socket wrapper so they can be cleaned up.
      (socket as Socket & { __cleanup?: () => void }).__cleanup = () => {
        window.removeEventListener("online", online);
        window.removeEventListener("offline", offline);
      };
    }
  }
  return socket;
}

export function disconnectAdminSocket(): void {
  if (socket) {
    const cleanup = (socket as Socket & { __cleanup?: () => void }).__cleanup;
    cleanup?.();
    socket.disconnect();
    socket = null;
  }
}

export function onAdminNotification(callback: (notification: Record<string, unknown>) => void): () => void {
  const s = getAdminSocket();
  s.on(ADMIN_NOTIFICATION_EVENT, callback);
  return () => {
    s.off(ADMIN_NOTIFICATION_EVENT, callback);
  };
}

export function onAdminSocketConnect(callback: () => void): () => void {
  const s = getAdminSocket();
  s.on("connect", callback);
  return () => {
    s.off("connect", callback);
  };
}

export function onAdminSocketAuthExpired(callback: () => void): () => void {
  const s = getAdminSocket();
  s.on("auth:expired", callback);
  return () => {
    s.off("auth:expired", callback);
  };
}
