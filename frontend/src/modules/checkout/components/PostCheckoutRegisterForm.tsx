import React, { useState, useEffect, useId } from "react";
import { useRegister, useLogin, useForgotPassword, useSendRegisterOtp } from "@/core/hooks/useAuth";
import { apiClient } from "@/core/api/client";
import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/solid";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { EmailOtpVerificationStep } from "@/modules/auth/components/EmailOtpVerificationStep";

const ValidationItem = ({ isValid, text }: { isValid: boolean; text: string }) => (
  <div className="flex items-center gap-2 mb-1">
    {isValid ? (
      <CheckCircleIcon className="w-4 h-4 text-emerald-500 flex-shrink-0" aria-hidden="true" />
    ) : (
      <XCircleIcon className="w-4 h-4 text-neutral-300 flex-shrink-0" aria-hidden="true" />
    )}
    <span className={`text-[10px] ${isValid ? "text-emerald-700 font-medium" : "text-neutral-500"}`}>
      {text}
    </span>
  </div>
);

export interface PostCheckoutRegisterProps {
  email: string;
  name: string;
  phone?: string;
  countryCode?: string;
  shippingAddress?: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
    isDefault?: boolean;
  };
}

export function PostCheckoutRegisterForm({
  email,
  name,
  phone,
  shippingAddress,
}: PostCheckoutRegisterProps) {
  const [password, setPassword] = useState("");
  const [isExistingAccount, setIsExistingAccount] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [resetSent, setResetSent] = useState(false);

  const [step, setStep] = useState<"details" | "otp">("details");
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [sendError, setSendError] = useState("");
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [otpSentEmail, setOtpSentEmail] = useState<string | null>(null);
  const [otpExpiresAt, setOtpExpiresAt] = useState<number>(0);

  const emailFieldId = useId();
  const passwordFieldId = useId();

  const sendOtpMutation = useSendRegisterOtp();
  const registerMutation = useRegister({ disableRedirect: true });
  const loginMutation = useLogin({ disableRedirect: true });
  const forgotMutation = useForgotPassword();
  const router = useRouter();

  const normalizedEmail = (email || "").trim().toLowerCase();

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const handleForgotPassword = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!email) return;
    forgotMutation.mutate(
      { email },
      {
        onSuccess: () => {
          setResetSent(true);
          toast.success(`Password reset link sent to ${email}`);
        },
        onError: (err: any) => {
          toast.error(err.response?.data?.error || "Failed to send reset link");
        },
      }
    );
  };

  // Password validation checks for the UI checklist
  const hasMinLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const hasUpperAndLowerCase = /[A-Z]/.test(password) && /[a-z]/.test(password);
  const hasSymbol = /[^A-Za-z0-9\s]/.test(password);

  const isPasswordValid = hasMinLength && hasNumber && hasUpperAndLowerCase && hasSymbol;

  useEffect(() => {
    setStep("details");
    setOtp("");
    setOtpError("");
    setSendError("");
    setOtpSentEmail(null);
    setOtpExpiresAt(0);
    setCooldownSeconds(0);
    setIsChecking(true);

    let mounted = true;
    const checkEmail = async () => {
      try {
        const res = await apiClient.post("/auth/check-email", { email });
        if (mounted) {
          setIsExistingAccount(res.data?.data?.exists || false);
        }
      } catch {
        // Fallback to non-existing if check fails
      } finally {
        if (mounted) setIsChecking(false);
      }
    };
    checkEmail();
    return () => {
      mounted = false;
    };
  }, [email]);

  useEffect(() => {
    if (registerMutation.isSuccess || loginMutation.isSuccess) {
      const timer = setTimeout(() => {
        router.push("/account/orders");
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [registerMutation.isSuccess, loginMutation.isSuccess, router]);

  const buildSanitizedRegistrationNames = () => {
    const sanitizePart = (str: string) => str.replace(/[^a-zA-Z\s\-']/g, "").trim();
    const cleanedFullName = sanitizePart(name || "");
    const nameParts = cleanedFullName ? cleanedFullName.split(/\s+/) : [];
    let firstName = nameParts[0] || "";
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

    if (!firstName || firstName.length < 2) {
      const emailPrefix = sanitizePart((email || "").split("@")[0] || "");
      firstName = emailPrefix.length >= 2 ? emailPrefix.slice(0, 50) : "Rider";
    }

    return { firstName, lastName };
  };

  const requestOtp = (sourceStep: "details" | "otp" = step) => {
    setOtpError("");
    setSendError("");
    sendOtpMutation.mutate(
      { email: normalizedEmail },
      {
        onSuccess: (res: any) => {
          const ttlSec = Number(res?.data?.expiresInSeconds || 600);
          const cooldownSec = Number(res?.data?.cooldownSeconds || 60);
          setOtpSentEmail(normalizedEmail);
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
            setSendError(message);
          }
        },
      }
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    if (isExistingAccount) {
      const trimmedName = (name || "").trim();
      const nameParts = trimmedName ? trimmedName.split(/\s+/) : [];
      const checkoutFirstName = nameParts[0] || "";
      const checkoutLastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

      loginMutation.mutate(
        { email, password },
        {
          onSuccess: async () => {
            if (checkoutFirstName) {
              try {
                await apiClient.put("/users/me", {
                  firstName: checkoutFirstName,
                  lastName: checkoutLastName,
                });
              } catch {}
            }
            if (shippingAddress && shippingAddress.street) {
              try {
                await apiClient.post("/users/me/addresses", {
                  ...shippingAddress,
                  isDefault: true,
                });
              } catch {}
            }
          },
        }
      );
      return;
    }

    if (!isPasswordValid) return;

    if (otpSentEmail === normalizedEmail && Date.now() < otpExpiresAt) {
      setOtpError("");
      setStep("otp");
      return;
    }

    requestOtp();
  };

  const handleVerifyAndRegister = () => {
    const { firstName, lastName } = buildSanitizedRegistrationNames();

    let cleanPhone = (phone || "").trim();
    if (cleanPhone && !cleanPhone.startsWith("+")) {
      cleanPhone = `+91${cleanPhone}`;
    }

    setOtpError("");
    registerMutation.mutate(
      {
        email: normalizedEmail,
        password,
        firstName,
        lastName: lastName || undefined,
        phone: cleanPhone || undefined,
        otp,
      },
      {
        onSuccess: async () => {
          if (shippingAddress && shippingAddress.street) {
            try {
              await apiClient.post("/users/me/addresses", {
                ...shippingAddress,
                isDefault: true,
              });
            } catch {}
          }
        },
        onError: (err: any) => {
          setOtpError(err?.response?.data?.error || "Verification failed. Please try again.");
        },
      }
    );
  };

  if (isChecking) {
    return (
      <div className="w-full max-w-sm mt-1 mb-4 bg-white border border-neutral-200 p-4 shadow-xs text-left flex items-center justify-center h-[180px]">
        <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (registerMutation.isSuccess || loginMutation.isSuccess) {
    return (
      <div className="w-full max-w-sm mt-1 mb-4 bg-white border border-emerald-200 p-4 shadow-xs text-left h-[200px] flex flex-col items-center justify-center animate-in fade-in duration-300">
        <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mb-3">
          <CheckCircleIcon className="w-6 h-6" />
        </div>
        <h3 className="text-emerald-800 font-bold text-xs tracking-wide uppercase mb-1">
          {loginMutation.isSuccess ? "Logged In Successfully!" : "Account Created!"}
        </h3>
        <div className="flex items-center gap-2 mt-2 text-neutral-500 text-xs font-medium">
          <div className="w-3.5 h-3.5 border-2 border-brand border-t-transparent rounded-full animate-spin"></div>
          Redirecting to your orders...
        </div>
      </div>
    );
  }

  if (!isExistingAccount && step === "otp") {
    return (
      <div className="w-full max-w-sm mt-1 mb-4 bg-white border border-neutral-200 p-4 sm:p-5 shadow-xs text-left">
        <EmailOtpVerificationStep
          email={normalizedEmail}
          otp={otp}
          onOtpChange={(val) => {
            setOtp(val);
            if (otpError) setOtpError("");
          }}
          onSubmitOtp={handleVerifyAndRegister}
          onResendOtp={() => {
            if (cooldownSeconds <= 0) requestOtp("otp");
          }}
          onBack={() => {
            setOtpError("");
            setStep("details");
          }}
          cooldownSeconds={cooldownSeconds}
          isSubmitting={registerMutation.isPending}
          isResending={sendOtpMutation.isPending}
          errorMessage={otpError}
          backLabel="Edit password"
          submitLabel="Verify & Track Order"
          compact
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm mt-1 mb-4 bg-white border border-neutral-200 p-4 sm:p-5 shadow-xs text-left">
      <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900 mb-1">
        {isExistingAccount ? "Sign In & Track" : "Track Your Order"}
      </h3>
      <p className="text-[11px] text-neutral-500 mb-3 leading-normal">
        {isExistingAccount
          ? "This email is already registered. Please sign in to track your order."
          : "Create an account to easily track this order. We'll verify your email with a quick 6-digit OTP."}
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
        {sendError && (
          <div role="alert" className="bg-red-50 border border-red-100 p-2 rounded text-red-800 text-[11px] font-medium">
            {sendError}
          </div>
        )}

        {loginMutation.isError && (
          <div role="alert" className="bg-red-50 border border-red-100 p-2 rounded text-red-800 text-[11px] font-medium">
            {(loginMutation.error as any)?.response?.data?.error || "Invalid credentials. Please verify your password."}
          </div>
        )}

        {resetSent && (
          <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded text-emerald-900 text-[11px] leading-relaxed">
            <div className="flex items-center gap-1.5 font-bold text-emerald-800 mb-0.5">
              <CheckCircleIcon className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Reset Link Sent Directly to Email!</span>
            </div>
            <p className="text-emerald-700">
              We sent a password reset link to <strong>{email}</strong>. Check your inbox and click the button inside to set your password.
            </p>
            <div className="mt-1.5 pt-1 border-t border-emerald-100 flex items-center justify-between text-[10px]">
              <span className="text-neutral-500">Didn&apos;t get the email?</span>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={forgotMutation.isPending}
                className="font-bold text-brand hover:underline cursor-pointer disabled:opacity-50"
              >
                {forgotMutation.isPending ? "Sending..." : "Resend Link"}
              </button>
            </div>
          </div>
        )}

        <div>
          <label
            htmlFor={emailFieldId}
            className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-0.5 block"
          >
            Email (Auto-linked for tracking)
          </label>
          <input
            id={emailFieldId}
            type="email"
            value={email}
            disabled
            className="w-full border border-neutral-200 bg-neutral-100 px-3 py-2 text-base md:text-xs text-neutral-600 rounded-none cursor-not-allowed"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-0.5">
            <label
              htmlFor={passwordFieldId}
              className="text-[10px] font-bold uppercase tracking-wider text-neutral-700 block"
            >
              {isExistingAccount ? "Enter Password *" : "Set a Password *"}
            </label>
            {isExistingAccount && (
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={forgotMutation.isPending}
                className="text-[10px] font-semibold text-brand hover:underline cursor-pointer disabled:opacity-50"
              >
                {forgotMutation.isPending ? "Sending link..." : "Forgot password?"}
              </button>
            )}
          </div>
          <input
            id={passwordFieldId}
            type="password"
            autoComplete={isExistingAccount ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isExistingAccount ? "Your password" : "Min 8 characters"}
            required
            className="w-full border border-neutral-300 focus:border-brand px-3 py-2 text-base md:text-xs text-neutral-900 focus:outline-none rounded-none transition-colors"
          />
        </div>

        {!isExistingAccount && (
          <div className="bg-neutral-50 p-2.5 rounded border border-neutral-100">
            <ValidationItem isValid={hasMinLength} text="Minimum 8 characters" />
            <ValidationItem isValid={hasNumber} text="Must contain at least 1 number" />
            <ValidationItem isValid={hasUpperAndLowerCase} text="Must contain capital and lowercase letters" />
            <ValidationItem isValid={hasSymbol} text="Must contain at least 1 special character" />
          </div>
        )}

        <button
          type="submit"
          disabled={
            sendOtpMutation.isPending ||
            registerMutation.isPending ||
            loginMutation.isPending ||
            !password ||
            (!isExistingAccount && !isPasswordValid)
          }
          className="w-full bg-neutral-900 hover:bg-black text-white min-h-[44px] text-[11px] font-bold uppercase tracking-wider py-2.5 transition-colors disabled:opacity-50 rounded-none cursor-pointer"
        >
          {isExistingAccount
            ? loginMutation.isPending
              ? "Logging in..."
              : "Log In & Track Order"
            : sendOtpMutation.isPending
              ? "Sending OTP..."
              : "Verify Email & Create Account"}
        </button>
      </form>
    </div>
  );
}
