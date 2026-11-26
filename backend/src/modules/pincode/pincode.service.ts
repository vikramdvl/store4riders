import { IPincode } from "@store4riders/shared-types";
import { PincodeRepository } from "./pincode.repository";
import { NotFoundError } from "../../core/errors/AppError";
import { getCache, setCache } from "../../core/cache/redis";

const PINCODE_CACHE_TTL = 30 * 24 * 60 * 60; // 30 days (Indian postal codes are static)
const PINCODE_NOT_FOUND_TTL = 24 * 60 * 60; // 24 hours negative cache against invalid pincode spam
const STATES_CACHE_KEY = "pincode_states_v1";
const NOT_FOUND_SENTINEL = "__PINCODE_NOT_FOUND__";

export class PincodeService {
  static async findByPincodeOrNull(pincode: string): Promise<IPincode | null> {
    const cleanPin = pincode.trim();
    if (!/^\d{6}$/.test(cleanPin)) {
      return null;
    }

    const cacheKey = `pincode_v1_${cleanPin}`;
    const cached = await getCache(cacheKey);
    if (cached === NOT_FOUND_SENTINEL) {
      return null;
    }
    if (cached && typeof cached === "object") {
      return cached as IPincode;
    }

    const data = await PincodeRepository.findByPincode(cleanPin);
    if (!data) {
      await setCache(cacheKey, NOT_FOUND_SENTINEL, PINCODE_NOT_FOUND_TTL);
      return null;
    }

    await setCache(cacheKey, data, PINCODE_CACHE_TTL);
    return data;
  }

  static async getPincodeDetails(pincode: string): Promise<IPincode> {
    const data = await this.findByPincodeOrNull(pincode);
    if (!data) {
      throw new NotFoundError("Pincode not found");
    }
    return data;
  }

  static async getDistinctStates(): Promise<string[]> {
    const cached = await getCache(STATES_CACHE_KEY);
    if (Array.isArray(cached) && cached.length > 0) {
      return cached as string[];
    }

    const states = await PincodeRepository.getDistinctStates();
    const formattedStates = states
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .map((state) => state.trim().toLowerCase().replace(/\b\w/g, (s) => s.toUpperCase()))
      .sort((a, b) => a.localeCompare(b));

    const uniqueStates = [...new Set(formattedStates)];
    if (uniqueStates.length > 0) {
      await setCache(STATES_CACHE_KEY, uniqueStates, PINCODE_CACHE_TTL);
    }

    return uniqueStates;
  }
}
