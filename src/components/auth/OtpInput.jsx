import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

/**
 * Six-digit code input (wraps the installed `input-otp` package):
 * auto-advance, backspace, arrow keys and full-code paste support.
 */
export default function OtpInput({ value, onChange, onComplete, disabled }) {
  return (
    <div className="rf-otp" role="group" aria-label="Six digit verification code">
      <InputOTP
        maxLength={6}
        value={value}
        onChange={onChange}
        onComplete={onComplete}
        disabled={disabled}
        containerClassName="rf-otp__container"
      >
        <InputOTPGroup className="rf-otp__group">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <InputOTPSlot key={index} index={index} className="rf-otp__slot" />
          ))}
        </InputOTPGroup>
      </InputOTP>
    </div>
  );
}
