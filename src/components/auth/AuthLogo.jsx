/** RailFlow brand mark — converging rails with a live signal LED. */
export default function AuthLogo({ size = "md", className = "" }) {
  return (
    <span
      className={`rf-logo rf-logo--${size} ${className}`.trim()}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" focusable="false">
        <g fill="none" strokeLinecap="round">
          <path d="M11.5 5.5 L9.7 26.5" stroke="#22d3ee" strokeWidth="2.4" />
          <path d="M20.5 5.5 L22.3 26.5" stroke="#2f7bff" strokeWidth="2.4" />
          <path
            d="M11.1 10 H20.9 M10.7 15.5 H21.3 M10.3 21 H21.7"
            stroke="#dbe7fb"
            strokeOpacity="0.5"
            strokeWidth="1.5"
          />
        </g>
        <circle cx="26.5" cy="6" r="3" fill="#3ddc97" />
      </svg>
    </span>
  );
}
