import { ArrowLeftIcon, MailIcon, RotateCwIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { useAuth } from "../../auth/AuthContext.jsx";
import OtpInput from "../../components/auth/OtpInput.jsx";
import ScreenCard from "../../components/auth/ScreenCard.jsx";
import SubmitButton from "../../components/auth/SubmitButton.jsx";

const RESEND_COOLDOWN_S = 30;

export default function VerifyEmail() {
  const { verifyEmail, resendVerification, adapterMode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const email = (
    searchParams.get("email") ||
    location.state?.email ||
    ""
  )
    .trim()
    .toLowerCase();

  const [code, setCode] = useState("");
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  // The server starts a cooldown with the first issued code (sign-up), so the
  // UI mirrors it instead of letting an immediate resend fail with a 429.
  const [cooldown, setCooldown] = useState(() =>
    location.state?.startCooldown ? RESEND_COOLDOWN_S : 0,
  );
  const [devCode, setDevCode] = useState(location.state?.devCode ?? null);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  function handleCodeChange(nextValue) {
    setCode(nextValue);
    if (errors.form) setErrors((prev) => ({ ...prev, form: "" }));
  }

  async function handleVerify(event) {
    event.preventDefault();
    if (busy) return;

    const clean = String(code).replace(/\D/g, "");
    if (clean.length !== 6) {
      setErrors({ form: "Enter the full 6-digit code." });
      return;
    }

    setBusy(true);
    setErrors({});
    try {
      const result = await verifyEmail({ email, code: clean });
      // Only reported because the server/mock confirmed the code.
      toast.success(result.message || "Email verified.");
      navigate("/login", { state: { email }, replace: true });
    } catch (error) {
      setErrors({ form: error?.message || "Verification failed." });
      toast.error(error?.message || "Verification failed.");
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    if (resending || cooldown > 0) return;
    setResending(true);
    try {
      const result = await resendVerification({ email });
      setDevCode(result.dev?.code ?? null);
      setCode("");
      setErrors({});
      setCooldown(RESEND_COOLDOWN_S);
      toast.success(result.message || "A new code was issued.");
    } catch (error) {
      if (error?.code === "RATE_LIMITED") {
        setCooldown(Number(error?.retryAfter) || RESEND_COOLDOWN_S);
      }
      toast.error(error?.message || "Could not resend the code.");
    } finally {
      setResending(false);
    }
  }

  if (!email) {
    return (
      <ScreenCard
        id="verify-missing"
        kicker="§ 05 — Email verification"
        title="Code unavailable"
        lead="Open this page from sign-up or a sign-in attempt so we know which address to verify."
        footer={
          <p className="rf-glass__alt">
            <Link className="rf-link" to="/login">
              <ArrowLeftIcon aria-hidden="true" /> Back to login
            </Link>
          </p>
        }
      >
        <div className="rf-success rf-success--error">
          <span className="rf-success__icon" aria-hidden="true">
            <MailIcon />
          </span>
          <Link className="rf-btn rf-btn--primary" to="/forgot-password">
            Request a new code
          </Link>
        </div>
      </ScreenCard>
    );
  }

  return (
    <ScreenCard
      id="verify"
      kicker="§ 05 — Email verification"
      title="Verify your email"
      lead={
        <>
          Enter the 6-digit code sent to <b>{email}</b>.
        </>
      }
      footer={
        <div className="rf-glass__alt rf-glass__alt--row">
          <button
            type="button"
            className="rf-link rf-link--btn"
            onClick={handleResend}
            disabled={resending || cooldown > 0}
            aria-live="polite"
          >
            <RotateCwIcon
              aria-hidden="true"
              className={resending ? "animate-spin" : undefined}
            />
            {cooldown > 0
              ? `Resend code in ${cooldown}s`
              : resending
                ? "Resending…"
                : "Resend code"}
          </button>
          <Link className="rf-link rf-link--sm" to="/login">
            <ArrowLeftIcon aria-hidden="true" /> Back to login
          </Link>
        </div>
      }
    >
      <form className="rf-form" onSubmit={handleVerify} noValidate>
        {errors.form ? (
          <p className="rf-alert" role="alert">
            <span className="rf-alert__tag">Code</span>
            {errors.form}
          </p>
        ) : null}

        <OtpInput value={code} onChange={handleCodeChange} disabled={busy} />

        <SubmitButton busy={busy} busyLabel="Verifying code…">
          Verify email
        </SubmitButton>

        {adapterMode === "mock" ? (
          <p className="rf-devnote">
            <b>Development mock</b> — no email was sent
            {devCode ? (
              <>
                . Current code: <code>{devCode}</code>
              </>
            ) : (
              ". Request a new code to generate one."
            )}
          </p>
        ) : null}
      </form>
    </ScreenCard>
  );
}
