import React, { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDownIcon, CheckIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { COUNTRIES } from "@/core/utils/countries";

interface DialCodeSelectProps {
  value: string; // ISO Country Code (e.g., 'US', 'IN')
  onChange: (countryCode: string) => void;
}

export const DialCodeSelect: React.FC<DialCodeSelectProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Find the country matching the selected ISO code
  const selectedCountry = COUNTRIES.find((c) => c.code === value) || COUNTRIES.find(c => c.code === "IN") || COUNTRIES[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setSearchQuery("");
    }
  }, [isOpen]);

  const filteredCountries = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return COUNTRIES.filter(
      (c) => 
        c.name.toLowerCase().includes(query) || 
        c.dialCode.toLowerCase().includes(query) ||
        c.aliases?.some(alias => alias.includes(query))
    );
  }, [searchQuery]);

  return (
    <div className="relative shrink-0 w-[104px] sm:w-[125px]" ref={dropdownRef}>
      <div
        className="w-full h-full border border-slate-300 hover:border-slate-400 focus-within:border-slate-900 rounded-l-lg px-2.5 sm:px-3 py-2.5 sm:py-3 text-sm text-neutral-900 bg-slate-50 hover:bg-white cursor-pointer flex items-center justify-between transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-hidden">
          <img 
            src={`https://flagcdn.com/w40/${selectedCountry.code.toLowerCase()}.png`} 
            alt={`${selectedCountry.name} flag`}
            className="w-[18px] sm:w-[22px] h-auto shadow-[0_0_2px_rgba(0,0,0,0.2)] rounded-[2px] shrink-0"
          />
          <span className="font-medium text-neutral-900 truncate text-xs sm:text-sm">({selectedCountry.dialCode})</span>
        </div>
        <ChevronDownIcon className={`w-3.5 h-3.5 text-neutral-500 transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180" : ""}`} />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 w-[min(260px,calc(100vw-2rem))] mt-1.5 bg-white border border-slate-200 shadow-xl rounded-xl z-50 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-slate-100 bg-slate-50/70">
            <div className="relative">
              <MagnifyingGlassIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm text-neutral-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition-colors"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto custom-scrollbar p-1.5">
            {filteredCountries.length > 0 ? (
              filteredCountries.map((country) => (
                <div
                  key={`${country.code}-${country.dialCode}`}
                  onClick={() => {
                    onChange(country.code);
                    setIsOpen(false);
                  }}
                  className={`flex items-center gap-3 px-3 py-2 cursor-pointer rounded-lg my-0.5 transition-colors ${
                    value === country.code
                      ? "bg-slate-100 text-slate-950"
                      : "hover:bg-slate-50 text-slate-700 hover:text-slate-950"
                  }`}
                >
                  <img 
                    src={`https://flagcdn.com/w40/${country.code.toLowerCase()}.png`} 
                    alt={`${country.name} flag`}
                    className="w-6 h-auto shadow-[0_0_2px_rgba(0,0,0,0.2)] rounded-[2px]"
                  />
                  <span className={`flex-1 truncate text-xs ${value === country.code ? 'font-bold' : 'font-medium'}`}>{country.name}</span>
                  <span className={`text-xs font-semibold ${value === country.code ? 'text-slate-900' : 'text-slate-500'}`}>
                    {country.dialCode}
                  </span>
                  {value === country.code && (
                    <CheckIcon className="w-4 h-4 text-slate-900" />
                  )}
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-sm font-medium text-neutral-500">
                Not found.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
