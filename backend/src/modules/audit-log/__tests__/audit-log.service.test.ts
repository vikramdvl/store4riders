import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { AuditLogService } from "../audit-log.service";
import { AuditLogRepository } from "../audit-log.repository";
import { AuditLogValidator } from "../audit-log.validator";
import { UserRepository } from "../../user/user.repository";

vi.mock("../audit-log.repository", async () => {
  const actual = await vi.importActual<typeof import("../audit-log.repository")>("../audit-log.repository");
  return {
    AuditLogRepository: {
      buildFilterQuery: actual.AuditLogRepository.buildFilterQuery.bind(actual.AuditLogRepository),
      create: vi.fn(),
      findPaginated: vi.fn(),
      findById: vi.fn(),
      getLast24hStats: vi.fn(),
    },
  };
});

vi.mock("../../user/user.repository", () => ({
  UserRepository: {
    findById: vi.fn(),
  },
}));

describe("AuditLogService & Validator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("masks sensitive keys in changes and metadata before persisting", async () => {
    vi.mocked(UserRepository.findById).mockResolvedValue({
      _id: "admin_1",
      email: "owner@store4riders.com",
      firstName: "Vikram",
      lastName: "Admin",
      role: "super_admin",
    } as any);
    vi.mocked(AuditLogRepository.create).mockResolvedValue({} as any);

    await AuditLogService.record({
      category: "ADMIN",
      action: "SETTINGS_UPDATED",
      severity: "critical",
      actorUserId: "admin_1",
      resource: { type: "StoreSettings", label: "Global Store Settings" },
      changes: {
        before: { taxRate: 18, payuSalt: "old_salt_value" },
        after: { taxRate: 12, payuSalt: "new_salt_value", workingKey: "wk_123" },
      },
      metadata: { apiKey: "secret_api_key", mode: "live" },
      message: "Updated store configuration",
    });

    expect(AuditLogRepository.create).toHaveBeenCalledTimes(1);
    const saved = vi.mocked(AuditLogRepository.create).mock.calls[0][0];
    expect(saved.actor.email).toBe("owner@store4riders.com");
    expect(saved.actor.role).toBe("super_admin");
    expect(saved.changes?.before?.taxRate).toBe(18);
    expect(saved.changes?.before?.payuSalt).toBe("[REDACTED]");
    expect(saved.changes?.after?.payuSalt).toBe("[REDACTED]");
    expect(saved.changes?.after?.workingKey).toBe("[REDACTED]");
    expect(saved.metadata?.apiKey).toBe("[REDACTED]");
    expect(saved.metadata?.mode).toBe("live");
  });

  it("computes field diffs only for changed properties and redacts sensitive fields", () => {
    const diff = AuditLogService.computeFieldDiff(
      { basePrice: 4500, name: "Helmet", payuSalt: "old" },
      { basePrice: 3999, name: "Helmet", payuSalt: "new" }
    );

    expect(diff).toEqual({
      before: { basePrice: 4500, payuSalt: "[REDACTED]" },
      after: { basePrice: 3999, payuSalt: "[REDACTED]" },
    });
  });

  it("never throws when repository persistence fails", async () => {
    vi.mocked(AuditLogRepository.create).mockRejectedValueOnce(new Error("DB offline"));

    await expect(
      AuditLogService.record({
        category: "AUTH",
        action: "LOGIN_FAILED",
        severity: "warning",
        status: "failure",
        resource: { type: "Session", label: "test@example.com" },
        message: "Failed login",
      })
    ).resolves.toBeUndefined();
  });

  it("escapes regex metacharacters in search queries to prevent ReDoS/NoSQL injection", () => {
    const query = AuditLogRepository.buildFilterQuery({
      search: "admin+test.(com)$",
      category: "AUTH",
    });

    expect(query.category).toBe("AUTH");
    expect(query.$or[0].message.$regex).toBe("admin\\+test\\.\\(com\\)\\$");
  });

  it("validates pagination and filter query parameters via Zod", () => {
    const req = new NextRequest("http://localhost:4000/api/v1/admin/audit-logs?page=2&limit=50&category=PAYMENT&status=failure");
    const parsed = AuditLogValidator.validateQuery(req);
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(50);
    expect(parsed.category).toBe("PAYMENT");
    expect(parsed.status).toBe("failure");

    const badReq = new NextRequest("http://localhost:4000/api/v1/admin/audit-logs?category=INVALID_CAT");
    expect(() => AuditLogValidator.validateQuery(badReq)).toThrow();
  });
});
