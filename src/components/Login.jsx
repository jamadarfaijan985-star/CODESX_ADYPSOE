import { useRef, useState } from "react";

const DEMO_USERNAME = "controller";
const DEMO_PASSWORD = "railflow123";
const VERIFY_DELAY_MS = 600;

const NO_ERRORS = { username: "", password: "", form: "" };

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState(NO_ERRORS);
  const [verifying, setVerifying] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const usernameRef = useRef(null);
  const passwordRef = useRef(null);

  const busy = verifying;

  function handleUsernameChange(event) {
    setUsername(event.target.value);
    setErrors((prev) => ({ ...prev, username: "", form: "" }));
  }

  function handlePasswordChange(event) {
    setPassword(event.target.value);
    setErrors((prev) => ({ ...prev, password: "", form: "" }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    // Guard: a second submit while verification is running is ignored.
    if (busy) return;

    const next = { username: "", password: "", form: "" };
    if (!username.trim()) next.username = "Username is required.";
    if (!password) next.password = "Password is required.";

    if (next.username || next.password) {
      setErrors(next);
      if (next.username) usernameRef.current?.focus();
      else passwordRef.current?.focus();
      return;
    }

    setErrors(NO_ERRORS);
    setVerifying(true);

    // Simulated local verification round-trip — no network requests.
    await wait(VERIFY_DELAY_MS);

    if (username.trim() === DEMO_USERNAME && password === DEMO_PASSWORD) {
      onLogin(DEMO_USERNAME);
      return;
    }

    setVerifying(false);
    setAttempts((count) => count + 1);
    setErrors({
      username: "",
      password: "",
      form: "Credentials rejected — check the username and password, then try again.",
    });
    setPassword("");
    // Focus after React re-enables the field (disabled while verifying).
    requestAnimationFrame(() => passwordRef.current?.focus());
  }

  return (
    <div className="rf-screen">
      <div className="rf-frame" aria-hidden="true" />

      <header className="rf-statusbar">
        <span>
          RailFlow <span className="rf-statusbar__sep">/</span> Ops Console
        </span>
        <span className="rf-statusbar__mid">
          <span className="rf-led" aria-hidden="true" />
          Link active
        </span>
        <span>Doc RF-SEC-001 · Rev 2.4</span>
      </header>

      <main className="rf-stage">
        <section className="rf-card" aria-labelledby="rf-title">
          <div className="rf-card__head">
            <div className="rf-brand">
              <span className="rf-logo" aria-hidden="true">
                <svg viewBox="0 0 32 32" focusable="false">
                  <g fill="none" strokeLinecap="round">
                    <path
                      d="M11.5 5.5 L9.7 26.5"
                      stroke="#ffb020"
                      strokeWidth="2.4"
                    />
                    <path
                      d="M20.5 5.5 L22.3 26.5"
                      stroke="#ffb020"
                      strokeWidth="2.4"
                    />
                    <path
                      d="M11.2 10 H20.8 M10.8 15.5 H21.2 M10.4 21 H21.6"
                      stroke="#dbe7fb"
                      strokeOpacity="0.55"
                      strokeWidth="1.6"
                    />
                  </g>
                  <circle cx="26.5" cy="6" r="3" fill="#3ddc97" />
                </svg>
              </span>
              <div>
                <h1 className="rf-wordmark" id="rf-title">
                  RAIL<span className="rf-wordmark__accent">FLOW</span>
                </h1>
                <p className="rf-sub">
                  Platform Allocation &amp; Disruption Management
                </p>
              </div>
            </div>
            <p className="rf-badge">Station: Central Junction</p>
          </div>

          <div className="rf-rule">
            <span>§ 01 — Operator sign-in</span>
          </div>

          <form className="rf-form" onSubmit={handleSubmit} noValidate>
            {errors.form ? (
              <p className="rf-alert" role="alert" key={attempts}>
                <span className="rf-alert__tag">Auth</span>
                {errors.form}
              </p>
            ) : null}

            <div className="rf-field">
              <label className="rf-label" htmlFor="rf-username">
                Username
              </label>
              <input
                id="rf-username"
                name="username"
                type="text"
                className={`rf-input${errors.username ? " rf-input--invalid" : ""}`}
                placeholder="e.g. controller"
                autoComplete="username"
                spellCheck="false"
                value={username}
                onChange={handleUsernameChange}
                disabled={busy}
                ref={usernameRef}
                aria-invalid={errors.username ? "true" : undefined}
                aria-describedby={
                  errors.username ? "rf-username-error" : undefined
                }
              />
              {errors.username ? (
                <p className="rf-err" id="rf-username-error">
                  {errors.username}
                </p>
              ) : null}
            </div>

            <div className="rf-field">
              <label className="rf-label" htmlFor="rf-password">
                Password
              </label>
              <input
                id="rf-password"
                name="password"
                type="password"
                className={`rf-input${errors.password ? " rf-input--invalid" : ""}`}
                placeholder="••••••••"
                autoComplete="current-password"
                value={password}
                onChange={handlePasswordChange}
                disabled={busy}
                ref={passwordRef}
                aria-invalid={errors.password ? "true" : undefined}
                aria-describedby={
                  errors.password ? "rf-password-error" : undefined
                }
              />
              {errors.password ? (
                <p className="rf-err" id="rf-password-error">
                  {errors.password}
                </p>
              ) : null}
            </div>

            <button
              type="submit"
              className="rf-submit"
              disabled={busy}
              aria-busy={busy}
            >
              {busy ? (
                <>
                  <span className="rf-spinner" aria-hidden="true" />
                  Verifying credentials…
                </>
              ) : (
                <>
                  Authenticate
                  <span aria-hidden="true">→</span>
                </>
              )}
            </button>
          </form>

          <footer className="rf-card__foot">
            <p className="rf-demo">
              <span className="rf-key">Demo</span> controller / railflow123
            </p>
            <p className="rf-meta">
              Client-side session · no network requests · build 1.0
            </p>
          </footer>
        </section>
      </main>

      <footer className="rf-pagefoot">
        RailFlow — Frontend PRD · RF-OPS-001 · works offline
      </footer>
    </div>
  );
}
