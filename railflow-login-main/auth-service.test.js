/**
 * Temporary verification script for the RailFlow auth service.
 * Run with: bun auth-service.test.js
 */

// Force the development mock adapter regardless of shell env.
delete process.env.VITE_AUTH_API_URL;
globalThis.__RAILFLOW_MOCK_DELAY__ = 5;

// Minimal Web Storage shim (Bun has no localStorage by default).
class MemoryStorage {
  constructor() {
    this.map = new Map();
  }
  getItem(key) {
    return this.map.has(String(key)) ? this.map.get(String(key)) : null;
  }
  setItem(key, value) {
    this.map.set(String(key), String(value));
  }
  removeItem(key) {
    this.map.delete(String(key));
  }
  clear() {
    this.map.clear();
  }
}
globalThis.localStorage = new MemoryStorage();
globalThis.sessionStorage = new MemoryStorage();

const failures = [];
function check(name, ok, extra = "") {
  if (!ok) failures.push(`${name} ${extra}`);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && extra ? ` — ${extra}` : ""}`);
}
async function expectError(name, promise, matcher) {
  try {
    await promise;
    check(name, false, "expected an error but the call succeeded");
    return null;
  } catch (error) {
    const ok = matcher(error);
    check(name, ok, `got: [${error?.code}] ${error?.message}`);
    return error;
  }
}

const authService = await import("./src/services/authService.js");
const { scorePassword } = await import("./src/lib/passwordStrength.js");
const { safeReturnTo } = await import("./src/lib/validation.js");

const EMAIL = `op${Date.now()}@railflow.dev`;
const PASSWORD = "Signal-Desk-2026";

check("adapter mode is mock", authService.adapterMode === "mock", authService.adapterMode);

/* ------------------------------ register ------------------------------ */
await expectError(
  "register rejects weak password with field error",
  authService.register({ name: "Ops", email: EMAIL, password: "short" }),
  (e) => e.code === "VALIDATION_ERROR" && Boolean(e.fieldErrors?.password),
);
await expectError(
  "register rejects invalid email",
  authService.register({ name: "Ops", email: "not-an-email", password: PASSWORD }),
  (e) => Boolean(e.fieldErrors?.email),
);

const reg = await authService.register({
  name: "Ops Controller",
  email: EMAIL,
  password: PASSWORD,
});
check("register succeeds and requires verification", reg.requiresVerification === true);
check("register returns 6-digit dev code", /^\d{6}$/.test(reg.dev?.code ?? ""), JSON.stringify(reg.dev));
check("registered user is unverified", reg.user.verified === false);

const dbRaw = globalThis.localStorage.getItem("railflow.mock.db") || "";
check("password never stored in plain text", !dbRaw.includes(PASSWORD));
check("raw password hash not trivially visible", dbRaw.includes('"hash"') && !dbRaw.includes(`"${PASSWORD}"`));

await expectError(
  "register rejects duplicate email",
  authService.register({ name: "Ops", email: EMAIL, password: PASSWORD }),
  (e) => e.code === "EMAIL_TAKEN",
);

/* -------------------------------- login -------------------------------- */
await expectError(
  "login with wrong password fails",
  authService.login({ email: EMAIL, password: "wrong-pass-999" }),
  (e) => e.code === "INVALID_CREDENTIALS" && e.status === 401,
);
await expectError(
  "login before verification is blocked",
  authService.login({ email: EMAIL, password: PASSWORD }),
  (e) => e.code === "EMAIL_NOT_VERIFIED",
);

/* --------------------------- email verification ------------------------ */
await expectError(
  "verify rejects wrong code",
  authService.verifyEmail({ email: EMAIL, code: "000000" }),
  (e) => e.code === "INVALID_CODE" && e.status === 400,
);

const verify = await authService.verifyEmail({ email: EMAIL, code: reg.dev.code });
check("verify succeeds with issued code", verify.user?.verified === true);
await expectError(
  "code cannot be reused",
  authService.verifyEmail({ email: EMAIL, code: reg.dev.code }),
  (e) => e.code === "ALREADY_VERIFIED" || e.code === "CODE_NOT_FOUND",
);

/* ------------------------------- resend -------------------------------- */
const pendingEmail = `pending${Date.now()}@railflow.dev`;
await authService.register({ name: "Pending Person", email: pendingEmail, password: PASSWORD });
await expectError(
  "resend is rate-limited right after sign-up (429)",
  authService.resendVerification({ email: pendingEmail }),
  (e) => e.code === "RATE_LIMITED" && e.status === 429 && Number(e.retryAfter) > 0,
);
// Simulate the cooldown elapsing, then confirm a real resend works.
{
  const db = JSON.parse(globalThis.localStorage.getItem("railflow.mock.db"));
  db.resendAt[pendingEmail] = 0;
  globalThis.localStorage.setItem("railflow.mock.db", JSON.stringify(db));
}
const resend = await authService.resendVerification({ email: pendingEmail });
check("resend issues a new code after cooldown", /^\d{6}$/.test(resend.dev?.code ?? ""));
await expectError(
  "second resend respects cooldown (429)",
  authService.resendVerification({ email: pendingEmail }),
  (e) => e.code === "RATE_LIMITED" && e.status === 429 && Number(e.retryAfter) > 0,
);

/* ---------------------------- session lifecycle ------------------------ */
check("no session before login", (await authService.getSession()) === null);

const loginMem = await authService.login({ email: EMAIL, password: PASSWORD, remember: false });
check("login returns token + user", Boolean(loginMem.token) && loginMem.user.email === EMAIL);
check("session token stored in sessionStorage (remember=false)",
  (globalThis.sessionStorage.getItem("railflow.auth.token") || "") === loginMem.token,
);
const sessionUser = await authService.getSession();
check("getSession restores the user", sessionUser?.email === EMAIL);

const out = await authService.logout();
check("logout confirmed by server", out.serverConfirmed === true);
check("logout clears the token", (await authService.getSession()) === null);

const loginRem = await authService.login({ email: EMAIL, password: PASSWORD, remember: true });
check("remember=true stores token in localStorage",
  (globalThis.localStorage.getItem("railflow.auth.token") || "") === loginRem.token,
);
check("remember flag persisted", globalThis.localStorage.getItem("railflow.auth.remember") === "1");

// Bogus token → 401 and cleared.
globalThis.localStorage.setItem("railflow.auth.token", "rt_bogus");
check("bogus token → no session", (await authService.getSession()) === null);
check("bogus token cleared from storage", globalThis.localStorage.getItem("railflow.auth.token") === null);

/* --------------------------- forgot / reset ---------------------------- */
const forgotUnknown = await authService.forgotPassword({ email: "ghost@railflow.dev" });
check("forgot-password does not disclose accounts",
  forgotUnknown.message.includes("If an account exists") && !forgotUnknown.dev,
);

const forgot = await authService.forgotPassword({ email: EMAIL });
check("forgot-password issues token for existing account", Boolean(forgot.dev?.token));

await expectError(
  "reset with invalid token fails",
  authService.resetPassword({ token: "rst_nope", password: "NewPass-2026!" }),
  (e) => e.code === "RESET_TOKEN_INVALID",
);
await expectError(
  "reset validates password length",
  authService.resetPassword({ token: forgot.dev.token, password: "short" }),
  (e) => Boolean(e.fieldErrors?.password),
);

// Active session before reset → must be invalidated.
await authService.login({ email: EMAIL, password: PASSWORD, remember: true });
const reset = await authService.resetPassword({ token: forgot.dev.token, password: "NewPass-2026!" });
check("reset succeeds", reset.message.toLowerCase().includes("password updated"));
check("old session invalidated after reset", (await authService.getSession()) === null);
await expectError(
  "old password no longer works after reset",
  authService.login({ email: EMAIL, password: PASSWORD }),
  (e) => e.code === "INVALID_CREDENTIALS",
);
const relogin = await authService.login({ email: EMAIL, password: "NewPass-2026!" });
check("new password works after reset", Boolean(relogin.token));
await authService.logout();

// Expired reset token.
const forgot2 = await authService.forgotPassword({ email: EMAIL });
{
  const raw = globalThis.localStorage.getItem("railflow.mock.db");
  const db = JSON.parse(raw);
  db.resets[forgot2.dev.token].expiresAt = Date.now() - 1000;
  globalThis.localStorage.setItem("railflow.mock.db", JSON.stringify(db));
}
const inspectBad = await authService.inspectResetToken(forgot2.dev.token);
check("inspectResetToken flags expired", inspectBad?.valid === false && inspectBad?.reason === "expired");
await expectError(
  "expired reset token fails with 410",
  authService.resetPassword({ token: forgot2.dev.token, password: "Another-2026!" }),
  (e) => e.code === "RESET_TOKEN_EXPIRED" && e.status === 410,
);

/* ---------------------------- demo credentials -------------------------- */
const demo = await authService.login({
  email: "controller@railflow.dev",
  password: "railflow123",
  remember: false,
});
check("seeded demo account can sign in", demo.user?.email === "controller@railflow.dev");
await authService.logout();

/* -------------------------- unit: strength + safety --------------------- */
const weak = scorePassword("123456");
const strong = scorePassword("Signal-Desk-2026!");
check("strength: weak < strong", weak.score < strong.score, `${weak.score} vs ${strong.score}`);
check("strength: strong scores 4", strong.score === 4, String(strong.score));
check("strength: common password capped", scorePassword("password").score <= 1);
check("strength: empty state", scorePassword("").tone === "empty");

check("safeReturnTo keeps local paths", safeReturnTo("/dashboard?x=1") === "/dashboard?x=1");
check("safeReturnTo blocks protocol-relative URLs", safeReturnTo("//evil.com") === "/dashboard");
check("safeReturnTo blocks backslash tricks", safeReturnTo("/\\evil.com") === "/dashboard");
check("safeReturnTo handles null", safeReturnTo(null) === "/dashboard");

if (failures.length) {
  console.error(`\n${failures.length} check(s) FAILED:`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log("\nAll auth service checks passed.");
