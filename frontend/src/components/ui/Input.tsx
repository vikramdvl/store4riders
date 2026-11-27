"use client";

import React, { forwardRef, memo, useId } from "react";
import { AlertCircle } from "lucide-react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: React.ReactNode;
  hint?: React.ReactNode;
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className = "",
      error,
      label,
      hint,
      leftIcon,
      rightElement,
      id,
      min,
      onKeyDown,
      onChange,
      "aria-describedby": ariaDescribedBy,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const hintId = hint ? `${inputId}-hint` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;

    const describedBy = [ariaDescribedBy, hintId, errorId]
      .filter(Boolean)
      .join(" ") || undefined;

    const isNumber = props.type === "number";
    const resolvedMin = min !== undefined ? min : isNumber ? 0 : undefined;

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (
        isNumber &&
        (e.key === "-" || e.key === "e" || e.key === "E" || e.key === "+")
      ) {
        e.preventDefault();
      }
      onKeyDown?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isNumber && e.target.value !== "") {
        const num = Number(e.target.value);
        if (!isNaN(num) && num < 0) {
          e.target.value = "0";
        }
      }
      onChange?.(e);
    };

    return (
      <div className="w-full flex flex-col gap-1">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-semibold text-zinc-600 uppercase tracking-wider mb-0.5"
          >
            {label}
          </label>
        )}
        {hint && (
          <div id={hintId} className="text-xs text-zinc-500 mb-1">
            {hint}
          </div>
        )}
        <div className="relative flex items-center w-full">
          {leftIcon && (
            <div className="absolute left-3.5 text-zinc-400 pointer-events-none flex items-center">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            min={resolvedMin}
            onKeyDown={handleKeyDown}
            onChange={handleChange}
            aria-invalid={error ? "true" : "false"}
            aria-describedby={describedBy}
            className={`flex min-h-[46px] h-11 sm:h-11 w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-base sm:text-sm text-zinc-900 transition-all placeholder:text-zinc-400 focus-visible:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500 ${
              leftIcon ? "pl-10" : ""
            } ${rightElement ? "pr-11" : ""} ${
              error
                ? "border-red-500 bg-red-50/30 focus-visible:border-red-500 focus-visible:ring-red-500/20"
                : "hover:border-zinc-400"
            } ${className}`}
            {...props}
          />
          {rightElement && (
            <div className="absolute right-1.5 flex items-center">
              {rightElement}
            </div>
          )}
        </div>
        {error && (
          <span
            id={errorId}
            role="alert"
            className="inline-flex items-center gap-1.5 text-xs text-red-600 font-medium mt-1"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </span>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";
export default memo(Input);
