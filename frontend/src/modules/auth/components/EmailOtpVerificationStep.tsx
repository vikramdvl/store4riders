"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { ArrowLeftIcon, EnvelopeIcon } from "@heroicons/react/24/outline";

export interface EmailOtpVerificationStepProps {
  email: string;
  otp: string;
  onOtpChange: (value: string) => void;
  onSubmitOtp: () => void;
  onResendOtp: () => void;
  onBack: () => void;
  cooldownSeconds: number;
  isSubmitting: boolean;
  isResending: boolean;
  errorMessage?: string;
  backLabel?: string;
  submitLabel?: string;
  compact?: boolean;
}

/**
 * Shared accessible 6-digit email OTP verification step.
 * Uses a single numeric input with `autocomplete="one-time-code"` for reliable
 * OS autofill, paste, and screen-reader navigation.
 */
export function EmailOtpVerificationStep({
  email,
  otp,
  onOtpChange,
  onSubmitOtp,
  onResendOtp,
  onBack,
  cooldownSeconds,
  isSubmitting,
  isResending,
  errorMessage,
  backLabel = "Change Email",
  submitLabel = "VERIFY & CREATE ACCOUNT",
  compact = false,
}: EmailOtpVerificationStepProps) {
  const otpId = useId();
  const hintId = useId();
  const errorId = useId();
  const headingId = useId();
  const otpInputRef = useRef<HTMLInputElement | null>(null);
  const [touched, setTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    otpInputRef.current?.focus();
  }, []);

  const cleanOtp = otp.replace(/\D/g, "").slice(0, 6);
  const localFormatError =
    submitted && cleanOtp.length !== 6
      ? "Please enter the 6-digit verification code."
      : touched && cleanOtp.length > 0 && cleanOtp.length < 6
        ? "Please enter all 6 digits of your verification code."
        : "";
  const displayedError = errorMessage || localFormatError;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setSubmitted(true);
    if (cleanOtp.length !== 6) {
      otpInputRef.current?.focus();
      return;
    }
    onSubmitOtp();
  };

  return (
    <form
      onSubmit={handleFormSubmit}
      method="POST"
      aria-labelledby={headingId}
      className="flex flex-col gap-3.5 w-full"
      noValidate
    >
      <div className="flex items-start gap-2.5 rounded-xs border border-neutral-200 bg-neutral-50 p-3">
        <EnvelopeIcon className="w-4 h-4 text-banner shrink-0 mt-0.5" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2
            id={headingId}
            className="text-xs font-bold uppercase tracking-wider text-neutral-900"
          >
            Verify Your Email
          </h2>
          <p id={hintId} className="text-[11px] text-neutral-600 mt-0.5 leading-relaxed break-words">
            Enter the 6-digit verification code sent to <strong className="text-neutral-900">{email}</strong>. Code expires in 10 minutes.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={otpId}
          className="text-[10px] md:text-xs uppercase tracking-wider font-semibold text-neutral-600"
        >
          6-Digit Verification Code
        </label>
        <input
          ref={otpInputRef}
          id={otpId}
          name="otp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="done"
          required
          value={cleanOtp}
          onChange={(e) => {
            // Strip non-digits without DOM maxLength truncation so pasted formatted OTPs (e.g. "123 456" or "OTP: 123456") keep all 6 digits
            const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 6);
            if (submitted) setSubmitted(false);
            onOtpChange(digitsOnly);
          }}
          onBlur={() => setTouched(true)}
          aria-invalid={displayedError ? "true" : "false"}
          aria-describedby={displayedError ? `${hintId} ${errorId}` : hintId}
          placeholder="••••••"
          className={`w-full border ${
            displayedError ? "border-red-500 bg-red-50/20" : "border-neutral-300"
          } min-h-[48px] px-3 py-2.5 text-base md:text-lg font-mono font-bold tracking-[0.4em] text-center text-neutral-900 placeholder:text-neutral-300 placeholder:tracking-[0.4em] focus:outline-none focus:border-banner rounded-xs transition-colors bg-neutral-50/50 focus:bg-white`}
        />
        {displayedError && (
          <span id={errorId} role="alert" className="text-[11px] text-red-600 font-medium">
            {displayedError}
          </span>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className={`w-full bg-banner hover:bg-orange-600 text-white min-h-[48px] ${
          compact ? "py-2.5 text-[11px]" : "py-3 text-xs md:text-sm"
        } font-bold tracking-widest uppercase transition-all flex items-center justify-center gap-2 disabled:opacity-70 shadow-sm cursor-pointer rounded-xs`}
      >
        {isSubmitting ? "VERIFYING..." : submitLabel}
        <span className="text-base leading-none" aria-hidden="true">→</span>
      </button>

      <div className="flex items-center justify-between gap-2 pt-1 text-[11px]">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="inline-flex items-center gap-1 font-semibold text-neutral-600 hover:text-neutral-900 py-1.5 cursor-pointer disabled:opacity-50"
        >
          <ArrowLeftIcon className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{backLabel}</span>
        </button>

        <button
          type="button"
          onClick={onResendOtp}
          disabled={cooldownSeconds > 0 || isResending || isSubmitting}
          className="font-bold text-banner hover:underline py-1.5 cursor-pointer disabled:text-neutral-400 disabled:no-underline disabled:cursor-not-allowed"
        >
          {isResending
            ? "Sending..."
            : cooldownSeconds > 0
              ? `Resend in ${cooldownSeconds}s`
              : "Resend Code"}
        </button>
      </div>
    </form>
  );
}

export default EmailOtpVerificationStep;
