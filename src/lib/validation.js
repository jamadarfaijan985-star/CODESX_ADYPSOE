/** Shared client-side validation for RailFlow auth forms. */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(value) {
  const clean = String(value ?? "").trim();
  if (!clean) return "Email is required.";
  if (!EMAIL_RE.test(clean)) return "Enter a valid email address.";
  return "";
}

export function validateLoginPassword(value) {
  return String(value ?? "") ? "" : "Password is required.";
}

export function validateNewPassword(value) {
  if (!value) return "Choose a password.";
  if (value.length < 8) return "Use at least 8 characters.";
  return "";
}

export function validateName(value) {
  const clean = String(value ?? "").trim();
  if (!clean) return "Full name is required.";
  if (clean.length < 2) return "Enter at least 2 characters.";
  return "";
}

export function validateMatch(password, confirmation) {
  return password === confirmation ? "" : "Passwords do not match.";
}

export function hasErrors(errors) {
  return Object.values(errors).some(Boolean);
}

/**
 * Keeps post-login redirects on-site (blocks `//evil.com` style targets).
 */
export function safeReturnTo(value, fallback = "/dashboard") {
  if (typeof value !== "string" || !value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  return value;
}
