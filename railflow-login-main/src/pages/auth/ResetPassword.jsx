import {
  ArrowLeftIcon,
  ArrowRightIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { useAuth } from "../../auth/AuthContext.jsx";
import { RouteLoader } from "../../auth/guards.jsx";
import PasswordField from "../../components/auth/PasswordField.jsx";
import ScreenCard from "../../components/auth/ScreenCard.jsx";
import StrengthMeter from "../../components/auth/StrengthMeter.jsx";
import SubmitButton from "../../components/auth/SubmitButton.jsx";
import {
  hasErrors,
  validateMatch,
  validateNewPassword,
} from "../../lib/validation.js";

export default function ResetPassword() {
  const { resetPassword, inspectResetToken, adapterMode } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [tokenState, setTokenState] = useState(() => {
    if (!token) return "missing";
    return adapterMode === "mock" ? "checking" : "unknown";
  });
  const [tokenReason, setTokenReason] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [values, setValues] = useState({ password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  // Early token validation when the adapter supports it (development mock).
  useEffect(() => {
    if (tokenState !== "checking") return undefined;
    let alive = true;
    (async () => {
      const info = await inspectResetToken(token);
      if (!alive) return;
      if (!info) {
        setTokenState("unknown");
        return;
      }
      if (info.valid) {
        setMaskedEmail(info.email || "");
        setTokenState("valid");
      } else {
        setTokenReason(info.reason === "expired" ? "expired" : "invalid");
        setTokenState("invalid");
      }
    })();
    return () => {
      alive = false;
    };
  }, [token, tokenState, inspectResetToken]);

  function update(key) {
    return (event) => {
      setValues((prev) => ({ ...prev, [key]: event.target.value }));
      setErrors((prev) => ({ ...prev, [key]: "", form: "" }));
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;

    const next = {
      password: validateNewPassword(values.password),
      confirm: validateMatch(values.password, values.confirm),
      form: "",
    };
    if (hasErrors(next)) {
      setErrors(next);
      const firstInvalid = next.password
        ? "reset-password"
        : "reset-confirm";
      document.getElementById(firstInvalid)?.focus();
      return;
    }

    setBusy(true);
    setErrors({});
    try {
      const result = await resetPassword({
        token,
        password: values.password,
      });
      toast.success(result.message || "Password updated.");
      navigate("/login", { replace: true });
    } catch (error) {
      if (
        error?.code === "RESET_TOKEN_EXPIRED" ||
        error?.code === "RESET_TOKEN_INVALID"
      ) {
        setTokenReason(
          error.code === "RESET_TOKEN_EXPIRED" ? "expired" : "invalid",
        );
        setTokenState("invalid");
        toast.error(error.message);
        return;
      }
      const fieldErrors = error?.fieldErrors || {};
      setErrors({
        ...fieldErrors,
        form: error?.message || "Could not update the password.",
      });
      if (!Object.keys(fieldErrors).length) {
        toast.error(error?.message || "Could not update the password.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (tokenState === "missing" || tokenState === "invalid") {
    const message =
      tokenState === "missing"
        ? "This page needs a reset link containing a valid token. Request a new link to continue."
        : tokenReason === "expired"
          ? "This reset link has expired. Request a new one."
          : "This reset link is invalid or has already been used.";
    return (
      <ScreenCard
        id="reset-invalid"
        kicker="§ 04 — Reset link"
        title="Link problem"
        lead={message}
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
            <TriangleAlertIcon />
          </span>
          <Link className="rf-btn rf-btn--primary" to="/forgot-password">
            Request a new link
          </Link>
        </div>
      </ScreenCard>
    );
  }

  if (tokenState === "checking") {
    return (
      <ScreenCard
        id="reset-checking"
        kicker="§ 04 — Reset link"
        title="Checking your link"
      >
        <RouteLoader label="Validating reset token…" />
      </ScreenCard>
    );
  }

  return (
    <ScreenCard
      id="reset"
      kicker="§ 04 — Set a new password"
      title="Choose a new password"
      lead={
        maskedEmail
          ? `Resetting the password for ${maskedEmail}.`
          : "Pick a strong password you haven't used on RailFlow before."
      }
      footer={
        <p className="rf-glass__alt">
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

        <PasswordField
          id="reset-password"
          label="New password"
          value={values.password}
          onChange={update("password")}
          error={errors.password}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          required
          autoFocus
        />
        <StrengthMeter password={values.password} />

        <PasswordField
          id="reset-confirm"
          label="Confirm new password"
          value={values.confirm}
          onChange={update("confirm")}
          error={errors.confirm}
          autoComplete="new-password"
          placeholder="Repeat the new password"
          required
        />

        <SubmitButton busy={busy} busyLabel="Updating password…">
          Update password <ArrowRightIcon aria-hidden="true" />
        </SubmitButton>
      </form>
    </ScreenCard>
  );
}
