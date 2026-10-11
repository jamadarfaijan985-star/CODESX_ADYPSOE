/**
 * Temporary SSR smoke test: renders every screen and checks key content.
 * Run with: bun auth-ui.smoke.jsx
 */
import { renderToString } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router";

delete process.env.VITE_AUTH_API_URL;
globalThis.__RAILFLOW_MOCK_DELAY__ = 5;

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
  if (!ok) failures.push(name);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && extra ? ` — ${extra}` : ""}`);
}
function contains(html, needle) {
  return html.includes(needle);
}

const { AuthProvider } = await import("./src/auth/AuthContext.jsx");
const AuthLayout = (await import("./src/components/auth/AuthLayout.jsx")).default;
const Login = (await import("./src/pages/auth/Login.jsx")).default;
const Signup = (await import("./src/pages/auth/Signup.jsx")).default;
const ForgotPassword = (await import("./src/pages/auth/ForgotPassword.jsx")).default;
const ResetPassword = (await import("./src/pages/auth/ResetPassword.jsx")).default;
const VerifyEmail = (await import("./src/pages/auth/VerifyEmail.jsx")).default;
const Dashboard = (await import("./src/pages/Dashboard.jsx")).default;
const Profile = (await import("./src/pages/Profile.jsx")).default;
const Settings = (await import("./src/pages/Settings.jsx")).default;
const App = (await import("./src/App.jsx")).default;

/** Render a screen inside the shared auth shell (as the real router does). */
function renderAuthScreen(path, page, state = null) {
  return renderToString(
    <AuthProvider>
      <MemoryRouter initialEntries={[{ pathname: path, state }]}>
        <Routes>
          <Route element={<AuthLayout />}>
            <Route path={path} element={page} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

function renderStandalone(path, element) {
  return renderToString(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={path} element={element} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

/* ------------------------------- Login ---------------------------------- */
const login = renderAuthScreen("/login", <Login />);
check("login: shell + statusbar present", contains(login, "rf-screen") && contains(login, "Dev mock adapter"));
check("login: heading", contains(login, "Welcome back"));
check("login: email + password fields", contains(login, 'id="login-email"') && contains(login, 'id="login-password"'));
check("login: remember me + forgot link", contains(login, "Remember me") && contains(login, "Forgot password?"));
check("login: create account link", contains(login, 'href="/signup"'));
check("login: submit button", contains(login, "Sign in"));
check("login: demo credentials note", contains(login, "controller@railflow.dev"));
check("login: glass card class", contains(login, "rf-glass"));

/* ------------------------------- Signup --------------------------------- */
const signup = renderAuthScreen("/signup", <Signup />);
check("signup: heading", contains(signup, "Create your account"));
check("signup: all fields", ["Full name", "Confirm password", "Terms of Service"].every((t) => contains(signup, t)));
check("signup: strength meter mounted", contains(signup, "rf-strength"));
check("signup: terms disclosure", contains(signup, "Read terms summary"));
check("signup: submit + back link", contains(signup, "Create account") && contains(signup, 'href="/login"'));

/* --------------------------- Forgot password ---------------------------- */
const forgot = renderAuthScreen("/forgot-password", <ForgotPassword />);
check("forgot: heading + submit", contains(forgot, "Reset your password") && contains(forgot, "Send reset link"));
check("forgot: back to login", contains(forgot, "Back to login"));

/* --------------------------- Reset password ----------------------------- */
const resetMissing = renderAuthScreen("/reset-password", <ResetPassword />);
check("reset: missing token panel", contains(resetMissing, "Link problem") && contains(resetMissing, "Request a new link"));

const resetChecking = renderAuthScreen(
  "/reset-password",
  <ResetPassword />,
  null,
);
// With a token present but effects skipped in SSR, the mock path renders the
// token-validation loader — proving the checking state exists.
const resetWithToken = renderToString(
  <AuthProvider>
    <MemoryRouter initialEntries={["/reset-password?token=rst_demo"]}>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/reset-password" element={<ResetPassword />} />
        </Route>
      </Routes>
    </MemoryRouter>
  </AuthProvider>,
);
check("reset: token validation loader", contains(resetWithToken, "Validating reset token"));

/* --------------------------- Verify email -------------------------------- */
const verify = renderAuthScreen(
  "/verify-email",
  <VerifyEmail />,
  { email: "new@railflow.dev", devCode: "123456", startCooldown: true },
);
check("verify: heading + email echo", contains(verify, "Verify your email") && contains(verify, "new@railflow.dev"));
check("verify: six OTP slots", (verify.match(/rf-otp__slot/g) || []).length === 6);
check("verify: submit button", contains(verify, "Verify email"));
check("verify: cooldown after signup", contains(verify, "Resend code in 30s"));
check("verify: mock code surfaced", contains(verify, "123456"));
check("verify: back to login", contains(verify, "Back to login"));

const verifyMissing = renderAuthScreen("/verify-email", <VerifyEmail />);
check("verify: missing email panel", contains(verifyMissing, "Code unavailable"));

/* ------------------------- App-level route guards ------------------------ */
const gateAtLogin = renderToString(
  <AuthProvider>
    <MemoryRouter initialEntries={["/login"]}>
      <App />
    </MemoryRouter>
  </AuthProvider>,
);
check("app: session loader while restoring", contains(gateAtLogin, "Restoring session"));

const notFound = renderToString(
  <AuthProvider>
    <MemoryRouter initialEntries={["/no-such-route"]}>
      <App />
    </MemoryRouter>
  </AuthProvider>,
);
check("app: 404 route with back link", contains(notFound, "404") && contains(notFound, "Back to RailFlow"));

/* --------------------------- Protected pages ----------------------------- */
const dashboard = renderStandalone("/dashboard", <Dashboard />);
check("dashboard: heading + panels", contains(dashboard, "Operations Overview") && contains(dashboard, "P-01 · Platform allocation"));
check("dashboard: account menu button", contains(dashboard, 'aria-label="Account menu"'));
check("dashboard: nav + logout in menu", contains(dashboard, "rf-nav"));

const profile = renderStandalone("/profile", <Profile />);
check("profile: heading + details", contains(profile, "Account Profile") && contains(profile, "Account ID"));
check("profile: settings + logout actions", contains(profile, "Account Settings") && contains(profile, "Logout"));

const settings = renderStandalone("/settings", <Settings />);
check("settings: heading", contains(settings, "Account Settings"));
check("settings: working preferences", contains(settings, "Reduce motion") && contains(settings, "Remember me by default"));
check("settings: logout action", contains(settings, "Sign out of this device"));

if (failures.length) {
  console.error(`\n${failures.length} check(s) FAILED:`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log("\nAll UI smoke checks passed.");
