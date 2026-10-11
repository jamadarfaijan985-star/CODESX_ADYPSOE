import { Loader2Icon } from "lucide-react";

/**
 * Submit button with loading spinner; disabled while busy so duplicate
 * submissions are impossible (handlers also guard on `busy`).
 */
export default function SubmitButton({
  busy = false,
  busyLabel = "Working…",
  children,
  className = "",
}) {
  return (
    <button
      type="submit"
      className={`rf-submit ${className}`.trim()}
      disabled={busy}
      aria-busy={busy}
    >
      {busy ? (
        <>
          <Loader2Icon className="animate-spin" aria-hidden="true" />
          <span>{busyLabel}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
