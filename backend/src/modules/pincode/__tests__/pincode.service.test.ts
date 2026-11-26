import { describe, it, expect, vi, beforeEach } from "vitest";
import { PincodeService } from "../pincode.service";
import { PincodeRepository } from "../pincode.repository";
import { PincodeValidator } from "../pincode.validator";
import { NotFoundError, ValidationError } from "../../../core/errors/AppError";
import { deleteCache } from "../../../core/cache/redis";

describe("Pincode Module (Validator & Redis-Cached Service)", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await deleteCache("pincode_v1_411001");
    await deleteCache("pincode_v1_999999");
    await deleteCache("pincode_states_v1");
  });

  it("validates 6-digit pincode strictly before hitting cache or DB", () => {
    expect(PincodeValidator.validatePincode(" 411001 ")).toBe("411001");
    expect(() => PincodeValidator.validatePincode("4110")).toThrow(ValidationError);
    expect(() => PincodeValidator.validatePincode("abcdef")).toThrow(ValidationError);
  });

  it("caches valid pincode lookups so MongoDB is only queried once", async () => {
    const repoSpy = vi.spyOn(PincodeRepository, "findByPincode").mockResolvedValue({
      pincode: "411001",
      state: "Maharashtra",
      district: "Pune",
    } as any);

    const first = await PincodeService.getPincodeDetails("411001");
    const second = await PincodeService.getPincodeDetails("411001");

    expect(first.district).toBe("Pune");
    expect(second.state).toBe("Maharashtra");
    expect(repoSpy).toHaveBeenCalledTimes(1);
  });

  it("negative-caches missing pincodes so repeat invalid 6-digit lookups do not hit DB", async () => {
    const repoSpy = vi.spyOn(PincodeRepository, "findByPincode").mockResolvedValue(null);

    await expect(PincodeService.getPincodeDetails("999999")).rejects.toThrow(NotFoundError);
    await expect(PincodeService.getPincodeDetails("999999")).rejects.toThrow(NotFoundError);

    expect(repoSpy).toHaveBeenCalledTimes(1);
  });

  it("caches, formats, deduplicates, and sorts Indian states", async () => {
    const statesSpy = vi
      .spyOn(PincodeRepository, "getDistinctStates")
      .mockResolvedValue(["maharashtra", "MAHARASHTRA", "delhi", "karnataka"]);

    const first = await PincodeService.getDistinctStates();
    const second = await PincodeService.getDistinctStates();

    expect(first).toEqual(["Delhi", "Karnataka", "Maharashtra"]);
    expect(second).toEqual(["Delhi", "Karnataka", "Maharashtra"]);
    expect(statesSpy).toHaveBeenCalledTimes(1);
  });
});
