import React from "react";
import Link from "next/link";
import { formatPrice, validateIndianMobile } from "@store4riders/shared-utils";
import { ChevronDownIcon, TruckIcon, UserIcon } from "@heroicons/react/24/outline";
import { IUserAddress } from "@store4riders/shared-types";
import { useShippingServiceability } from "@/core/hooks/useShippingServiceability";
import { useIndianStates } from "@/core/hooks/useIndianStates";
import { usePincodeLookup } from "@/core/hooks/usePincodeLookup";
import { DialCodeSelect } from "./DialCodeSelect";
import { COUNTRIES } from "@/core/utils/countries";

interface CheckoutShippingDeliveryProps {
  formData: {
    name?: string;
    countryCode?: string;
    phone?: string;
    altPhone?: string;
    email?: string;
    isB2b?: boolean;
    businessName?: string;
    customerGstin?: string;
    address: string;
    state: string;
    city: string;
    pinCode: string;
    country?: string;
    [key: string]: any;
  };
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  setErrorMessage: (msg: string) => void;
  errorMessage: string;
  fieldErrors?: Record<string, string>;
  setFieldErrors?: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setCurrentStep: (step: 1 | 2) => void;
  handleContinueToPayment: () => void;
  shippingCost: number;
  freeShippingThreshold: number;
  savedAddresses: IUserAddress[];
  selectedAddressId: string | null;
  onSelectAddress: (id: string) => void;
  showAddressForm: boolean;
  onToggleAddressForm: (show: boolean) => void;
  isAddingAddress?: boolean;
  onDeleteAddress?: (id: string) => void;
  editingAddressId?: string | null;
  setEditingAddressId?: (id: string | null) => void;
  cartWeightKg: number;
  setIsCodAvailable: (avail: boolean) => void;
  total?: number;
}

export const CheckoutShippingDelivery = ({
  formData,
  handleInputChange,
  setErrorMessage,
  errorMessage,
  fieldErrors = {},
  setFieldErrors,
  setCurrentStep,
  handleContinueToPayment,
  shippingCost,
  freeShippingThreshold,
  savedAddresses,
  selectedAddressId,
  onSelectAddress,
  showAddressForm,
  onToggleAddressForm,
  isAddingAddress,
  onDeleteAddress,
  editingAddressId,
  setEditingAddressId,
  cartWeightKg,
  setIsCodAvailable,
  total
}: CheckoutShippingDeliveryProps) => {
  const { data: indianStates = [] } = useIndianStates();
  const { data: pincodeData, isFetching: isPincodeLoading } = usePincodeLookup(
    formData.pinCode && formData.pinCode.length === 6 ? formData.pinCode : ""
  );

  const activePincode = React.useMemo(() => {
    if (!showAddressForm && selectedAddressId) {
      const addr = savedAddresses.find(a => (a.id || String((a as any)._id)) === selectedAddressId);
      return addr?.pincode || "";
    }
    if (showAddressForm) {
      return formData.pinCode;
    }
    return "";
  }, [showAddressForm, selectedAddressId, savedAddresses, formData.pinCode]);

  const { data: serviceabilityData, isLoading: isCheckingServiceability } = useShippingServiceability({
    pincode: activePincode,
    weightKg: cartWeightKg,
    isCod: false // We check general serviceability here
  });

  React.useEffect(() => {
    if (serviceabilityData) {
      setIsCodAvailable(serviceabilityData.codAvailable);
    } else {
      setIsCodAvailable(true); // Default to true if not checked or error
    }
  }, [serviceabilityData, setIsCodAvailable]);

  const isNotServiceable = activePincode.length === 6 && serviceabilityData && !serviceabilityData.serviceable;

  const currentCountry = COUNTRIES.find((c) => c.code === (formData.countryCode || "IN"));
  const maxPhoneLength = currentCountry?.phoneLength ? Math.max(...currentCountry.phoneLength) : 15;

  return (
    <div className="flex flex-col gap-4 sm:gap-5 animate-in fade-in duration-300">
      
      {/* Section 1: Contact Information */}
      <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)] border border-slate-200/90 flex flex-col gap-4 sm:gap-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="font-sans font-bold text-base sm:text-lg text-slate-900 tracking-tight uppercase flex items-center gap-2 sm:gap-2.5">
              <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
              <span>CONTACT INFORMATION</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Enter your contact details so we can send you order confirmation and updates.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
          {/* Name */}
          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <label htmlFor="name" className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
              NAME *
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              maxLength={50}
              placeholder="Enter your full name"
              value={formData.name || ""}
              onChange={handleInputChange}
              className={`w-full border ${fieldErrors.name ? 'border-red-500 bg-red-50/30 ring-2 ring-red-500/15' : 'border-slate-300 bg-white hover:border-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10'} rounded-lg px-3.5 sm:px-4 py-2.5 sm:py-3 text-base md:text-sm text-slate-900 focus:outline-none transition-colors`}
            />
            {fieldErrors.name && <span className="text-red-500 text-xs font-semibold animate-in fade-in zoom-in-95 duration-200">{fieldErrors.name}</span>}
          </div>

          {/* Phone Number with Flag selector */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="phone" className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
              MOBILE NUMBER *
            </label>
            <div className="flex items-center gap-0">
              <DialCodeSelect
                value={formData.countryCode || "IN"}
                onChange={(val) => handleInputChange({ target: { name: "countryCode", value: val } } as any)}
              />
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                maxLength={maxPhoneLength}
                placeholder="10-digit mobile number"
                value={formData.phone || ""}
                onChange={handleInputChange}
                onBlur={() => {
                  const isIndia = formData.countryCode === "IN" || !formData.countryCode;
                  if (isIndia && formData.phone && setFieldErrors) {
                    const check = validateIndianMobile(formData.phone);
                    if (!check.isValid) {
                      setFieldErrors(prev => ({ ...prev, phone: check.error || "Please enter a valid mobile number." }));
                    }
                  }
                }}
                className={`w-full min-w-0 border ${fieldErrors.phone ? 'border-red-500 bg-red-50/30 ring-2 ring-red-500/15' : 'border-slate-300 bg-white hover:border-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10'} rounded-r-lg px-3 sm:px-4 py-2.5 sm:py-3 text-base md:text-sm text-slate-900 focus:outline-none transition-colors border-l-0`}
              />
            </div>
            {fieldErrors.phone && <span className="text-red-500 text-xs font-semibold animate-in fade-in zoom-in-95 duration-200">{fieldErrors.phone}</span>}
          </div>

          {/* Alternate Phone Number */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="altPhone" className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
              ALTERNATE PHONE NUMBER
            </label>
            <input
              id="altPhone"
              name="altPhone"
              type="tel"
              maxLength={maxPhoneLength}
              placeholder="Alternate number (optional)"
              value={formData.altPhone || ""}
              onChange={handleInputChange}
              onBlur={() => {
                const isIndia = formData.countryCode === "IN" || !formData.countryCode;
                if (isIndia && formData.altPhone && setFieldErrors) {
                  const check = validateIndianMobile(formData.altPhone);
                  if (!check.isValid) {
                    setFieldErrors(prev => ({ ...prev, altPhone: check.error || "Please enter a valid alternate mobile number." }));
                  }
                }
              }}
              className={`w-full border ${fieldErrors.altPhone ? 'border-red-500 bg-red-50/30 ring-2 ring-red-500/15' : 'border-slate-300 bg-white hover:border-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10'} rounded-lg px-3.5 sm:px-4 py-2.5 sm:py-3 text-base md:text-sm text-slate-900 focus:outline-none transition-colors`}
            />
            {fieldErrors.altPhone && <span className="text-red-500 text-xs font-semibold animate-in fade-in zoom-in-95 duration-200">{fieldErrors.altPhone}</span>}
          </div>

          {/* Email Address */}
          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <label htmlFor="email" className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
              EMAIL ADDRESS *
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              maxLength={100}
              placeholder="Enter your email address"
              value={formData.email || ""}
              onChange={handleInputChange}
              className={`w-full border ${fieldErrors.email ? 'border-red-500 bg-red-50/30 ring-2 ring-red-500/15' : 'border-slate-300 bg-white hover:border-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10'} rounded-lg px-3.5 sm:px-4 py-2.5 sm:py-3 text-base md:text-sm text-slate-900 focus:outline-none transition-colors`}
            />
            {fieldErrors.email && <span className="text-red-500 text-xs font-semibold animate-in fade-in zoom-in-95 duration-200">{fieldErrors.email}</span>}
          </div>

          {/* Optional B2B Business & GSTIN Information */}
          <div className="sm:col-span-2 pt-3 border-t border-slate-100">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                name="isB2b"
                checked={Boolean(formData.isB2b)}
                onChange={(e) => {
                  handleInputChange({
                    target: { name: "isB2b", value: e.target.checked }
                  } as any);
                }}
                className="w-4 h-4 text-slate-900 rounded border-slate-300 focus:ring-slate-900 cursor-pointer accent-slate-900"
              />
              <span className="text-xs font-semibold text-slate-800">
                Buying for business? Add GST details for Tax Invoice / Input Tax Credit (ITC)
              </span>
            </label>

            {formData.isB2b && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-3 p-3.5 sm:p-4 bg-slate-50 border border-slate-200 rounded-xl animate-in fade-in duration-200">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="businessName" className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                    COMPANY / BUSINESS NAME *
                  </label>
                  <input
                    id="businessName"
                    name="businessName"
                    type="text"
                    required={Boolean(formData.isB2b)}
                    placeholder="Registered company name"
                    value={formData.businessName || ""}
                    onChange={handleInputChange}
                    className={`w-full border ${fieldErrors?.businessName ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300'} bg-white rounded-lg px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 focus:outline-none transition-colors`}
                  />
                  {fieldErrors?.businessName && (
                    <span className="text-red-500 text-xs font-semibold animate-in fade-in zoom-in-95 duration-200">{fieldErrors.businessName}</span>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="customerGstin" className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                    COMPANY GSTIN (15 DIGITS) *
                  </label>
                  <input
                    id="customerGstin"
                    name="customerGstin"
                    type="text"
                    maxLength={15}
                    required={Boolean(formData.isB2b)}
                    placeholder="e.g. 27AAPCS1234F1Z5"
                    value={formData.customerGstin || ""}
                    onChange={(e) => {
                      handleInputChange({
                        target: { name: "customerGstin", value: e.target.value.toUpperCase() }
                      } as any);
                    }}
                    className={`w-full border ${fieldErrors?.customerGstin ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300'} bg-white rounded-lg px-3.5 py-2.5 text-sm text-slate-900 font-mono uppercase tracking-wider focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 focus:outline-none transition-colors`}
                  />
                  {fieldErrors?.customerGstin && (
                    <span className="text-red-500 text-xs font-semibold animate-in fade-in zoom-in-95 duration-200">{fieldErrors.customerGstin}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 2: Address Detail */}
      <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)] border border-slate-200/90 flex flex-col gap-4 sm:gap-5">
        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
          <div className="min-w-0">
            <h2 className="font-sans font-bold text-base sm:text-lg text-slate-900 tracking-tight uppercase flex items-center gap-2 sm:gap-2.5">
              <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
              <span>DELIVERY ADDRESS</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Where should we deliver your order?
            </p>
          </div>
          {!showAddressForm && (
            <button
              type="button"
              onClick={() => {
                // Clear address form for new entry
                handleInputChange({ target: { name: "address", value: "" } } as any);
                handleInputChange({ target: { name: "city", value: "" } } as any);
                handleInputChange({ target: { name: "state", value: "" } } as any);
                handleInputChange({ target: { name: "pinCode", value: "" } } as any);
                handleInputChange({ target: { name: "country", value: "IN" } } as any);
                setEditingAddressId?.(null);
                onToggleAddressForm(true);
              }}
              className="rounded-lg bg-slate-900 hover:bg-black text-white text-[11px] sm:text-xs font-bold uppercase px-3 sm:px-3.5 py-1.5 transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>+</span>
              <span className="sm:hidden">NEW ADDRESS</span>
              <span className="hidden sm:inline">ADD NEW ADDRESS</span>
            </button>
          )}
        </div>

        {!showAddressForm && savedAddresses.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            {savedAddresses.map((addr) => {
              const id = addr.id || String((addr as any)._id);
              const isSelected = selectedAddressId === id;
              return (
                <div 
                  key={id}
                  className={`rounded-xl transition-colors duration-150 ${
                    isSelected 
                      ? 'border-[1.5px] border-slate-900 bg-slate-50/70' 
                      : 'border border-slate-200 bg-white hover:border-slate-300'
                  } p-3.5 sm:p-4 flex flex-col gap-2.5 relative`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2.5 sm:gap-3">
                    <div 
                      className="flex items-start gap-3 flex-1 cursor-pointer min-w-0"
                      onClick={() => onSelectAddress(id)}
                    >
                      <div className="mt-0.5 shrink-0">
                        <div className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'border-slate-900 bg-slate-900' : 'border-slate-300 bg-white'}`}>
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
                          <span className="font-bold text-sm text-slate-900">{formData.name || "Customer"}</span>
                          <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold uppercase border border-slate-200">
                            {addr.isDefault ? "DEFAULT" : "HOME"}
                          </span>
                          {formData.phone && (
                            <span className="text-xs text-slate-600 font-medium">{formData.countryCode || "+91"} {formData.phone}</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed font-sans break-words">
                          {addr.street}, {addr.city}, {addr.state} - <span className="font-semibold text-slate-900">{addr.pincode}</span>
                        </p>
                        {isSelected && (
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            {isCheckingServiceability ? (
                              <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                                <span className="w-2.5 h-2.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                                Checking courier coverage...
                              </span>
                            ) : serviceabilityData?.serviceable ? (
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                                <svg className="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                                Deliverable to {addr.pincode} {serviceabilityData.estimatedDays ? `(~${serviceabilityData.estimatedDays} days)` : ""}
                              </span>
                            ) : isNotServiceable ? (
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-red-700 bg-red-50 px-2.5 py-0.5 rounded-md border border-red-200">
                                <svg className="w-3.5 h-3.5 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Delivery Not Available to {addr.pincode}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Edit & Delete Buttons */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 sm:pt-0 sm:border-t-0 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInputChange({ target: { name: "address", value: addr.street } } as any);
                          handleInputChange({ target: { name: "city", value: addr.city } } as any);
                          handleInputChange({ target: { name: "state", value: addr.state } } as any);
                          handleInputChange({ target: { name: "pinCode", value: addr.pincode } } as any);
                          handleInputChange({ target: { name: "country", value: "IN" } } as any);
                          onSelectAddress(id);
                          setEditingAddressId?.(id);
                          onToggleAddressForm(true);
                        }}
                        className="text-[11px] sm:text-xs font-bold text-slate-700 hover:text-slate-950 uppercase tracking-wider px-2.5 py-1 rounded-md hover:bg-slate-200/60 transition-colors cursor-pointer"
                      >
                        EDIT
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteAddress?.(id);
                        }}
                        className="text-[11px] sm:text-xs font-bold text-slate-400 hover:text-red-600 uppercase tracking-wider px-2.5 py-1 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
                      >
                        DELETE
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-4 border border-slate-200 bg-slate-50/60 rounded-xl p-3.5 sm:p-5">
            {/* Header when editing or adding address */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                {editingAddressId ? "EDIT ADDRESS" : "ADD A NEW ADDRESS"}
              </span>
              {savedAddresses.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onToggleAddressForm(false);
                    setEditingAddressId?.(null);
                  }}
                  className="rounded-lg border border-slate-300 hover:border-slate-900 bg-white text-slate-700 hover:text-slate-950 text-xs font-bold uppercase px-3 py-1.5 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  ✕ CANCEL
                </button>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="address" className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                DETAILED ADDRESS (HOUSE / FLAT / STREET) *
              </label>
              <input
                id="address"
                name="address"
                type="text"
                required
                maxLength={200}
                placeholder="House/Flat No., Building Name, Street"
                value={formData.address}
                onChange={handleInputChange}
                className={`w-full border ${fieldErrors.address ? 'border-red-500 bg-red-50/30 ring-2 ring-red-500/15' : 'border-slate-300 bg-white focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10'} rounded-lg px-3.5 sm:px-4 py-2.5 sm:py-3 text-base md:text-sm text-slate-900 focus:outline-none transition-colors`}
              />
              {fieldErrors.address && <span className="text-red-500 text-xs font-semibold animate-in fade-in zoom-in-95 duration-200">{fieldErrors.address}</span>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Pin Code (FIRST) */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="pinCode" className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                  <span>PIN CODE *</span>
                  {isPincodeLoading && (
                    <span className="text-[10px] text-slate-600 font-semibold flex items-center gap-1">
                      <span className="w-2.5 h-2.5 border-2 border-slate-700 border-t-transparent rounded-full animate-spin inline-block" />
                      Checking...
                    </span>
                  )}
                </label>
                <input
                  id="pinCode"
                  name="pinCode"
                  type="text"
                  required
                  maxLength={6}
                  placeholder="6-digit PIN"
                  value={formData.pinCode}
                  onChange={(e) => {
                    const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 6);
                    handleInputChange({ target: { name: "pinCode", value: digitsOnly } } as any);
                  }}
                  className={`w-full border ${fieldErrors.pinCode ? 'border-red-500 bg-red-50/30 ring-2 ring-red-500/15' : 'border-slate-300 bg-white focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10'} rounded-lg px-3.5 sm:px-4 py-2.5 sm:py-3 text-base md:text-sm text-slate-900 focus:outline-none transition-colors font-mono tracking-wider placeholder:font-sans placeholder:tracking-normal placeholder:text-xs sm:placeholder:text-sm placeholder:text-slate-400`}
                />
                {fieldErrors.pinCode ? (
                  <span className="text-red-500 text-xs font-semibold animate-in fade-in zoom-in-95 duration-200">{fieldErrors.pinCode}</span>
                ) : formData.pinCode.length === 6 ? (
                  isPincodeLoading ? (
                    <span className="text-xs text-slate-600 font-medium animate-in fade-in duration-150">Checking Indian postal database...</span>
                  ) : pincodeData ? (
                    <span className="text-xs text-emerald-700 font-semibold animate-in fade-in duration-150 flex items-center gap-1">
                      <span>✓</span> Verified PIN ({pincodeData.district}, {pincodeData.state})
                    </span>
                  ) : (
                    <span className="text-xs text-red-600 font-semibold animate-in fade-in duration-150">
                      Please enter valid Indian PIN code
                    </span>
                  )
                ) : (
                  <span className="text-[11px] text-slate-500">
                    Enter 6-digit PIN to auto-detect City & State
                  </span>
                )}
              </div>

              {/* City (Auto-filled from DB & Disabled) */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="city" className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                  <span>CITY *</span>
                  {formData.city && (
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold uppercase tracking-wider">
                      Auto-filled
                    </span>
                  )}
                </label>
                <input
                  id="city"
                  name="city"
                  type="text"
                  required
                  disabled
                  readOnly
                  placeholder={formData.pinCode.length === 6 && isPincodeLoading ? "Detecting..." : "Auto from PIN"}
                  value={formData.city}
                  className="w-full border border-slate-200 bg-slate-100 text-slate-800 font-semibold cursor-not-allowed rounded-lg px-3.5 sm:px-4 py-2.5 sm:py-3 text-base md:text-sm select-none placeholder:text-xs sm:placeholder:text-sm placeholder:text-slate-400"
                />
                {fieldErrors.city && <span className="text-red-500 text-xs font-semibold animate-in fade-in zoom-in-95 duration-200">{fieldErrors.city}</span>}
              </div>

              {/* State (Auto-filled from DB & Disabled) */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="state" className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                  <span>STATE *</span>
                  {formData.state && (
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold uppercase tracking-wider">
                      Auto-filled
                    </span>
                  )}
                </label>
                <input
                  id="state"
                  name="state"
                  type="text"
                  required
                  disabled
                  readOnly
                  placeholder={formData.pinCode.length === 6 && isPincodeLoading ? "Detecting..." : "Auto from PIN"}
                  value={formData.state}
                  className="w-full border border-slate-200 bg-slate-100 text-slate-800 font-semibold cursor-not-allowed rounded-lg px-3.5 sm:px-4 py-2.5 sm:py-3 text-base md:text-sm select-none placeholder:text-xs sm:placeholder:text-sm placeholder:text-slate-400"
                />
                {fieldErrors.state && <span className="text-red-500 text-xs font-semibold animate-in fade-in zoom-in-95 duration-200">{fieldErrors.state}</span>}
              </div>
            </div>

            {/* SAVE AND DELIVER HERE & CANCEL buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={handleContinueToPayment}
                disabled={isAddingAddress || isNotServiceable || isCheckingServiceability}
                className="bg-banner hover:bg-[#e8451c] text-white font-bold text-xs uppercase tracking-wider px-5 py-2.5 sm:py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <span>{isAddingAddress ? "SAVING..." : (isCheckingServiceability ? "CHECKING..." : (editingAddressId ? "UPDATE ADDRESS & CONTINUE" : "SAVE ADDRESS & CONTINUE"))}</span>
                <span className="text-sm">→</span>
              </button>
              {savedAddresses.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onToggleAddressForm(false);
                    setEditingAddressId?.(null);
                  }}
                  className="rounded-lg border border-slate-300 hover:border-slate-900 bg-white text-slate-700 hover:text-slate-950 text-xs font-bold uppercase px-5 py-3.5 transition-colors text-center cursor-pointer"
                >
                  CANCEL
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Section 3: Delivery Method */}
      <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)] border border-slate-200/90 flex flex-col gap-4">
        <div>
          <h2 className="font-sans font-bold text-base sm:text-lg text-slate-900 tracking-tight uppercase flex items-center gap-2 sm:gap-2.5">
            <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">3</span>
            <span>DELIVERY METHOD</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Standard delivery across India.{freeShippingThreshold > 0 ? ` Free shipping on orders above ${formatPrice(freeShippingThreshold)}.` : ""}
          </p>
        </div>

        {/* Live Serviceability Status Banner */}
        {activePincode && activePincode.length === 6 && (
          <div>
            {isCheckingServiceability ? (
              <div className="flex items-center gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
                <div className="w-3.5 h-3.5 border-2 border-slate-700 border-t-transparent rounded-full animate-spin shrink-0" />
                <span>Checking courier network (Shiprocket, Delhivery, Xpressbees) for PIN code <strong>{activePincode}</strong>...</span>
              </div>
            ) : serviceabilityData?.serviceable ? (
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-900">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
                  <span>
                    PIN code <strong>{activePincode}</strong> is serviceable. 
                    {serviceabilityData.estimatedDays ? ` Estimated in ${serviceabilityData.estimatedDays} business days.` : " Fast delivery across India."}
                  </span>
                </div>
                {serviceabilityData.codAvailable && (
                  <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 bg-emerald-100 text-emerald-900 rounded border border-emerald-300 shrink-0">
                    COD Available
                  </span>
                )}
              </div>
            ) : isNotServiceable ? (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 space-y-1">
                <div className="flex items-center gap-2 font-bold text-red-900">
                  <svg className="w-4 h-4 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>Delivery Unavailable to PIN Code {activePincode}</span>
                </div>
                <p className="text-[11px] text-red-700 pl-6 leading-relaxed">
                  Our courier partners (Shiprocket, Delhivery, Xpressbees) do not currently service this pincode. Please select an alternate saved address or enter a different pincode to continue.
                </p>
              </div>
            ) : null}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <div className={`border-[1.5px] ${isNotServiceable ? 'border-red-300 bg-red-50/30' : 'border-slate-900 bg-slate-50/70'} rounded-xl p-3.5 sm:p-4 transition-colors flex items-center justify-between gap-3`}>
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-9 h-9 rounded-lg ${isNotServiceable ? 'bg-red-100 text-red-600' : 'bg-slate-900 text-white'} flex items-center justify-center shrink-0`}>
                <TruckIcon className="w-5 h-5" />
              </div>

              <div className="flex flex-col min-w-0">
                <span className="font-sans font-bold text-sm text-slate-900">
                  Standard Delivery
                </span>
                <span className="text-xs text-slate-500 mt-0.5">
                  {isNotServiceable
                    ? "Service unavailable to selected pincode"
                    : serviceabilityData?.estimatedDays
                      ? `Estimated delivery in ${serviceabilityData.estimatedDays} business days`
                      : "Estimated delivery in 3-5 business days"}
                </span>
              </div>
            </div>

            <div className="flex flex-col items-end shrink-0">
              <span className={`font-sans font-bold text-sm ${shippingCost === 0 ? "text-emerald-700 uppercase" : "text-slate-900"}`}>
                {shippingCost === 0 ? "FREE" : formatPrice(shippingCost)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-xs font-semibold flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage("")}
            className="text-red-400 hover:text-red-600 p-1 transition-colors rounded-lg"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="fixed bottom-0 left-0 right-0 px-4 py-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-white/95 backdrop-blur-md border-t border-slate-200 z-[60] flex items-center justify-between gap-3 sm:gap-4 shadow-[0_-4px_16px_rgba(15,23,42,0.06)] lg:relative lg:p-0 lg:pb-0 lg:border-t-0 lg:z-auto lg:shadow-none lg:bg-transparent">
        {/* Mobile Total Display */}
        <div className="flex flex-col lg:hidden min-w-0">
          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Total Payable</span>
          <span className="text-base sm:text-lg font-black text-slate-900 leading-tight">
            {total !== undefined ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(total) : "₹0.00"}
          </span>
        </div>

        {/* Back Button (Desktop Only) */}
        <Link
          href="/cart"
          className="hidden lg:flex border border-slate-300 hover:border-slate-900 bg-white text-slate-700 hover:text-slate-950 text-xs uppercase font-bold px-5 py-3.5 rounded-lg transition-colors items-center gap-2"
        >
          ← Back to Cart
        </Link>

        {/* Continue Button */}
        <button
          type="button"
          onClick={handleContinueToPayment}
          disabled={isAddingAddress || isNotServiceable || isCheckingServiceability}
          className={`shrink-0 h-10 lg:h-auto lg:w-auto ${
            isNotServiceable 
              ? 'bg-slate-300 hover:bg-slate-300 text-slate-600 cursor-not-allowed' 
              : 'bg-banner hover:bg-[#e8451c] text-white'
          } font-bold tracking-wider text-[11px] sm:text-xs uppercase lg:py-3.5 px-5 sm:px-7 rounded-lg transition-colors flex items-center justify-center gap-1.5 sm:gap-2 disabled:opacity-75 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer`}
        >
          <span className="truncate">
            {isAddingAddress ? (
              "SAVING..."
            ) : isCheckingServiceability ? (
              <>
                <span className="sm:hidden">CHECKING...</span>
                <span className="hidden sm:inline">CHECKING SERVICEABILITY...</span>
              </>
            ) : isNotServiceable ? (
              <>
                <span className="sm:hidden">PINCODE UNAVAILABLE</span>
                <span className="hidden sm:inline">DELIVERY UNAVAILABLE TO THIS PINCODE</span>
              </>
            ) : (
              <>
                <span className="sm:hidden">CONTINUE</span>
                <span className="hidden sm:inline">CONTINUE TO PAYMENT</span>
              </>
            )}
          </span>
          {!isAddingAddress && !isCheckingServiceability && !isNotServiceable && (
            <span className="text-base leading-none shrink-0">→</span>
          )}
        </button>
      </div>

    </div>
  );
};
