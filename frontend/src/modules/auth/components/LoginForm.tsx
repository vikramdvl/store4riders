"use client";

import React, { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLogin } from "@/core/hooks/useAuth";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/solid";
import Link from "next/link";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});
type LoginFormInputs = z.infer<typeof loginSchema>;

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const emailId = useId();
  const passwordId = useId();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormInputs>({
    resolver: zodResolver(loginSchema),
  });

  const loginMutation = useLogin({ scope: "customer" });

  return (
    <form onSubmit={handleSubmit(data => loginMutation.mutate(data))} className="flex flex-col gap-4 w-full" noValidate>
      
      {/* Email Input */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={emailId} className="text-[10px] md:text-xs uppercase tracking-wider font-semibold text-neutral-600">
          Email Address
        </label>
        <input
          id={emailId}
          type="email"
          autoComplete="email"
          aria-invalid={errors.email ? "true" : "false"}
          className={`w-full border ${errors.email ? "border-red-500 bg-red-50/20" : "border-neutral-300"} p-2.5 md:p-3 text-base md:text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:border-banner rounded-xs transition-colors bg-neutral-50/50 focus:bg-white`}
          {...register("email")}
        />
        {errors.email && (
          <span role="alert" className="text-[11px] text-red-600 font-medium">{errors.email.message}</span>
        )}
      </div>

      {/* Password Input */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={passwordId} className="text-[10px] md:text-xs uppercase tracking-wider font-semibold text-neutral-600">
          Password
        </label>
        <div className="relative">
          <input
            id={passwordId}
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            aria-invalid={errors.password ? "true" : "false"}
            className={`w-full border ${errors.password ? "border-red-500 bg-red-50/20" : "border-neutral-300"} p-2.5 md:p-3 pr-11 text-base md:text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:border-banner rounded-xs transition-colors bg-neutral-50/50 focus:bg-white`}
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
              <EyeIcon className="w-4 h-4" />
            ) : (
              <EyeSlashIcon className="w-4 h-4" />
            )}
          </button>
        </div>
        {errors.password && (
          <span role="alert" className="text-[11px] text-red-600 font-medium">{errors.password.message}</span>
        )}
        <div className="flex justify-end">
          <Link 
            href="/forgot-password" 
            className="text-[10px] md:text-xs font-medium text-neutral-500 hover:text-banner transition-colors uppercase tracking-wider"
          >
            Forgot Password?
          </Link>
        </div>
      </div>

      {/* Submit Button */}
      <button 
        type="submit" 
        disabled={loginMutation.isPending}
        className="w-full bg-banner hover:bg-orange-600 text-white py-3.5 mt-1 text-xs md:text-sm font-bold tracking-widest uppercase transition-all flex items-center justify-center gap-2 disabled:opacity-70 shadow-sm cursor-pointer rounded-xs"
      >
        {loginMutation.isPending ? "SIGNING IN..." : "LOGIN"} 
        <span className="text-base leading-none">→</span>
      </button>

    </form>
  );
}

export default LoginForm;
