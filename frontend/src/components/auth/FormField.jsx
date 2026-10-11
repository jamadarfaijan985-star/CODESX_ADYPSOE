/** Labeled text input with animated focus state and inline error slot. */
export default function FormField({
  id,
  name,
  label,
  action = null,
  type = "text",
  value,
  onChange,
  onBlur,
  error = "",
  autoComplete,
  placeholder,
  required = false,
  disabled = false,
  inputRef,
  inputMode,
  maxLength,
  autoFocus,
}) {
  const errorId = `${id}-error`;

  return (
    <div className={`rf-field${error ? " rf-field--invalid" : ""}`}>
      <div className="rf-labelrow">
        <label className="rf-label" htmlFor={id}>
          {label}
          {required ? (
            <span className="rf-label__req" aria-hidden="true">
              {" "}
              *
            </span>
          ) : null}
        </label>
        {action}
      </div>

      <input
        id={id}
        name={name || id}
        type={type}
        className="rf-input"
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        ref={inputRef}
        inputMode={inputMode}
        maxLength={maxLength}
        autoFocus={autoFocus}
        spellCheck={type === "password" ? false : undefined}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? errorId : undefined}
      />

      {error ? (
        <p className="rf-err" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
