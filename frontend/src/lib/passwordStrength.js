/**
 * Real-time password strength scoring (0–4) with tone + improvement hints.
 * Used by the sign-up and reset-password strength meters.
 */

const COMMON_PATTERNS = [
  /^password/i,
  /^passw0rd/i,
  /^123456/,
  /^qwerty/i,
  /^letmein/i,
  /^admin/i,
  /^welcome/i,
  /^railflow/i,
  /^iloveyou/i,
];

const LABELS = ["Very weak", "Weak", "Fair", "Good", "Strong"];
const TONES = ["bad", "bad", "warn", "good", "great"];

export function scorePassword(password) {
  if (!password) {
    return { score: 0, percent: 0, label: "", tone: "empty", hints: [] };
  }

  let points = 0;
  if (password.length >= 8) points += 1;
  if (password.length >= 12) points += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) points += 1;
  if (/\d/.test(password)) points += 1;
  if (/[^\w\s]/.test(password)) points += 1;

  let score = Math.max(0, Math.min(4, points));

  if (COMMON_PATTERNS.some((pattern) => pattern.test(password))) {
    score = Math.min(score, 1);
  }

  const hints = [];
  if (password.length < 12) hints.push("Make it longer (12+ characters)");
  if (!/\d/.test(password)) hints.push("Add a number");
  if (!/[^\w\s]/.test(password)) hints.push("Add a symbol");
  if (!(/[a-z]/.test(password) && /[A-Z]/.test(password))) {
    hints.push("Mix upper and lower case");
  }
  if (COMMON_PATTERNS.some((pattern) => pattern.test(password))) {
    hints.push("Avoid common words");
  }

  return {
    score,
    percent: score * 25,
    label: LABELS[score],
    tone: TONES[score],
    hints: hints.slice(0, 2),
  };
}
