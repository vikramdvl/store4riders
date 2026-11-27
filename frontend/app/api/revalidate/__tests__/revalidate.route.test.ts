import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const revalidatePathMock = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: (...args: any[]) => revalidatePathMock(...args),
}));

import { POST } from "../route";

describe("POST /api/revalidate — Admin Auth Cookie & Scope Regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("authenticates adminAccessToken cookie with x-auth-scope: admin and revalidates requested paths", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { role: "super_admin" } }),
    } as Response);

    const req = new NextRequest("https://admin.store4riders.com/api/revalidate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: "adminAccessToken=admin_cookie_jwt",
      },
      body: JSON.stringify({
        paths: ["/", "/products", "/motorcycle-helmets/helmet-cleaners"],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\/users\/me$/),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer admin_cookie_jwt",
          "x-auth-scope": "admin",
        }),
      })
    );

    expect(revalidatePathMock).toHaveBeenCalledWith("/");
    expect(revalidatePathMock).toHaveBeenCalledWith("/products");
    expect(revalidatePathMock).toHaveBeenCalledWith("/motorcycle-helmets/helmet-cleaners");

    fetchSpy.mockRestore();
  });
});
