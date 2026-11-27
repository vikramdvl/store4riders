import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import { IFooterConfig, IPolicyPageConfig, IPackagePreset } from "@store4riders/shared-types";

export interface IPublicSettings {
  enabledGateways: string[];
  codPartialPaymentEnabled?: boolean;
  codPartialPaymentType?: "percentage" | "fixed";
  codPartialPaymentValue?: number;
  codHandlingFeeEnabled?: boolean;
  codHandlingFeeThreshold?: number;
  codHandlingFeeTier1Amount?: number;
  codHandlingFeeTier2Amount?: number;
  taxRate: number;
  freeShippingThreshold: number;
  shippingCost: number;
  gstin?: string;
  legalBusinessName?: string;
  gstPricingMode?: "inclusive" | "exclusive";
  allowB2bGstin?: boolean;
  storeOriginState?: string;
  storeOriginCity?: string;
  storeOriginPincode?: string;
  storeOriginAddress?: string;
  supportPhone?: string;
  supportEmail?: string;
  whatsappNumber?: string;
  whatsappChatEnabled?: boolean;
  whatsappDefaultMessage?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  youtubeUrl?: string;
  twitterUrl?: string;
  returnWindowDays?: number;
  exchangeShippingFee?: number;
  packagePresets?: IPackagePreset[];
  snapmintMinOrderValue?: number;
  footerConfig?: IFooterConfig;
  policyPages?: IPolicyPageConfig[];
  googleRating?: number;
  googleReviewCount?: string | number;
  googleLastSyncedAt?: string | Date;
  upiMerchantVpa?: string;
  upiMerchantName?: string;
  upiMcc?: string;
  googlePayMerchantId?: string;
  googlePayEnvironment?: "TEST" | "PRODUCTION";
}

export function usePublicSettings(options?: { staleTime?: number }) {
  return useQuery({
    queryKey: ["publicSettings"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: IPublicSettings }>("/settings/public");
      return res.data.data;
    },
    staleTime: options?.staleTime ?? 30 * 60 * 1000, // 30 minutes default for footer/contact UI; pass shorter staleTime on checkout
  });
}
