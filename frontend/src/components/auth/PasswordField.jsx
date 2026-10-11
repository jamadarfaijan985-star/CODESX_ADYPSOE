import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import FormField from "./FormField.jsx";

/** Password input with an accessible show/hide toggle. */
export default function PasswordField({
  label = "Password",
  autoComplete = "current-password",
  ...props
}) {
  const [visible, setVisible] = useState(false);

  return (
    <FormField
      {...props}
      label={label}
      type={visible ? "text" : "password"}
      autoComplete={autoComplete}
      action={
        <button
          type="button"
          className="rf-eyebtn"
          onClick={() => setVisible((current) => !current)}
          aria-label={
            visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`
          }
          aria-pressed={visible}
        >
          {visible ? (
            <EyeOffIcon aria-hidden="true" />
          ) : (
            <EyeIcon aria-hidden="true" />
          )}
        </button>
      }
    />
  );
}
