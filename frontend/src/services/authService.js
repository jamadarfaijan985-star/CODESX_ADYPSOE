import { AuthError } from "./authError.js";
import { httpAdapter, isConfigured } from "./httpAuthAdapter.js";
import { mockAdapter } from "./mockAuthAdapter.js";

/**
 * Central authentication service.
 *
 * Exactly one adapter is active per build — they are never mixed:
 *   • VITE_AUTH_API_URL configured  → real REST backend (production)
 *   • otherwise                     → clearly labeled development mock
 */
const adapter = isConfigured() ? httpAdapter : mockAdapter;

export const adapterMode = adapter.mode; // "http" | "mock"
export const apiUrl = isConfigured() ? String(import.meta.env.VITE_AUTH_API_URL) : null;
export { AuthError };

const TOKEN_KEY = "railflow.auth.token";
const REMEMBER_KEY = "railflow.auth.remember";
const COOKIE_MARKER = "cookie-session";

function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

function isRemembered() {
  try {
    return globalThis.localStorage?.getItem(REMEMBER_KEY) === "1";
  } catch {
    return false;
  }
}

function clearToken() {
  try {
    globalThis.sessionStorage?.removeItem(TOKEN_KEY);
    globalThis.localStorage?.removeItem(TOKEN_KEY);
    globalThis.localStorage?.removeItem(REMEMBER_KEY);
  } catch {
    /* storage unavailable */
  }
}

function saveSession(token, remember) {
  clearToken();
  const value = token || COOKIE_MARKER;
  try {
    if (remember) {
      globalThis.localStorage?.setItem(REMEMBER_KEY, "1");
      globalThis.localStorage?.setItem(TOKEN_KEY, value);
    } else {
      globalThis.sessionStorage?.setItem(TOKEN_KEY, value);
    }
  } catch {
    /* storage unavailable — session lasts only for this page load */
  }
}

function currentToken() {
  try {
    const raw =
      globalThis.sessionStorage?.getItem(TOKEN_KEY) ||
      globalThis.localStorage?.getItem(TOKEN_KEY);
    if (!raw) return null;
    return raw === COOKIE_MARKER ? null : raw; // cookie sessions send no bearer
  } catch {
    return null;
  }
}

function hasSessionMarker() {
  try {
    return Boolean(
      globalThis.sessionStorage?.getItem(TOKEN_KEY) ||
        globalThis.localStorage?.getItem(TOKEN_KEY),
    );
  } catch {
    return false;
  }
}

/* --------------------------------- API ---------------------------------- */

export async function register({ name, email, password }) {
  return adapter.register({
    name: String(name ?? "").trim(),
    email: normalizeEmail(email),
    password: String(password ?? ""),
  });
}

export async function login({ email, password, remember = false }) {
  const result = await adapter.login({
    email: normalizeEmail(email),
    password: String(password ?? ""),
  });
  if (result?.user) {
    saveSession(result.token ?? null, remember);
  }
  return result;
}

export async function getSession() {
  if (!hasSessionMarker()) return null;
  const token = currentToken();
  try {
    const data = await adapter.me({ token });
    return data?.user ?? null;
  } catch (error) {
    if (error instanceof AuthError && (error.status === 401 || error.status === 403)) {
      clearToken();
      return null;
    }
    throw error;
  }
}

export async function logout() {
  const token = currentToken();
  let serverConfirmed = false;
  try {
    await adapter.logout({ token });
    serverConfirmed = true;
  } catch {
    /* server unreachable — the local session is still cleared below */
  }
  clearToken();
  return { serverConfirmed };
}

export async function verifyEmail({ email, code }) {
  return adapter.verifyEmail({ email: normalizeEmail(email), code });
}

export async function resendVerification({ email }) {
  return adapter.resendVerification({ email: normalizeEmail(email) });
}

export async function forgotPassword({ email }) {
  return adapter.forgotPassword({ email: normalizeEmail(email) });
}

export async function resetPassword({ token, password }) {
  return adapter.resetPassword({
    token: String(token ?? ""),
    password: String(password ?? ""),
  });
}

/** Optional early token check — supported by the dev mock only. */
export async function inspectResetToken(token) {
  if (typeof adapter.inspectResetToken !== "function") return null;
  try {
    return await adapter.inspectResetToken(String(token ?? ""));
  } catch {
    return null;
  }
}

export { isRemembered as isSessionRemembered };
