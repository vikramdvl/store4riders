import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AdminAuditLogsModule } from "../components/AdminAuditLogsModule";
import { useAuthStore } from "@/stores/useAuthStore";
import * as auditHooks from "@/core/hooks/useAuditLogs";
import * as blockedHooks from "@/core/hooks/useBlockedIps";
import * as healthHooks from "@/core/hooks/useSystemHealth";

vi.mock("@/core/hooks/useAuditLogs", () => ({
  useAuditLogs: vi.fn(),
  useAuditLogStats: vi.fn(),
}));

vi.mock("@/core/hooks/useBlockedIps", () => ({
  useBlockedIps: vi.fn(),
  useBlockIp: vi.fn(),
  useUnblockIp: vi.fn(),
}));

vi.mock("@/core/hooks/useSystemHealth", () => ({
  useSystemHealth: vi.fn(),
  useAdminPaymentLogs: vi.fn(),
}));

describe("AdminAuditLogsModule", () => {
  const mockBlockMutate = vi.fn();
  const mockUnblockMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: { id: "u1", email: "owner@store4riders.com", role: "super_admin" },
      token: "test_token",
      refreshToken: null,
      isAuthenticated: true,
      isLoggingOut: false,
      lastTokenRefreshAt: Date.now(),
    });

    vi.mocked(blockedHooks.useBlockedIps).mockReturnValue({
      data: [
        {
          _id: "blk_1",
          ip: "198.51.100.99",
          reason: "Brute force attempts",
          blockedBy: { email: "owner@store4riders.com" },
          expiresAt: null,
          createdAt: "2026-11-25T10:00:00.000Z",
        },
      ],
      isLoading: false,
      refetch: vi.fn(),
    } as any);

    vi.mocked(blockedHooks.useBlockIp).mockReturnValue({
      mutate: mockBlockMutate,
      isPending: false,
    } as any);

    vi.mocked(blockedHooks.useUnblockIp).mockReturnValue({
      mutate: mockUnblockMutate,
      isPending: false,
    } as any);

    vi.mocked(healthHooks.useSystemHealth).mockReturnValue({
      data: {
        checkedAt: "2026-11-25T10:00:00.000Z",
        overallStatus: "healthy",
        api: {
          status: "healthy",
          uptimeSeconds: 3660,
          memoryUsedMb: 128,
          nodeVersion: "v20.11.0",
          environment: "production",
        },
        database: { status: "healthy", readyState: 1, latencyMs: 12 },
        redis: { status: "healthy", configured: true, latencyMs: 4 },
        meilisearch: { status: "healthy", latencyMs: 8 },
        paymentGateways: [
          {
            gateway: "payu",
            label: "PayU",
            enabled: true,
            configured: true,
            mode: "live",
            health: "operational",
            last24h: { total: 10, captured: 9, failed: 1, pending: 0 },
            lastEventAt: "2026-11-25T09:50:00.000Z",
          },
        ],
        shippingProviders: [
          { provider: "shiprocket", label: "Shiprocket", configured: true },
        ],
        recentSystemErrors24h: 0,
      },
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    } as any);

    vi.mocked(healthHooks.useAdminPaymentLogs).mockReturnValue({
      data: { items: [], totalCount: 0, page: 1, limit: 20, totalPages: 1 },
      isLoading: false,
    } as any);
  });

  it("denies access to non-admin staff roles", () => {
    useAuthStore.setState({
      user: { id: "u2", email: "logistics@store4riders.com", role: "logistic" },
      isAuthenticated: true,
    });
    vi.mocked(auditHooks.useAuditLogs).mockReturnValue({ data: undefined, isLoading: false, isFetching: false, refetch: vi.fn() } as any);
    vi.mocked(auditHooks.useAuditLogStats).mockReturnValue({ data: undefined, refetch: vi.fn() } as any);

    render(<AdminAuditLogsModule />);
    expect(screen.getByText(/Restricted Access/i)).toBeInTheDocument();
  });

  it("renders audit rows, opens drawer with Block IP action, and supports Blocked IPs & System Health tabs", () => {
    vi.mocked(auditHooks.useAuditLogStats).mockReturnValue({
      data: {
        totalLast24h: 42,
        failedLoginsLast24h: 3,
        criticalChangesLast24h: 2,
        paymentAndShippingFailuresLast24h: 1,
      },
      refetch: vi.fn(),
    } as any);

    vi.mocked(auditHooks.useAuditLogs).mockReturnValue({
      data: {
        items: [
          {
            _id: "log_1",
            category: "AUTH",
            action: "LOGIN_FAILED",
            severity: "warning",
            status: "failure",
            actor: { email: "attacker@example.com" },
            resource: { type: "Session", label: "attacker@example.com" },
            changes: { before: { status: "active" }, after: { status: "locked" } },
            context: { ip: "103.21.10.5", method: "POST", path: "/api/v1/auth/login" },
            message: "Failed login attempt for attacker@example.com",
            createdAt: "2026-11-25T10:00:00.000Z",
          },
        ],
        totalCount: 1,
        page: 1,
        limit: 25,
        totalPages: 1,
      },
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    } as any);

    render(<AdminAuditLogsModule />);

    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText(/Failed login attempt for attacker@example.com/i)).toBeInTheDocument();

    // Open detail drawer and block IP
    fireEvent.click(screen.getByText(/Failed login attempt for attacker@example.com/i));
    expect(screen.getByRole("dialog", { name: /Audit log entry details/i })).toBeInTheDocument();
    expect(screen.getAllByText("103.21.10.5")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: /Block IP/i }));
    fireEvent.click(screen.getByRole("button", { name: /Confirm Block/i }));
    expect(mockBlockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ ip: "103.21.10.5", durationHours: 24 })
    );

    // Close drawer and switch to Blocked IPs tab
    fireEvent.click(screen.getByRole("button", { name: /Close detail panel/i }));
    fireEvent.click(screen.getByRole("button", { name: /Blocked IPs/i }));
    expect(screen.getByText("198.51.100.99")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Unblock$/i }));
    expect(mockUnblockMutate).toHaveBeenCalledWith("198.51.100.99");

    // Switch to System & Gateway Health tab
    fireEvent.click(screen.getByRole("button", { name: /System & Gateway Health/i }));
    expect(screen.getByText("MongoDB Atlas")).toBeInTheDocument();
    expect(screen.getByText("12 ms")).toBeInTheDocument();
    expect(screen.getByText("PayU")).toBeInTheDocument();
    expect(screen.getByText("operational")).toBeInTheDocument();
  });
});
