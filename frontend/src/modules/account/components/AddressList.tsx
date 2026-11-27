"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/stores/useAuthStore";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { addressSchema } from "@store4riders/shared-validation";
import { z } from "zod";
import { apiClient } from "@/core/api/client";
import { toast } from "sonner";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { MapPin, Edit2, Trash2, CheckCircle2, Plus, Loader2, AlertTriangle } from "lucide-react";
import { IUserAddress } from "@store4riders/shared-types";
import {
  useAddAddress,
  useUpdateAddress,
  useDeleteAddress,
} from "@/core/hooks/useAddresses";

export function AddressList() {
  const { user } = useAuthStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<IUserAddress | null>(null);
  const [confirmDeleteAddr, setConfirmDeleteAddr] = useState<IUserAddress | null>(null);
  const [isLookingUpPincode, setIsLookingUpPincode] = useState(false);

  const addAddressMutation = useAddAddress();
  const updateAddressMutation = useUpdateAddress();
  const deleteAddressMutation = useDeleteAddress();

  const isSubmitting = addAddressMutation.isPending || updateAddressMutation.isPending;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
    clearErrors,
    setFocus,
  } = useForm({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      street: "",
      city: "",
      state: "",
      pincode: "",
      country: "India",
      isDefault: false,
    },
  });

  const pincodeValue = watch("pincode");

  useEffect(() => {
    if (!isModalOpen) return;
    if (pincodeValue && pincodeValue.length === 6 && /^\d+$/.test(pincodeValue)) {
      let active = true;
      const fetchPincodeDetails = async () => {
        setIsLookingUpPincode(true);
        try {
          const res = await apiClient.get(`/pincodes/${pincodeValue}`);
          if (active && res.data?.success && res.data?.data) {
            const data = res.data.data;
            const cityName = data.district || data.regionName || data.divisionName || "";
            const stateName = data.state || "";

            if (cityName) setValue("city", cityName, { shouldValidate: true });
            if (stateName) setValue("state", stateName, { shouldValidate: true });
            setValue("country", "India", { shouldValidate: true });

            clearErrors(["city", "state", "country"]);
            toast.success(`Location detected: ${cityName}, ${stateName}`);
          }
        } catch (error: any) {
          if (active && error.response?.status === 404) {
            toast.error("Pincode not found. Please enter details manually.");
          }
        } finally {
          if (active) setIsLookingUpPincode(false);
        }
      };
      fetchPincodeDetails();
      return () => {
        active = false;
      };
    }
  }, [pincodeValue, isModalOpen, setValue, clearErrors]);

  const openAddModal = () => {
    setEditingAddress(null);
    reset({ street: "", city: "", state: "", pincode: "", country: "India", isDefault: false });
    setIsModalOpen(true);
  };

  const openEditModal = (addr: IUserAddress) => {
    setEditingAddress(addr);
    reset({
      street: addr.street,
      city: addr.city,
      state: addr.state,
      pincode: addr.pincode,
      country: addr.country,
      isDefault: addr.isDefault,
    });
    setIsModalOpen(true);
  };

  const onSubmit = async (data: z.infer<typeof addressSchema>) => {
    try {
      if (editingAddress) {
        await updateAddressMutation.mutateAsync({
          addressId: editingAddress.id,
          addressData: data,
        });
        toast.success("Address updated successfully");
      } else {
        await addAddressMutation.mutateAsync(data);
        toast.success("Address added successfully");
      }
      setIsModalOpen(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Operation failed");
    }
  };

  const onInvalid = () => {
    const firstKey = Object.keys(errors)[0] as
      | "street"
      | "city"
      | "state"
      | "pincode"
      | "country"
      | undefined;
    if (firstKey) setFocus(firstKey);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteAddr) return;
    try {
      await deleteAddressMutation.mutateAsync(confirmDeleteAddr.id);
      toast.success("Address deleted successfully");
      setConfirmDeleteAddr(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Delete failed");
    }
  };

  const handleSetDefault = async (addr: IUserAddress) => {
    if (addr.isDefault) return;
    try {
      await updateAddressMutation.mutateAsync({
        addressId: addr.id,
        addressData: { isDefault: true },
      });
      toast.success("Default address updated");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to update default address");
    }
  };

  const addresses = user?.addresses || [];

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {/* Header Card */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg sm:text-2xl font-bold text-slate-900">Manage Addresses</h1>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {addresses.length}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Save your home, office, or riding club addresses for faster checkout.
          </p>
        </div>
        <Button
          onClick={openAddModal}
          className="w-full sm:w-auto min-h-[44px] gap-1.5 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Address</span>
        </Button>
      </div>

      {/* Address Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
        {addresses.length === 0 && (
          <div className="col-span-1 md:col-span-2 text-center py-14 px-4 bg-white rounded-xl shadow-2xs border border-slate-200">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300">
              <MapPin size={32} strokeWidth={1.5} />
            </div>
            <h2 className="text-lg font-bold text-slate-900">No addresses saved yet</h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 mb-5 max-w-sm mx-auto">
              Add a delivery address now so checkout takes just one tap.
            </p>
            <Button variant="outline" onClick={openAddModal} className="min-h-[44px] px-6">
              + Add Delivery Address
            </Button>
          </div>
        )}

        {addresses.map((addr) => (
          <div
            key={addr.id}
            className={`bg-white p-4 sm:p-5 rounded-xl border relative transition-all duration-200 flex flex-col justify-between gap-4 ${
              addr.isDefault
                ? "border-brand shadow-sm ring-1 ring-brand/15"
                : "border-slate-200 shadow-2xs hover:border-slate-300"
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                {addr.isDefault ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-brand font-bold uppercase tracking-wider bg-brand/10 px-2.5 py-1 rounded-full border border-brand/20">
                    <CheckCircle2 size={12} strokeWidth={2.5} /> Default Address
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSetDefault(addr)}
                    className="min-h-[34px] text-[11px] text-slate-600 hover:text-brand font-bold uppercase tracking-wider transition-colors px-3 py-1 rounded-full border border-slate-200 hover:border-brand/30 hover:bg-brand/5 cursor-pointer"
                  >
                    Set as Default
                  </button>
                )}

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditModal(addr)}
                    aria-label={`Edit address ${addr.street}, ${addr.city}`}
                    className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-white hover:text-brand hover:border-brand/30 transition-colors cursor-pointer"
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteAddr(addr)}
                    aria-label={`Delete address ${addr.street}, ${addr.city}`}
                    className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors cursor-pointer"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <p className="font-bold text-slate-900 text-sm sm:text-base leading-snug">
                  {addr.street}
                </p>
                <p className="text-xs sm:text-sm text-slate-600 font-medium">
                  {addr.city}, {addr.state} –{" "}
                  <span className="font-bold text-slate-900">{addr.pincode}</span>
                </p>
                <p className="text-xs text-slate-400 font-medium">{addr.country}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Address Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingAddress ? "Edit Delivery Address" : "Add New Address"}
      >
        <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="flex flex-col gap-4" noValidate>
          <Input
            label="Street Address / Flat / Landmark"
            autoComplete="street-address"
            enterKeyHint="next"
            placeholder="House no., building, street, area"
            {...register("street")}
            error={errors.street?.message as string}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Pincode"
              type="text"
              inputMode="numeric"
              autoComplete="postal-code"
              enterKeyHint="next"
              maxLength={10}
              placeholder="e.g. 560001"
              hint="6-digit Indian pincode auto-fills city & state."
              {...register("pincode")}
              error={errors.pincode?.message as string}
              rightElement={
                isLookingUpPincode ? (
                  <Loader2 className="w-4 h-4 text-brand animate-spin mr-2" />
                ) : null
              }
            />
            <Input
              label="Country"
              autoComplete="country-name"
              enterKeyHint="next"
              {...register("country")}
              error={errors.country?.message as string}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="City / District"
              autoComplete="address-level2"
              enterKeyHint="next"
              {...register("city")}
              error={errors.city?.message as string}
            />
            <Input
              label="State"
              autoComplete="address-level1"
              enterKeyHint="done"
              {...register("state")}
              error={errors.state?.message as string}
            />
          </div>

          <label
            htmlFor="isDefault"
            className="flex items-center gap-3 mt-1 bg-slate-50 p-3.5 rounded-xl border border-slate-200 hover:border-brand/30 transition-colors cursor-pointer min-h-[48px]"
          >
            <input
              type="checkbox"
              id="isDefault"
              {...register("isDefault")}
              className="w-5 h-5 text-brand accent-brand rounded border-slate-300 focus:ring-brand cursor-pointer shrink-0"
            />
            <span className="text-sm font-semibold text-slate-800">
              Set as my default delivery address
            </span>
          </label>

          <div className="pt-4 mt-1 flex flex-col-reverse sm:flex-row justify-end gap-2.5 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              className="w-full sm:w-auto min-h-[46px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isSubmitting}
              className="w-full sm:w-auto px-8 min-h-[46px]"
            >
              {editingAddress ? "Save Address" : "Add Address"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Accessible In-App Delete Confirmation Modal */}
      <Modal
        isOpen={!!confirmDeleteAddr}
        onClose={() => setConfirmDeleteAddr(null)}
        title="Delete Address?"
        maxWidth="max-w-md"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-900">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm">
              <p className="font-semibold">Are you sure you want to remove this address?</p>
              {confirmDeleteAddr && (
                <p className="text-red-700 mt-1">
                  {confirmDeleteAddr.street}, {confirmDeleteAddr.city} – {confirmDeleteAddr.pincode}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmDeleteAddr(null)}
              disabled={deleteAddressMutation.isPending}
              className="w-full sm:w-auto min-h-[44px]"
            >
              Keep Address
            </Button>
            <Button
              type="button"
              onClick={handleConfirmDelete}
              isLoading={deleteAddressMutation.isPending}
              className="w-full sm:w-auto min-h-[44px] bg-red-600 hover:bg-red-700 text-white"
            >
              Delete Address
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
