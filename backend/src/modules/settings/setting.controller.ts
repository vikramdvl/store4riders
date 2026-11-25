import { SettingService } from "./setting.service";
import { SettingValidator } from "./setting.validator";
import { ApiResponse } from "../../core/response/ApiResponse";

export class SettingController {
  static async getSettings(req: any) {
    const settings = await SettingService.getSettings();
    return ApiResponse.success(settings, "Settings retrieved successfully");
  }

  static async getPublicSettings(req: any) {
    const settings = await SettingService.getSettings();
    // Only return non-sensitive fields
    const publicData = {
      taxRate: settings.taxRate,
      freeShippingThreshold: settings.freeShippingThreshold,
      shippingCost: settings.shippingCost,
      enabledGateways: settings.enabledGateways,
      codPartialPaymentEnabled: Boolean(settings.codPartialPaymentEnabled),
      codPartialPaymentType: settings.codPartialPaymentType,
      codPartialPaymentValue: settings.codPartialPaymentValue,
      codHandlingFeeEnabled: settings.codHandlingFeeEnabled !== false,
      codHandlingFeeThreshold: typeof settings.codHandlingFeeThreshold === "number" ? settings.codHandlingFeeThreshold : 5000,
      codHandlingFeeTier1Amount: typeof settings.codHandlingFeeTier1Amount === "number" ? settings.codHandlingFeeTier1Amount : 100,
      codHandlingFeeTier2Amount: typeof settings.codHandlingFeeTier2Amount === "number" ? settings.codHandlingFeeTier2Amount : 200,
      packagePresets: settings.packagePresets,
      gstin: settings.gstin,
      legalBusinessName: settings.legalBusinessName,
      gstPricingMode: settings.gstPricingMode || "inclusive",
      allowB2bGstin: settings.allowB2bGstin !== false,
      storeOriginState: settings.storeOriginState,
      storeOriginCity: settings.storeOriginCity,
      storeOriginPincode: settings.storeOriginPincode,
      storeOriginAddress: settings.storeOriginAddress,
      storeOriginPhone: settings.storeOriginPhone,
      supportPhone: settings.supportPhone || settings.storeOriginPhone,
      supportEmail: settings.supportEmail || "contact@store4riders.com",
      whatsappNumber: settings.whatsappNumber || "+91 - 7263007788",
      whatsappChatEnabled: settings.whatsappChatEnabled !== false,
      whatsappDefaultMessage: settings.whatsappDefaultMessage || "Hello Store4Riders. I have a query regarding {product page name}.",
      facebookUrl: settings.facebookUrl,
      instagramUrl: settings.instagramUrl,
      youtubeUrl: settings.youtubeUrl,
      twitterUrl: settings.twitterUrl,
      returnWindowDays: typeof settings.returnWindowDays === "number" ? settings.returnWindowDays : 7,
      exchangeShippingFee: typeof settings.exchangeShippingFee === "number" ? settings.exchangeShippingFee : 299,
      snapmintMinOrderValue: settings.snapmintMinOrderValue,
      brandsMetaTitle: settings.brandsMetaTitle || "",
      brandsMetaDescription: settings.brandsMetaDescription || "",
      brandsMetaKeywords: settings.brandsMetaKeywords || "",
      guidesMetaTitle: settings.guidesMetaTitle || "",
      guidesMetaDescription: settings.guidesMetaDescription || "",
      guidesMetaKeywords: settings.guidesMetaKeywords || "",
      footerConfig: settings.footerConfig,
      policyPages: settings.policyPages || [],
      googleRating: settings.googleLastSyncedAt && typeof settings.googleRating === "number" ? settings.googleRating : 0,
      googleReviewCount: settings.googleLastSyncedAt && settings.googleReviewCount ? settings.googleReviewCount : "",
      googleLastSyncedAt: settings.googleLastSyncedAt,
      upiMerchantVpa: settings.upiMerchantVpa || process.env.GOOGLE_PAY_MERCHANT_VPA || undefined,
      upiMerchantName: settings.upiMerchantName || process.env.GOOGLE_PAY_MERCHANT_NAME || settings.legalBusinessName || "Store4Riders",
      upiMcc: settings.upiMcc || process.env.GOOGLE_PAY_MCC || "5941",
      googlePayMerchantId: settings.googlePayMerchantId || process.env.GOOGLE_PAY_MERCHANT_ID || undefined,
      googlePayEnvironment: settings.googlePayEnvironment || (process.env.GOOGLE_PAY_ENVIRONMENT as any) || "TEST",
    };
    return ApiResponse.success(publicData, "Public settings retrieved successfully");
  }

  static async updateSettings(req: any) {
    const prevSettings = await SettingService.getSettings();
    const validatedData = await SettingValidator.validateUpdateSettings(req);
    const settings = await SettingService.updateSettings(validatedData);
    try {
      const { extractUserFromAuth } = await import("../../core/middlewares/auth");
      const actorUserId = extractUserFromAuth(req);
      const { AuditLogService } = await import("../audit-log/audit-log.service");
      const diff = AuditLogService.computeFieldDiff(prevSettings as any, validatedData as any);
      await AuditLogService.record({
        category: "ADMIN",
        action: "SETTINGS_UPDATED",
        severity: "critical",
        actorUserId,
        resource: { type: "StoreSettings", label: "Global Store Settings" },
        changes: diff,
        req,
        message: `Updated store configuration (${diff?.after ? Object.keys(diff.after).join(", ") : "settings"})`,
      });
    } catch {}
    return ApiResponse.success(settings, "Settings updated successfully");
  }
}
