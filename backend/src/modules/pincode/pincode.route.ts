import { NextRequest, NextResponse } from "next/server";
import { PincodeController } from "./pincode.controller";

/**
 * @swagger
 * tags:
 *   name: Pincodes
 *   description: Indian postal code and state directory lookup
 */

/**
 * @swagger
 * /api/v1/pincodes/states:
 *   get:
 *     summary: Get all distinct Indian states
 *     tags: [Pincodes]
 *     responses:
 *       200:
 *         description: Sorted list of distinct states
 *
 * /api/v1/pincodes/{pincode}:
 *   get:
 *     summary: Lookup city, district, and state by 6-digit Indian pincode
 *     tags: [Pincodes]
 *     parameters:
 *       - in: path
 *         name: pincode
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^\d{6}$'
 *     responses:
 *       200:
 *         description: Pincode details fetched successfully
 *       400:
 *         description: Invalid pincode format
 *       404:
 *         description: Pincode not found
 */
export async function pincodeRouter(req: NextRequest, routePath: string[]): Promise<NextResponse | null> {
  const method = req.method;
  const pathLen = routePath.length;

  if (method === "GET" && pathLen === 1) {
    const param = routePath[0];
    if (param === "states") {
      return await PincodeController.getDistinctStates(req);
    }
    return await PincodeController.getPincodeDetails(req, param);
  }

  return null;
}
