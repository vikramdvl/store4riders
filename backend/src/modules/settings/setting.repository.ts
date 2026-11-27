/**
 * @class SettingRepository
 * @description Direct database access layer for Store Settings.
 * Ensures only a single global settings document exists.
 *
 * FIX (Nov 2026): Replaced multiple sequential .save() calls with a single
 * consolidated save in getSettings(), and switched updateSettings() from
 * the fragile fetch→mutate→save() pattern to an atomic findOneAndUpdate().
 * This eliminates Mongoose VersionError ("No matching document found for id …
 * version 0") which occurred when two admin tabs saved concurrently or when
 * the migration logic inside getSettings() incremented __v before the
 * caller's own save.
 */
import { SettingModel, ISetting } from "./setting.model";
import { getCache, setCache, deleteCache } from "../../core/cache/redis";

const SETTINGS_CACHE_KEY = "store_settings";

export class SettingRepository {
  static async getSettings(): Promise<ISetting> {
    try {
      const cached = await getCache(SETTINGS_CACHE_KEY);
      if (cached && typeof cached === "object" && (cached._id || cached.taxRate !== undefined)) {
        return cached as ISetting;
      }
    } catch {}

    let settings = await SettingModel.findOne();
    if (!settings) {
      settings = await SettingModel.create({
        enabledGateways: ["payu", "ccavenue", "snapmint", "cod"]
      });
      return settings;
    }

    // ── Collect ALL migration changes, then save ONCE at the end ──
    let needsSave = false;

    if (!settings.enabledGateways) {
      settings.enabledGateways = ["payu", "ccavenue", "snapmint", "cod"];
      needsSave = true;
    } else if (settings.enabledGateways.some((g: string) => g === "upi" || g === "gpay")) {
      settings.enabledGateways = settings.enabledGateways.filter((g: string) => g !== "upi" && g !== "gpay");
      needsSave = true;
    }

    if (settings.codPartialPaymentEnabled === undefined) {
      settings.codPartialPaymentEnabled = false;
      needsSave = true;
    }
    
    // Add default presets to older database records
    if (!settings.packagePresets || settings.packagePresets.length === 0) {
      settings.packagePresets = [
        { name: "Small Box (Accessories)", length: 15, breadth: 15, height: 10 },
        { name: "Medium Box (Jackets/Boots)", length: 30, breadth: 30, height: 15 },
        { name: "Large Box (Helmets)", length: 40, breadth: 30, height: 30 }
      ] as any;
      needsSave = true;
    }
    
    // Ensure footerConfig has dedicated columns for Policies & Legal and About Us
    if (settings.footerConfig) {
      const fc = settings.footerConfig as any;
      let footerChanged = false;
      const policyUrls = [
        "/terms",
        "/privacy",
        "/legal",
        "/store-policies",
        "/store4riders-store-policies",
        "/store4riders-conditions-of-use-and-sale",
        "/legal-stuff",
        "/privacy-policy-cookie-restriction-mode",
      ];
      const aboutUrls = ["/about-us", "/contact-us", "/about-us-store4riders", "/contact-store4riders", "/contact"];

      if (!fc.column3Title) {
        fc.column3Title = "POLICIES & LEGAL";
        footerChanged = true;
      }
      if (!fc.column4Title) {
        fc.column4Title = "ABOUT US";
        footerChanged = true;
      }

      // Migrate legacy URLs in Column 1 (e.g. /shipping -> /shipping-policies-store4riders)
      if (Array.isArray(fc.column1Links)) {
        fc.column1Links = fc.column1Links.map((l: any) => {
          if (l.url === "/shipping") {
            footerChanged = true;
            return { ...l, url: "/shipping-policies-store4riders" };
          }
          if (l.url === "/returns") {
            footerChanged = true;
            return { ...l, url: "/returns-replacements-store4riders" };
          }
          return l;
        });
      }

      if (Array.isArray(fc.column1Links) && fc.column1Links.some((l: any) => policyUrls.includes(l.url))) {
        const extractedPolicies = fc.column1Links.filter((l: any) => policyUrls.includes(l.url));
        fc.column1Links = fc.column1Links.filter((l: any) => !policyUrls.includes(l.url));
        if (!Array.isArray(fc.column3Links) || fc.column3Links.length === 0) {
          fc.column3Links = extractedPolicies;
        }
        footerChanged = true;
      } else if (!Array.isArray(fc.column3Links)) {
        fc.column3Links = [
          { label: "Conditions of Sale & Use", url: "/store4riders-conditions-of-use-and-sale", openInNewTab: false },
          { label: "Privacy and Cookie Policy", url: "/privacy-policy-cookie-restriction-mode", openInNewTab: false },
          { label: "Legal", url: "/legal-stuff", openInNewTab: false },
          { label: "Store Policies", url: "/store4riders-store-policies", openInNewTab: false },
        ];
        footerChanged = true;
      }

      // Migrate legacy URLs in Column 3
      if (Array.isArray(fc.column3Links)) {
        fc.column3Links = fc.column3Links.map((l: any) => {
          if (l.url === "/store-policies") {
            footerChanged = true;
            return { ...l, url: "/store4riders-store-policies" };
          }
          if (l.url === "/terms") {
            footerChanged = true;
            return { ...l, url: "/store4riders-conditions-of-use-and-sale" };
          }
          if (l.url === "/privacy") {
            footerChanged = true;
            return { ...l, url: "/privacy-policy-cookie-restriction-mode" };
          }
          if (l.url === "/legal") {
            footerChanged = true;
            return { ...l, url: "/legal-stuff" };
          }
          return l;
        });
      }

      if (Array.isArray(fc.column2Links) && fc.column2Links.some((l: any) => aboutUrls.includes(l.url))) {
        const extractedAbout = fc.column2Links.filter((l: any) => aboutUrls.includes(l.url));
        fc.column2Links = fc.column2Links.filter((l: any) => !aboutUrls.includes(l.url));
        if (!Array.isArray(fc.column4Links) || fc.column4Links.length === 0) {
          fc.column4Links = extractedAbout;
        }
        footerChanged = true;
      } else if (!Array.isArray(fc.column4Links)) {
        fc.column4Links = [
          { label: "About us", url: "/about-us-store4riders", openInNewTab: false },
          { label: "Contact Us", url: "/contact-store4riders", openInNewTab: false },
        ];
        footerChanged = true;
      }

      // Migrate legacy URLs in Column 4
      if (Array.isArray(fc.column4Links)) {
        fc.column4Links = fc.column4Links.map((l: any) => {
          if (l.url === "/about-us") {
            footerChanged = true;
            return { ...l, url: "/about-us-store4riders" };
          }
          if (l.url === "/contact-us" || l.url === "/contact") {
            footerChanged = true;
            return { ...l, url: "/contact-store4riders" };
          }
          return l;
        });
      }

      if (footerChanged) {
        settings.markModified("footerConfig");
        needsSave = true;
      }
    }

    // ── Single atomic update for ALL migrations ──
    if (needsSave) {
      try {
        const plain = (settings as any).toObject ? (settings as any).toObject() : settings;
        const { _id, __v, createdAt, updatedAt, id, ...setPayload } = plain;
        await SettingModel.updateOne(
          { _id: settings._id },
          { $set: setPayload }
        );
      } catch (saveErr) {
        // Safe fallback - avoid breaking read/invoice operations on migration save conflicts
      }
    }

    try {
      const plain = (settings as any).toObject ? (settings as any).toObject() : settings;
      await setCache(SETTINGS_CACHE_KEY, plain, 3600);
    } catch {}

    return settings;
  }

  /**
   * Atomic settings update using findOneAndUpdate.
   * This avoids Mongoose VersionError entirely — no fetch→mutate→save race.
   */
  static async updateSettings(data: Partial<ISetting>): Promise<ISetting> {
    // Ensure a settings document exists (runs migrations if needed)
    await this.getSettings();

    // Strip internal Mongoose / API fields that must never be written back
    const { _id, __v, createdAt, updatedAt, id, ...cleanData } = data as any;

    // Build a flat $set payload — only include fields that were actually sent
    const setPayload: Record<string, any> = {};
    for (const [key, value] of Object.entries(cleanData)) {
      if (value !== undefined) {
        setPayload[key] = value;
      }
    }

    if (Object.keys(setPayload).length === 0) {
      return this.getSettings();
    }

    const updated = await SettingModel.findOneAndUpdate(
      {},
      { $set: setPayload },
      { new: true, runValidators: true }
    )
      .lean()
      .exec();

    if (!updated) {
      // Should never happen since getSettings() ensures creation, but just in case
      return this.getSettings();
    }

    // Invalidate and refresh cache immediately on update
    try {
      await deleteCache(SETTINGS_CACHE_KEY);
      await deleteCache("search_trending_v1");
      await setCache(SETTINGS_CACHE_KEY, updated, 3600);
    } catch {}

    return updated as unknown as ISetting;
  }
}
