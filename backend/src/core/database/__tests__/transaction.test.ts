import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";
import { withTransactionSafe } from "../transaction";
import { AppError } from "../../errors/AppError";

vi.mock("../../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("withTransactionSafe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should run inside a transaction session when replica sets are supported", async () => {
    const mockSession = {
      withTransaction: vi.fn().mockImplementation(async (cb) => cb()),
      endSession: vi.fn().mockResolvedValue(undefined),
    };

    vi.spyOn(mongoose, "startSession").mockResolvedValue(mockSession as any);

    const result = await withTransactionSafe(async (session) => {
      expect(session).toBe(mockSession);
      return { success: true };
    });

    expect(result).toEqual({ success: true });
    expect(mockSession.withTransaction).toHaveBeenCalled();
    expect(mockSession.endSession).toHaveBeenCalled();
  });

  it("should gracefully fall back to non-transactional execution when MongoDB throws 'replica set member or mongos'", async () => {
    const mockSession = {
      withTransaction: vi.fn().mockImplementation(async (cb) => {
        await cb();
        throw new Error("Transaction numbers are only allowed on a replica set member or mongos");
      }),
      endSession: vi.fn().mockResolvedValue(undefined),
    };

    vi.spyOn(mongoose, "startSession").mockResolvedValue(mockSession as any);

    let executionCount = 0;
    const result = await withTransactionSafe(async (session) => {
      executionCount++;
      return { executedWithSession: !!session };
    });

    // First attempt was with session (which threw), second was fallback without session
    expect(result).toEqual({ executedWithSession: false });
    expect(executionCount).toBe(2);
    expect(mockSession.endSession).toHaveBeenCalled();
  });

  it("should re-throw genuine application errors without swallowing", async () => {
    const mockSession = {
      withTransaction: vi.fn().mockImplementation(async (cb) => cb()),
      endSession: vi.fn().mockResolvedValue(undefined),
    };

    vi.spyOn(mongoose, "startSession").mockResolvedValue(mockSession as any);

    await expect(
      withTransactionSafe(async () => {
        throw new AppError("Insufficient stock for item", 400);
      })
    ).rejects.toThrow("Insufficient stock for item");

    expect(mockSession.endSession).toHaveBeenCalled();
  });
});
