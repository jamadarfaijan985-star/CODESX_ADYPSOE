/**
 * Local UI preferences (stored on this device only — never sent anywhere).
 *   • reduceMotion    — accessibility override for all decorative animation
 *   • rememberDefault — default state of the "Remember me" checkbox
 */

const KEY = "railflow.prefs";
const EVENT = "railflow:prefs";
const DEFAULTS = { reduceMotion: false, rememberDefault: true };

export function getPrefs() {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    return { ...DEFAULTS, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function getPref(key) {
  return getPrefs()[key];
}

function applyMotionClass(value) {
  try {
    globalThis.document?.documentElement.classList.toggle(
      "rf-reduce-motion",
      Boolean(value),
    );
  } catch {
    /* no DOM (service tests) */
  }
}

export function setPref(key, value) {
  const next = { ...getPrefs(), [key]: value };
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
  if (key === "reduceMotion") applyMotionClass(value);
  try {
    globalThis.window?.dispatchEvent(
      new CustomEvent(EVENT, { detail: { key, value } }),
    );
  } catch {
    /* no window */
  }
  return next[key];
}

/** Apply persisted preferences on boot (called by the app shell). */
export function applyPrefs() {
  applyMotionClass(getPref("reduceMotion"));
}

export const PREFS_EVENT = EVENT;
