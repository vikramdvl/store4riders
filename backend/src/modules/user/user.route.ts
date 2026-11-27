import { NextRequest, NextResponse } from "next/server";
/**
 * @file user.route.ts
 * @description Defines API endpoints for Users and maps them to Controller methods.
 */
import { UserController } from "./user.controller";
import { extractVerifiedAuth } from "../../core/middlewares/auth";

export async function userRouter(req: NextRequest, routePath: string[]): Promise<NextResponse | null> {
  const method = req.method;
  const pathLen = routePath.length;

  if (pathLen === 1 && routePath[0] === "me") {
    if (method === "GET") {
      await extractVerifiedAuth(req);
      return await UserController.getProfile(req);
    }
    if (method === "PUT") return await UserController.updateProfile(req);
  }

  if (pathLen === 2 && routePath[0] === "me" && routePath[1] === "password") {
    if (method === "PUT") return await UserController.changePassword(req);
  }

  if (pathLen === 2 && routePath[0] === "me" && routePath[1] === "addresses") {
    if (method === "GET") {
      await extractVerifiedAuth(req);
      return await UserController.getAddresses(req);
    }
    if (method === "POST") return await UserController.addAddress(req);
  }

  if (pathLen === 3 && routePath[0] === "me" && routePath[1] === "addresses") {
    const addressId = routePath[2];
    if (method === "PUT") return await UserController.updateAddress(req, addressId);
    if (method === "DELETE") {
      await extractVerifiedAuth(req);
      return await UserController.deleteAddress(req, addressId);
    }
  }

  return null;
}
