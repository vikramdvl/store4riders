import React from "react";
import { TruckIcon, CreditCardIcon, CheckIcon } from "@heroicons/react/24/outline";

interface CheckoutStepperProps {
  currentStep: number;
  validateStep1?: () => boolean;
  validateStep2?: () => boolean;
  setCurrentStep?: (step: 1 | 2) => void;
}

export const CheckoutStepper = ({ 
  currentStep,
  setCurrentStep,
}: CheckoutStepperProps) => {
  const canJumpBackToStep1 = currentStep === 2 && Boolean(setCurrentStep);

  return (
    <div className="bg-white rounded-xl px-3.5 py-2.5 sm:px-5 sm:py-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] border border-slate-200/90 mb-4 sm:mb-5 w-full flex items-center justify-between sm:justify-start gap-2.5 sm:gap-6">
      {/* Step 1: Shipping & Details */}
      <button
        type="button"
        disabled={!canJumpBackToStep1}
        onClick={() => canJumpBackToStep1 && setCurrentStep?.(1)}
        className={`flex items-center gap-2 sm:gap-3 text-left select-none shrink-0 bg-transparent border-0 p-0 ${
          canJumpBackToStep1 ? "cursor-pointer group" : "cursor-default"
        }`}
      >
        <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center transition-colors duration-200 shrink-0 ${
          currentStep === 1 
            ? "bg-slate-900 text-white" 
            : currentStep > 1 
            ? "bg-emerald-600 text-white" 
            : "bg-slate-100 text-slate-400"
        }`}>
          {currentStep > 1 ? (
            <CheckIcon className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.5]" />
          ) : (
            <TruckIcon className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2]" />
          )}
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[9px] sm:text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Step 1</span>
          <span className={`text-[11px] sm:text-xs font-bold uppercase tracking-wide whitespace-nowrap transition-colors ${
            currentStep === 1 ? "text-slate-900" : currentStep > 1 ? "text-slate-800 group-hover:text-slate-950" : "text-slate-400"
          }`}>
            Shipping & Details
          </span>
        </div>
      </button>

      {/* Progress Track */}
      <div className="h-1 rounded-full bg-slate-200/80 flex-1 min-w-[20px] sm:flex-none sm:w-20 overflow-hidden">
        <div 
          className={`h-full transition-all duration-300 ${
            currentStep > 1 ? "w-full bg-emerald-600" : "w-1/2 bg-slate-900"
          }`} 
        />
      </div>

      {/* Step 2: Payment */}
      <div className="flex items-center gap-2 sm:gap-3 text-left cursor-default select-none shrink-0">
        <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center transition-colors duration-200 shrink-0 ${
          currentStep === 2 
            ? "bg-slate-900 text-white" 
            : currentStep > 2 
            ? "bg-emerald-600 text-white" 
            : "bg-slate-100 text-slate-400"
        }`}>
          {currentStep > 2 ? (
            <CheckIcon className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.5]" />
          ) : (
            <CreditCardIcon className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2]" />
          )}
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[9px] sm:text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Step 2</span>
          <span className={`text-[11px] sm:text-xs font-bold uppercase tracking-wide whitespace-nowrap transition-colors ${
            currentStep === 2 ? "text-slate-900" : currentStep > 2 ? "text-slate-800" : "text-slate-400"
          }`}>
            Payment
          </span>
        </div>
      </div>
    </div>
  );
};
