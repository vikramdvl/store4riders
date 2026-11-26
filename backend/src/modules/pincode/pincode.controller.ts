import { NextRequest } from "next/server";
import { PincodeService } from "./pincode.service";
import { PincodeValidator } from "./pincode.validator";
import { ApiResponse } from "../../core/response/ApiResponse";

export class PincodeController {
  static async getPincodeDetails(req: NextRequest, pincode: string) {
    const cleanPin = PincodeValidator.validatePincode(pincode);
    const data = await PincodeService.getPincodeDetails(cleanPin);

    const response = ApiResponse.success(data, "Pincode details fetched successfully");
    response.headers.set(
      "Cache-Control",
      "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800"
    );
    return response;
  }

  static async getDistinctStates(req: NextRequest) {
    const uniqueStates = await PincodeService.getDistinctStates();

    const response = ApiResponse.success(uniqueStates, "States fetched successfully");
    response.headers.set(
      "Cache-Control",
      "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800"
    );
    return response;
  }
}
