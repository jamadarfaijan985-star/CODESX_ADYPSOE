import { scorePassword } from "../../lib/passwordStrength.js";

/** Real-time password strength meter (4 segments + label + hints). */
export default function StrengthMeter({ password }) {
  const { score, label, tone, hints } = scorePassword(password);

  return (
    <div className={`rf-strength rf-strength--${tone}`}>
      <div className="rf-strength__bars" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={`rf-strength__bar${score > index ? " is-on" : ""}`}
          />
        ))}
      </div>
      <div className="rf-strength__meta">
        <span className="rf-strength__label">
          Strength: <b>{label || "—"}</b>
        </span>
        <span className="rf-strength__hints">
          {hints.length ? hints.join(" · ") : "Add a hint-free, long passphrase"}
        </span>
      </div>
      <span className="sr-only" aria-live="polite">
        Password strength {label || "not set"}
      </span>
    </div>
  );
}
