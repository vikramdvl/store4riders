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

  // Zod validation errors, if thrown manually or via interceptor
  if (error instanceof Error && error.name === "ZodError") {
    try {
      return ApiResponse.error(JSON.parse(error.message), 400);
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
