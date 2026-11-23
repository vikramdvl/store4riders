import { NextResponse } from "next/server";
import { AppError } from "../errors/AppError";
import { ApiResponse } from "../response/ApiResponse";
import { logger } from "../utils/logger";

export const errorHandler = (error: unknown): NextResponse => {
  if (error instanceof AppError) {
    if (error.statusCode === 500) {
      logger.error("AppError (500):", error.message);
    }
    return ApiResponse.error(error.message, error.statusCode);
  }

  // Mongoose CastError (e.g. invalid ObjectId)
  if (error instanceof Error && error.name === "CastError") {
    return ApiResponse.error("Invalid ID format", 400);
  }

  // Mongoose Schema ValidationError
  if (error instanceof Error && error.name === "ValidationError") {
    return ApiResponse.error(error.message, 400);
  }

  // JWT errors
  if (error instanceof Error && (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError")) {
    return ApiResponse.error("Invalid or expired authentication token", 401);
  }

  // Zod validation errors, if thrown manually or via interceptor
  if (error instanceof Error && error.name === "ZodError") {
    try {
      const parsed = JSON.parse(error.message);
      if (Array.isArray(parsed)) {
        const errorMsg = parsed
          .map((issue: any) => issue.message || `${issue.path?.join(".") || "field"}: invalid`)
          .join(", ");
        return ApiResponse.error(errorMsg, 400);
      }
      return ApiResponse.error(typeof parsed === "string" ? parsed : error.message, 400);
    } catch {
      return ApiResponse.error(error.message, 400);
    }
  }

  logger.error("Unhandled Exception:", error);
  // Production safe: Do not leak internal stack traces or connection errors to clients
  const isProduction = process.env.NODE_ENV === "production";
  const msg = isProduction 
    ? "Internal Server Error" 
    : (error instanceof Error ? error.message : "Internal Server Error");

  return ApiResponse.error(msg, 500);
};
