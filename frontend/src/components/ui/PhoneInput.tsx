"use client";

import React, { forwardRef, useState, useMemo, useRef, useEffect, useId } from "react";
import PhoneInputLib from "react-phone-number-input";
import { Search, ChevronDown, AlertCircle } from "lucide-react";
import "react-phone-number-input/style.css";

const CustomCountrySelect = forwardRef<HTMLButtonElement, any>(
  ({ value, onChange, options, iconComponent: Icon, disabled }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on click outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredOptions = useMemo(() => {
      if (!search) return options.filter((o: any) => o.value);
      const s = search.toLowerCase();
      return options.filter((o: any) => o.value && o.label.toLowerCase().includes(s));
    }, [options, search]);

    const selectedOption =
      options.find((o: any) => o.value === value) ||
      options.find((o: any) => o.value === "IN") ||
      options[0];

    return (
      <div className="relative flex items-center h-full border-r border-zinc-200" ref={dropdownRef}>
        <button
          type="button"
          ref={ref}
          disabled={disabled}
          aria-label={`Selected country: ${selectedOption?.label || "India"}`}
          aria-expanded={isOpen}
          onClick={(e) => {
            e.preventDefault();
            if (!disabled) setIsOpen(!isOpen);
          }}
          className={`flex items-center gap-2 px-3 h-full min-h-[44px] transition-colors rounded-l-lg outline-none focus-visible:ring-2 focus-visible:ring-brand/30 ${
            disabled ? "opacity-60 cursor-not-allowed hover:bg-transparent" : "hover:bg-zinc-50"
          }`}
        >
          <div className="w-6 h-4 overflow-hidden rounded-sm flex items-center justify-center shadow-sm border border-zinc-100 bg-zinc-50">
            {Icon && <Icon country={selectedOption?.value} label={selectedOption?.label} />}
          </div>
          <ChevronDown size={14} className="text-zinc-400" aria-hidden="true" />
        </button>

        {isOpen && (
          <div className="absolute top-12 left-0 w-64 z-50 rounded-xl shadow-xl border border-zinc-200 bg-white/95 backdrop-blur-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-2 border-b border-zinc-200/50 bg-white">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search country..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (filteredOptions.length > 0) {
                        onChange(filteredOptions[0].value);
                        setIsOpen(false);
                        setSearch("");
                      }
                    } else if (e.key === "Escape") {
                      setIsOpen(false);
                    }
                  }}
                  className="w-full bg-white border border-zinc-200 rounded-lg pl-8 pr-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all"
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
              {filteredOptions.length === 0 ? (
                <div className="p-3 text-center text-sm text-zinc-500">No countries found</div>
              ) : (
                filteredOptions.map((option: any) => {
                  const isSelected = option.value === value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        onChange(option.value);
                        setIsOpen(false);
                        setSearch("");
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-md transition-colors ${
                        isSelected ? "bg-brand/10 text-brand font-medium" : "hover:bg-zinc-100 text-zinc-700"
                      }`}
                    >
                      <div className="w-6 h-4 overflow-hidden rounded-sm flex items-center justify-center shadow-sm border border-zinc-100 bg-zinc-50 flex-shrink-0">
                        {Icon && <Icon country={option.value} label={option.label} />}
                      </div>
                      <span className="flex-1 text-left truncate">{option.label.split(" +")[0]}</span>
                      <span className="text-xs font-mono text-zinc-400">+{option.label.split("+")[1]}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
);
CustomCountrySelect.displayName = "CustomCountrySelect";

export interface PhoneInputProps {
  id?: string;
  value?: string;
  onChange?: (value: string | undefined) => void;
  error?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
}

const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ id, value, onChange, error, label, disabled, className = "" }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const errorId = error ? `${inputId}-error` : undefined;

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
        <div
          className={`
          flex w-full items-center rounded-lg border bg-white min-h-[46px] h-11 transition-all shadow-2xs focus-within:ring-2 focus-within:ring-brand/20 focus-within:border-brand
          ${error ? "border-red-500 bg-red-50/30 focus-within:border-red-500 focus-within:ring-red-500/20" : "border-zinc-300 hover:border-zinc-400"}
          ${disabled ? "cursor-not-allowed bg-zinc-50 opacity-70" : ""}
          ${className}
        `}
        >
          <PhoneInputLib
            defaultCountry="IN"
            international
            limitMaxLength
            countryCallingCodeEditable={false}
            value={value && !value.startsWith("+") ? `+91${value}` : value}
            onChange={onChange || (() => {})}
            disabled={disabled}
            className="w-full h-full flex items-center PhoneInput--premium"
            countrySelectComponent={CustomCountrySelect}
            numberInputProps={{
              id: inputId,
              ref,
              autoComplete: "tel",
              "aria-invalid": error ? "true" : "false",
              "aria-describedby": errorId,
              className:
                "w-full h-full bg-transparent border-none outline-none focus:ring-0 px-3 text-base sm:text-sm text-zinc-900 placeholder:text-zinc-400 font-medium tracking-wide",
            }}
          />
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
PhoneInput.displayName = "PhoneInput";
export default React.memo(PhoneInput);
