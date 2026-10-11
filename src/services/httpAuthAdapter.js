import { AuthError } from "./authError.js";

/**
 * PRODUCTION adapter — talks to the real RailFlow REST backend.
 *
 * Base URL comes exclusively from the VITE_AUTH_API_URL environment variable
 * (never hardcoded, never committed). Endpoints (TO BE CONFIRMED WITH THE
 * BACKEND OWNER before going live):
 *
 *   POST /api/auth/register
 *   POST /api/auth/login
 *   POST /api/auth/forgot-password
 *   POST /api/auth/reset-password
 *   POST /api/auth/verify-email
 *   POST /api/auth/resend-verification
 *   GET  /api/auth/me
 *   POST /api/auth/logout
 *
 * Session handling: `credentials: "include"` so the server can issue secure
 * httpOnly cookies where supported; a bearer token from the login response is
 * also forwarded when present. Success is only reported when the server
 * actually answers with a 2xx status.
 */

const BASE_URL = String(import.meta.env.VITE_AUTH_API_URL || "").replace(
  /\/+$/,
  "",
);
const TIMEOUT_MS = 10000;

export function isConfigured() {
  return BASE_URL.length > 0;
}

async function request(path, { method = "POST", body = null, token = null } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (cause) {
    const timedOut = cause?.name === "AbortError";
    throw new AuthError(
      timedOut
        ? "The authentication server took too long to respond. Please try again."
        : "Can't reach the authentication server. Check your connection and try again.",
      {
        status: 0,
        code: timedOut ? "TIMEOUT" : "NETWORK_ERROR",
      },
    );
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const payload = data?.error || data || {};
    const retryHeader = response.headers?.get?.("Retry-After");
    throw new AuthError(
      payload.message || `Request failed (HTTP ${response.status}).`,
      {
        status: response.status,
        code: payload.code || `HTTP_${response.status}`,
        fieldErrors: payload.fields || null,
        retryAfter: payload.retryAfter ?? (retryHeader ? Number(retryHeader) : null),
      },
    );
  }

  return data ?? {};
}

export const httpAdapter = {
  mode: "http",
  register: (input) => request("/api/auth/register", { body: input }),
  login: (input) => request("/api/auth/login", { body: input }),
  me: ({ token }) => request("/api/auth/me", { method: "GET", token }),
  logout: ({ token }) => request("/api/auth/logout", { body: {}, token }),
  verifyEmail: (input) => request("/api/auth/verify-email", { body: input }),
  resendVerification: (input) =>
    request("/api/auth/resend-verification", { body: input }),
  forgotPassword: (input) => request("/api/auth/forgot-password", { body: input }),
  resetPassword: (input) => request("/api/auth/reset-password", { body: input }),
};
