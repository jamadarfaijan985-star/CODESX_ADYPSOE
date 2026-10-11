import {
  ArrowLeftIcon,
  ArrowRightIcon,
  KeyRoundIcon,
  MailIcon,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { useAuth } from "../../auth/AuthContext.jsx";
import FormField from "../../components/auth/FormField.jsx";
import ScreenCard from "../../components/auth/ScreenCard.jsx";
import SubmitButton from "../../components/auth/SubmitButton.jsx";
import { hasErrors, validateEmail } from "../../lib/validation.js";

export default function ForgotPassword() {
  const { forgotPassword, adapterMode } = useAuth();

  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { message, dev }

  function handleEmailChange(event) {
    setEmail(event.target.value);
    setErrors((prev) => ({ ...prev, email: "", form: "" }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;

    const next = { email: validateEmail(email), form: "" };
    if (hasErrors(next)) {
      setErrors(next);
      document.getElementById("forgot-email")?.focus();
      return;
    }

    setBusy(true);
    setErrors({});
    try {
      const response = await forgotPassword({ email });
      setResult(response);
      toast.success(response.message || "Reset link issued.");
    } catch (error) {
      const fieldErrors = error?.fieldErrors || {};
      setErrors({
        ...fieldErrors,
        form: error?.message || "Could not process the request.",
      });
      if (!Object.keys(fieldErrors).length) {
        toast.error(error?.message || "Could not process the request.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <ScreenCard
        id="forgot-sent"
        kicker="§ 03 — Recovery issued"
        title="Check your inbox"
        lead={result.message}
        footer={
          <p className="rf-glass__alt">
            <Link className="rf-link" to="/login">
              <ArrowLeftIcon aria-hidden="true" /> Back to login
            </Link>
          </p>
        }
      >
        <div className="rf-success">
          <span className="rf-success__icon" aria-hidden="true">
            <MailIcon />
          </span>
          <p>
            The link expires shortly for security. If nothing arrives, check
            spam or request a new link.
          </p>

          {result.dev ? (
            <div className="rf-devnote rf-devnote--block">
              <b>Development mock</b> — no email was sent. Use the issued reset
              link directly:
              <Link
                className="rf-btn rf-btn--ghost"
                to={`/reset-password?token=${encodeURIComponent(result.dev.token)}`}
              >
                <KeyRoundIcon aria-hidden="true" /> Open reset page
              </Link>
            </div>
          ) : null}

          <button
            type="button"
            className="rf-btn rf-btn--ghost"
            onClick={() => setResult(null)}
          >
            Use a different email
          </button>
        </div>
      </ScreenCard>
    );
  }

  return (
    <ScreenCard
      id="forgot"
      kicker="§ 03 — Account recovery"
      title="Reset your password"
      lead="Enter the email on your account and we'll issue a secure reset link."
      footer={
        <p className="rf-glass__alt">
          Remembered it?{" "}
          <Link className="rf-link" to="/login">
            <ArrowLeftIcon aria-hidden="true" /> Back to login
          </Link>
        </p>
      }
    >
      <form className="rf-form" onSubmit={handleSubmit} noValidate>
        {errors.form ? (
          <p className="rf-alert" role="alert">
            <span className="rf-alert__tag">Auth</span>
            {errors.form}
          </p>
        ) : null}

        <FormField
          id="forgot-email"
          label="Email"
          type="email"
          value={email}
          onChange={handleEmailChange}
          error={errors.email}
          autoComplete="email"
          placeholder="controller@railway.com"
          required
          autoFocus
        />

        <SubmitButton busy={busy} busyLabel="Issuing reset link…">
          Send reset link <ArrowRightIcon aria-hidden="true" />
        </SubmitButton>

        {adapterMode === "mock" ? (
          <p className="rf-devnote">
            <b>Development mock</b> — the reset token is shown on the next
            screen instead of being emailed.
          </p>
        ) : null}
      </form>
    </ScreenCard>
  );
}
