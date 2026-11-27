import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST, GET } from "../../../../app/api/v1/orders/webhook/payu/[status]/route";

describe("Frontend PayU Webhook Proxy Route (/api/v1/orders/webhook/payu/[status])", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.API_URL = "https://api.store4riders.com/api/v1";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("rewrites backend redirect location onto public storefront origin while forwarding client IP", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(null, {
        status: 303,
        headers: {
          location: "https://api.store4riders.com/checkout?verifying=true&orderId=OD-PROXY-1",
        },
      })
    );

    const req = new NextRequest("https://www.store4riders.com/api/v1/orders/webhook/payu/failure", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "x-forwarded-host": "www.store4riders.com",
        "x-forwarded-proto": "https",
        "x-forwarded-for": "203.0.113.5",
      },
      body: "txnid=T999&status=pending&unmappedstatus=in+progress",
    });

    const res = await POST(req, { params: Promise.resolve({ status: "failure" }) });

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(
      "https://www.store4riders.com/checkout?verifying=true&orderId=OD-PROXY-1"
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.store4riders.com/api/v1/orders/webhook/payu/failure",
      expect.objectContaining({
        method: "POST",
        redirect: "manual",
        headers: expect.objectContaining({
          "x-forwarded-for": "203.0.113.5",
        }),
      })
    );
  });

  it("falls back safely to ?verifying=true when backend is unreachable on POST callback with txnid", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));

    const req = new NextRequest("https://www.store4riders.com/api/v1/orders/webhook/payu/failure", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "x-forwarded-host": "www.store4riders.com",
        "x-forwarded-proto": "https",
      },
      body: "txnid=T1001&status=failure",
    });

    const res = await POST(req, { params: Promise.resolve({ status: "failure" }) });

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(
      "https://www.store4riders.com/checkout?verifying=true&orderId=T1001"
    );
  });

  it("routes explicit userCancelled GET callback cleanly to ?cancelled=true", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("Network error"));

    const req = new NextRequest(
      "https://www.store4riders.com/api/v1/orders/webhook/payu/cancel?txnid=T1002",
      {
        method: "GET",
        headers: {
          "x-forwarded-host": "www.store4riders.com",
          "x-forwarded-proto": "https",
        },
      }
    );

    const res = await GET(req, { params: Promise.resolve({ status: "cancel" }) });

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(
      "https://www.store4riders.com/checkout?cancelled=true&orderId=T1002"
    );
  });
});
