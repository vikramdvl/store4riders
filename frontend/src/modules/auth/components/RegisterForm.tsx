"use client";

import React, { useEffect, useId, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { strongPasswordSchema } from "@store4riders/shared-validation";
import { useRegister, useSendRegisterOtp } from "@/core/hooks/useAuth";
import { EyeIcon, EyeSlashIcon, CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/solid";
import { EmailOtpVerificationStep } from "./EmailOtpVerificationStep";

const nameRegex = /^[a-zA-Z\s\-']+$/;

const registerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name cannot exceed 100 characters")
    .regex(nameRegex, "Name can only contain letters, spaces, hyphens, and apostrophes")
    .refine((val) => val.split(/\s+/)[0]?.length >= 2, "First name must be at least 2 characters"),
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address")
    .max(255, "Email cannot exceed 255 characters"),
  password: strongPasswordSchema,
});
type RegisterFormInputs = z.infer<typeof registerSchema>;

interface PendingRegistration {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export function RegisterForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<"details" | "otp">("details");
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [detailsError, setDetailsError] = useState("");
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [pendingData, setPendingData] = useState<PendingRegistration | null>(null);
  const [otpSentEmail, setOtpSentEmail] = useState<string | null>(null);
  const [otpExpiresAt, setOtpExpiresAt] = useState<number>(0);

  const fullNameId = useId();
  const fullNameErrorId = useId();
  const emailId = useId();
  const emailHintId = useId();
  const emailErrorId = useId();
  const passwordId = useId();
  const passwordRulesId = useId();
  const passwordErrorId = useId();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormInputs>({
    resolver: zodResolver(registerSchema),
    mode: "onTouched",
  });

  const passwordValue = watch("password", "");
  const sendOtpMutation = useSendRegisterOtp();
  const registerMutation = useRegister();

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  // Password validation checks for the UI checklist
  const hasMinLength = passwordValue.length >= 8;
  const hasNumber = /\d/.test(passwordValue);
  const hasUpperAndLowerCase = /[a-z]/.test(passwordValue) && /[A-Z]/.test(passwordValue);
  const hasSymbol = /[^A-Za-z0-9\s]/.test(passwordValue);

  const ValidationItem = ({ isValid, text }: { isValid: boolean; text: string }) => (
    <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
      {isValid ? (
        <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-500 shrink-0" aria-hidden="true" />
      ) : (
        <XCircleIcon className="w-3.5 h-3.5 text-neutral-300 shrink-0" aria-hidden="true" />
      )}
      <span className={isValid ? "text-neutral-700 font-medium" : ""}>{text}</span>
    </div>
  );

  const requestOtpFor = (payload: PendingRegistration, sourceStep: "details" | "otp" = step) => {
    setOtpError("");
    setDetailsError("");
    sendOtpMutation.mutate(
      { email: payload.email },
      {
        onSuccess: (res: any) => {
          const ttlSec = Number(res?.data?.expiresInSeconds || 600);
          const cooldownSec = Number(res?.data?.cooldownSeconds || 60);
          setPendingData(payload);
          setOtpSentEmail(payload.email);
          setOtpExpiresAt(Date.now() + ttlSec * 1000);
          setOtp("");
          setCooldownSeconds(cooldownSec);
          setStep("otp");
        },
        onError: (err: any) => {
          const message = err?.response?.data?.error || "Failed to send verification code. Please try again.";
          if (sourceStep === "otp") {
            setOtpError(message);
          } else {
            setDetailsError(message);
          }
        },
      }
    );
  };

  const onFormSubmit = (data: RegisterFormInputs) => {
    const nameParts = data.fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";
    const normalizedEmail = data.email.trim().toLowerCase();

    const payload: PendingRegistration = {
      email: normalizedEmail,
      password: data.password,
      firstName,
      lastName,
    };

    // If the user went back only to adjust name/password for the same email while the OTP is still valid,
    // return directly to the OTP screen instead of triggering the 60s resend cooldown.
    if (otpSentEmail === normalizedEmail && Date.now() < otpExpiresAt) {
      setPendingData(payload);
      setDetailsError("");
      setOtpError("");
      setStep("otp");
      return;
    }

    requestOtpFor(payload, "details");
  };

  const handleVerifyAndRegister = () => {
    if (!pendingData) return;
    setOtpError("");
    registerMutation.mutate(
      {
        email: pendingData.email,
        password: pendingData.password,
        firstName: pendingData.firstName,
        lastName: pendingData.lastName,
        otp,
      },
      {
        onError: (err: any) => {
          setOtpError(err?.response?.data?.error || "Verification failed. Please try again.");
        },
      }
    );
  };

  const handleResendOtp = () => {
    if (!pendingData || cooldownSeconds > 0) return;
    requestOtpFor(pendingData, "otp");
  };

  if (step === "otp" && pendingData) {
    return (
      <EmailOtpVerificationStep
        email={pendingData.email}
        otp={otp}
        onOtpChange={(val) => {
          setOtp(val);
          if (otpError) setOtpError("");
        }}
        onSubmitOtp={handleVerifyAndRegister}
        onResendOtp={handleResendOtp}
        onBack={() => {
          setOtpError("");
          setStep("details");
        }}
        cooldownSeconds={cooldownSeconds}
        isSubmitting={registerMutation.isPending}
        isResending={sendOtpMutation.isPending}
        errorMessage={otpError}
        backLabel="Edit details"
        submitLabel="VERIFY & CREATE ACCOUNT"
      />
    );
  }

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="flex flex-col gap-3.5 w-full" noValidate>
      {/* Full Name Input */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor={fullNameId}
          className="text-[10px] md:text-xs uppercase tracking-wider font-semibold text-neutral-600"
        >
          Full Name
        </label>
        <input
          id={fullNameId}
          type="text"
          autoComplete="name"
          enterKeyHint="next"
          aria-invalid={errors.fullName ? "true" : "false"}
          aria-describedby={errors.fullName ? fullNameErrorId : undefined}
          className={`w-full border ${errors.fullName ? "border-red-500 bg-red-50/20" : "border-neutral-300"} min-h-[44px] p-2.5 text-base md:text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:border-banner rounded-xs transition-colors bg-neutral-50/50 focus:bg-white`}
          {...register("fullName")}
        />
        {errors.fullName && (
          <span id={fullNameErrorId} role="alert" className="text-[11px] text-red-600 font-medium">
            {errors.fullName.message}
          </span>
        )}
      </div>

      {/* Email Input */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor={emailId}
          className="text-[10px] md:text-xs uppercase tracking-wider font-semibold text-neutral-600"
        >
          Email Address
        </label>
        <p id={emailHintId} className="text-[11px] text-neutral-500">
          We&apos;ll send a 6-digit OTP to verify this email.
        </p>
        <input
          id={emailId}
          type="email"
          autoComplete="username"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="next"
          aria-invalid={errors.email ? "true" : "false"}
          aria-describedby={errors.email ? `${emailHintId} ${emailErrorId}` : emailHintId}
          className={`w-full border ${errors.email ? "border-red-500 bg-red-50/20" : "border-neutral-300"} min-h-[44px] p-2.5 text-base md:text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:border-banner rounded-xs transition-colors bg-neutral-50/50 focus:bg-white`}
          {...register("email")}
        />
        {errors.email && (
          <span id={emailErrorId} role="alert" className="text-[11px] text-red-600 font-medium">
            {errors.email.message}
          </span>
        )}
      </div>

      {/* Password Input */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor={passwordId}
          className="text-[10px] md:text-xs uppercase tracking-wider font-semibold text-neutral-600"
        >
          Password
        </label>
        <div id={passwordRulesId} className="flex flex-col gap-1 pb-1">
          <ValidationItem isValid={hasMinLength} text="Minimum 8 characters" />
          <ValidationItem isValid={hasNumber} text="Must contain at least 1 number" />
          <ValidationItem isValid={hasUpperAndLowerCase} text="Must contain capital and lowercase letters" />
          <ValidationItem isValid={hasSymbol} text="Must contain at least 1 special character" />
        </div>
        <div className="relative">
          <input
            id={passwordId}
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            enterKeyHint="done"
            aria-invalid={errors.password ? "true" : "false"}
            aria-describedby={errors.password ? `${passwordRulesId} ${passwordErrorId}` : passwordRulesId}
            className={`w-full border ${errors.password ? "border-red-500 bg-red-50/20" : "border-neutral-300"} min-h-[44px] p-2.5 pr-11 text-base md:text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:border-banner rounded-xs transition-colors bg-neutral-50/50 focus:bg-white`}
            {...register("password")}
          />
          <button
            type="button"
            aria-pressed={showPassword}
            aria-label={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-2"
          >
            {showPassword ? (
              <EyeIcon className="w-4 h-4" aria-hidden="true" />
            ) : (
              <EyeSlashIcon className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        </div>
        {errors.password && (
          <span id={passwordErrorId} role="alert" className="text-[11px] text-red-600 font-medium">
            {errors.password.message}
          </span>
        )}
      </div>

      {detailsError && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 font-medium rounded-xs"
        >
          {detailsError}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={sendOtpMutation.isPending}
        className="w-full bg-banner hover:bg-orange-600 text-white min-h-[48px] py-3 mt-1 text-xs md:text-sm font-bold tracking-widest uppercase transition-all flex items-center justify-center gap-2 disabled:opacity-70 shadow-sm cursor-pointer rounded-xs"
      >
        {sendOtpMutation.isPending ? "SENDING VERIFICATION CODE..." : "CREATE ACCOUNT"}
        <span className="text-base leading-none" aria-hidden="true">→</span>
      </button>
    </form>
  );
}

export default RegisterForm;
