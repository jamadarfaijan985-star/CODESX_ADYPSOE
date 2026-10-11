import { ArrowRightIcon, CircleCheckIcon } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { useAuth } from "../../auth/AuthContext.jsx";
import FormField from "../../components/auth/FormField.jsx";
import PasswordField from "../../components/auth/PasswordField.jsx";
import ScreenCard from "../../components/auth/ScreenCard.jsx";
import StrengthMeter from "../../components/auth/StrengthMeter.jsx";
import SubmitButton from "../../components/auth/SubmitButton.jsx";
import {
  hasErrors,
  validateEmail,
  validateMatch,
  validateName,
  validateNewPassword,
} from "../../lib/validation.js";

export default function Signup() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [values, setValues] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
    terms: false,
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

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
    if (busy) return;

    const next = {
      name: validateName(values.name),
      email: validateEmail(values.email),
      password: validateNewPassword(values.password),
      confirm: validateMatch(values.password, values.confirm),
      terms: values.terms ? "" : "Accept the Terms of Service to continue.",
      form: "",
    };
    if (hasErrors(next)) {
      setErrors(next);
      const order = [
        ["name", "signup-name"],
        ["email", "signup-email"],
        ["password", "signup-password"],
        ["confirm", "signup-confirm"],
        ["terms", "signup-terms"],
      ];
      const firstInvalid = order.find(([key]) => next[key]);
      if (firstInvalid) document.getElementById(firstInvalid[1])?.focus();
      return;
    }

    setBusy(true);
    setErrors({});
    try {
      const result = await register({
        name: values.name,
        email: values.email,
        password: values.password,
      });
      // Success is only reported because the server/mock confirmed it.
      toast.success(result.message || "Account created.");
      const email = values.email.trim().toLowerCase();
      navigate(`/verify-email?email=${encodeURIComponent(email)}`, {
        state: {
          email,
          devCode: result.dev?.code ?? null,
          startCooldown: true,
        },
      });
    } catch (error) {
      const fieldErrors = error?.fieldErrors || {};
      setErrors({
        ...fieldErrors,
        form: error?.message || "Registration failed. Please try again.",
      });
      if (!Object.keys(fieldErrors).length) {
        toast.error(error?.message || "Registration failed.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenCard
      id="signup"
      kicker="§ 02 — New operator account"
      title="Create your account"
      lead="Register for dispatch access to the RailFlow operations platform."
      footer={
        <p className="rf-glass__alt">
          Already registered?{" "}
          <Link className="rf-link" to="/login">
            Sign in
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
          id="signup-name"
          label="Full name"
          value={values.name}
          onChange={update("name")}
          error={errors.name}
          autoComplete="name"
          placeholder="Alex Renderer"
          required
          autoFocus
        />

        <FormField
          id="signup-email"
          label="Email"
          type="email"
          value={values.email}
          onChange={update("email")}
          error={errors.email}
          autoComplete="email"
          placeholder="controller@railway.com"
          required
        />

        <PasswordField
          id="signup-password"
          label="Password"
          value={values.password}
          onChange={update("password")}
          error={errors.password}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          required
        />
        <StrengthMeter password={values.password} />

        <PasswordField
          id="signup-confirm"
          label="Confirm password"
          value={values.confirm}
          onChange={update("confirm")}
          error={errors.confirm}
          autoComplete="new-password"
          placeholder="Repeat your password"
          required
        />

        <div className="rf-field">
          <label className="rf-check" htmlFor="signup-terms">
            <input
              id="signup-terms"
              type="checkbox"
              checked={values.terms}
              onChange={update("terms")}
              aria-describedby={errors.terms ? "signup-terms-error" : undefined}
            />
            <span className="rf-check__box" aria-hidden="true" />
            <span>I agree to the Terms of Service</span>
          </label>

          <button
            type="button"
            className="rf-link rf-link--sm rf-link--btn"
            aria-expanded={showTerms}
            onClick={() => setShowTerms((open) => !open)}
          >
            {showTerms ? "Hide terms summary" : "Read terms summary"}
          </button>

          {errors.terms ? (
            <p className="rf-err" id="signup-terms-error" role="alert">
              {errors.terms}
            </p>
          ) : null}

          {showTerms ? (
            <div className="rf-terms" id="signup-terms-panel">
              <p>
                Operators agree to run the RailFlow console responsibly, to keep
                credentials confidential and to report disruptions accurately.
              </p>
              <p>
                This build stores account data locally in your browser (mock
                adapter); a production deployment keeps accounts server-side.
              </p>
            </div>
          ) : null}
        </div>

        <SubmitButton busy={busy} busyLabel="Creating account…">
          Create account <ArrowRightIcon aria-hidden="true" />
        </SubmitButton>

        <p className="rf-form__note">
          <CircleCheckIcon aria-hidden="true" />
          You'll verify your email with a 6-digit code before signing in.
        </p>
      </form>
    </ScreenCard>
  );
}
