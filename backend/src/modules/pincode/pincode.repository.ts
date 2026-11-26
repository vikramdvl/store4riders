import { PincodeModel } from "./pincode.model";
import { IPincode } from "@store4riders/shared-types";

export class PincodeRepository {
  static async findByPincode(pincode: string): Promise<IPincode | null> {
    const cleanPin = pincode.trim();

    // Primary indexed lookup using unique String index (avoids $or scan overhead)
    const exactMatch = await PincodeModel.findOne({ pincode: cleanPin })
      .select("pincode state district circleName regionName divisionName offices")
      .lean()
      .exec();
    if (exactMatch) {
      return exactMatch as unknown as IPincode;
    }

    // Legacy fallback if any record was imported with numeric pincode
    const numericPin = Number(cleanPin);
    if (Number.isInteger(numericPin) && numericPin > 0) {
      const legacyMatch = await PincodeModel.findOne({ pincode: numericPin as unknown as string })
        .select("pincode state district circleName regionName divisionName offices")
        .lean()
        .exec();
      if (legacyMatch) {
        return legacyMatch as unknown as IPincode;
      }
    }

    return null;
  }

  static async bulkWrite(operations: any[]) {
    return PincodeModel.bulkWrite(operations, { ordered: false });
  }

  static async count(): Promise<number> {
    return PincodeModel.countDocuments().exec();
  }

  static async getDistinctStates(): Promise<string[]> {
    return PincodeModel.distinct("state").exec();
  }
}
