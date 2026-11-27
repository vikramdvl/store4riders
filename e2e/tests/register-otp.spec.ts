import { test, expect } from "@playwright/test";

test.describe("Registration Email OTP Flow", () => {
  test("verifies email with 6-digit OTP before completing registration and handles invalid OTP errors", async ({
    page,
  }) => {
    let sendOtpCalls = 0;
    let registerCalls = 0;

    await page.route("**/api/v1/auth/send-register-otp", async (route) => {
      sendOtpCalls++;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "Verification code sent to your email",
          data: {
            email: "rider.e2e@example.com",
            expiresInSeconds: 600,
            cooldownSeconds: 60,
          },
        }),
      });
    });

    await page.route("**/api/v1/auth/register", async (route) => {
      registerCalls++;
      const body = route.request().postDataJSON();

      if (body.otp !== "654321") {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            error: "Invalid verification code. 4 attempts remaining.",
            statusCode: 400,
          }),
        });
        return;
      }

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "Registered successfully",
          data: {
            accessToken: "e2e_access_token",
            refreshToken: "e2e_refresh_token",
            user: {
              id: "e2e_user_1",
              email: "rider.e2e@example.com",
              firstName: "Vikram",
              lastName: "Kumar",
              name: "Vikram Kumar",
              role: "customer",
              isEmailVerified: true,
            },
          },
        }),
      });
    });

    await page.goto("/register");

    await page.getByLabel(/Full Name/i).fill("Vikram Kumar");
    await page.getByLabel(/Email Address/i).fill("Rider.E2E@Example.com");
    await page.getByLabel(/^Password$/i).fill("Rider@1234");
    await page.getByRole("button", { name: /CREATE ACCOUNT/i }).click();

    const otpInput = page.getByLabel(/6-Digit Verification Code/i);
    await expect(otpInput).toBeVisible();
    expect(sendOtpCalls).toBe(1);

    // Wrong OTP displays server error cleanly
    await otpInput.fill("111111");
    await page.getByRole("button", { name: /VERIFY & CREATE ACCOUNT/i }).click();
    await expect(page.getByText("Invalid verification code. 4 attempts remaining.")).toBeVisible();

    // Pasting formatted OTP sends sanitized 6 digits and succeeds
    await otpInput.fill("Code: 654-321");
    await expect(otpInput).toHaveValue("654321");
    await page.getByRole("button", { name: /VERIFY & CREATE ACCOUNT/i }).click();

    await expect(page).toHaveURL(/\/$/);
    expect(registerCalls).toBe(2);
  });
});
