import { ArrowRightIcon } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { useAuth } from "../../auth/AuthContext.jsx";
import FormField from "../../components/auth/FormField.jsx";
import PasswordField from "../../components/auth/PasswordField.jsx";
import ScreenCard from "../../components/auth/ScreenCard.jsx";
import SubmitButton from "../../components/auth/SubmitButton.jsx";
import { getPref } from "../../lib/prefs.js";
import {
  hasErrors,
  safeReturnTo,
  validateEmail,
  validateLoginPassword,
} from "../../lib/validation.js";

export default function Login() {
  const { login, adapterMode } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [values, setValues] = useState(() => ({
    email: "",
    password: "",
    remember: getPref("rememberDefault"),
  }));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  function update(key) {
    return (event) => {
      const target = event.target;
      setValues((prev) => ({
        ...prev,
        [key]: target.type === "checkbox" ? target.checked : target.value,
      }));
      setErrors((prev) => ({ ...prev, [key]: "", form: "" }));
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return; // guard against duplicate submissions

    const next = {
      email: validateEmail(values.email),
      password: validateLoginPassword(values.password),
      form: "",
    };
    if (hasErrors(next)) {
      setErrors(next);
      const firstInvalid = next.email ? "login-email" : "login-password";
      document.getElementById(firstInvalid)?.focus();
      return;
    }

    setBusy(true);
    setErrors({});
    try {
      const user = await login({
        email: values.email,
        password: values.password,
        remember: values.remember,
      });
      toast.success(`Welcome back, ${user.name.split(" ")[0]}`);
      navigate(safeReturnTo(searchParams.get("returnTo")), { replace: true });
    } catch (error) {
      if (error?.code === "EMAIL_NOT_VERIFIED") {
        toast.info(error.message);
        const email = values.email.trim().toLowerCase();
        navigate(`/verify-email?email=${encodeURIComponent(email)}`, {
          replace: true,
        });
        return;
      }
      const fieldErrors = error?.fieldErrors || {};
      setErrors({
        ...fieldErrors,
        form: error?.message || "Sign-in failed. Please try again.",
      });
      if (!Object.keys(fieldErrors).length) {
        toast.error(error?.message || "Sign-in failed.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenCard
      id="login"
      kicker="§ 01 — Operator sign-in"
      title="Welcome back"
      lead="Sign in to RailFlow for platform allocation, disruption control and re-planning at Central Junction."
      footer={
        <p className="rf-glass__alt">
          New to RailFlow?{" "}
          <Link className="rf-link" to="/signup">
            Create an account
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
          id="login-email"
          label="Email"
          type="email"
          value={values.email}
          onChange={update("email")}
          error={errors.email}
          autoComplete="username"
          placeholder="controller@railway.com"
          required
          autoFocus
        />

        <PasswordField
          id="login-password"
          label="Password"
          value={values.password}
          onChange={update("password")}
          error={errors.password}
          autoComplete="current-password"
          placeholder="••••••••"
          required
        />

        <div className="rf-form__row">
          <label className="rf-check">
            <input
              type="checkbox"
              checked={values.remember}
              onChange={update("remember")}
            />
            <span className="rf-check__box" aria-hidden="true" />
            <span>Remember me</span>
          </label>
          <Link className="rf-link rf-link--sm" to="/forgot-password">
            Forgot password?
          </Link>
        </div>

        <SubmitButton busy={busy} busyLabel="Verifying credentials…">
          Sign in <ArrowRightIcon aria-hidden="true" />
        </SubmitButton>

        {adapterMode === "mock" ? (
          <p className="rf-devnote">
            <b>Development mock</b> — demo login: controller@railflow.dev /
            railflow123
          </p>
        ) : null}
      </form>
    </ScreenCard>
  );
}
