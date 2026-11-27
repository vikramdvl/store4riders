import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PostCheckoutRegisterForm } from "../PostCheckoutRegisterForm";
import { apiClient } from "@/core/api/client";

const mockSendOtpMutate = vi.fn();
const mockRegisterMutate = vi.fn();
const mockLoginMutate = vi.fn();
const mockForgotMutate = vi.fn();
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/core/api/client", () => ({
  apiClient: {
    post: vi.fn(),
    put: vi.fn(),
  },
}));

vi.mock("@/core/hooks/useAuth", () => ({
  useSendRegisterOtp: () => ({
    mutate: mockSendOtpMutate,
    isPending: false,
  }),
  useRegister: () => ({
    mutate: mockRegisterMutate,
    isPending: false,
    isSuccess: false,
  }),
  useLogin: () => ({
    mutate: mockLoginMutate,
    isPending: false,
    isSuccess: false,
    isError: false,
  }),
  useForgotPassword: () => ({
    mutate: mockForgotMutate,
    isPending: false,
  }),
}));

describe("PostCheckoutRegisterForm — Email OTP & Edge Cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires email OTP verification before creating a new post-checkout account and saves shipping address", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: { data: { exists: false } },
    });

    mockSendOtpMutate.mockImplementation((_payload, options) => {
      options?.onSuccess?.({
        data: { email: "guest@example.com", expiresInSeconds: 600, cooldownSeconds: 60 },
      });
    });

    mockRegisterMutate.mockImplementation((_payload, options) => {
      options?.onSuccess?.({});
    });

    render(
      <PostCheckoutRegisterForm
        email="Guest@Example.com"
        name="Aarav Mehta"
        phone="9876543210"
        shippingAddress={{
          street: "42 Residency Road",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560025",
          country: "India",
          isDefault: true,
        }}
      />
    );

    const passwordInput = await screen.findByLabelText(/Set a Password/i);
    fireEvent.change(passwordInput, { target: { value: "Rider@1234" } });

    fireEvent.click(screen.getByRole("button", { name: /Verify Email & Create Account/i }));

    await waitFor(() => {
      expect(mockSendOtpMutate).toHaveBeenCalledWith(
        { email: "guest@example.com" },
        expect.any(Object)
      );
    });

    const otpInput = await screen.findByLabelText(/6-Digit Verification Code/i);
    fireEvent.change(otpInput, { target: { value: "OTP: 654 321" } });
    fireEvent.click(screen.getByRole("button", { name: /Verify & Track Order/i }));

    await waitFor(() => {
      expect(mockRegisterMutate).toHaveBeenCalledWith(
        {
          email: "guest@example.com",
          password: "Rider@1234",
          firstName: "Aarav",
          lastName: "Mehta",
          phone: "+919876543210",
          otp: "654321",
        },
        expect.any(Object)
      );
    });

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith("/users/me/addresses", {
        street: "42 Residency Road",
        city: "Bengaluru",
        state: "Karnataka",
        pincode: "560025",
        country: "India",
        isDefault: true,
      });
    });
  });

  it("sanitizes non-alpha checkout names safely and handles inline OTP send errors", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { data: { exists: false } },
    });

    mockSendOtpMutate
      .mockImplementationOnce((_payload, options) => {
        options?.onError?.({
          response: { data: { error: "Please wait 30 seconds before requesting a new verification code" } },
        });
      })
      .mockImplementationOnce((_payload, options) => {
        options?.onSuccess?.({
          data: { email: "99@example.com", expiresInSeconds: 600, cooldownSeconds: 60 },
        });
      });

    render(<PostCheckoutRegisterForm email="99@example.com" name="A 123" />);

    const passwordInput = await screen.findByLabelText(/Set a Password/i);
    fireEvent.change(passwordInput, { target: { value: "Rider@1234" } });

    fireEvent.click(screen.getByRole("button", { name: /Verify Email & Create Account/i }));
    expect(
      await screen.findByText("Please wait 30 seconds before requesting a new verification code")
    ).toBeInTheDocument();

    // Retry succeeds and falls back to safe alpha firstName "Rider"
    fireEvent.click(screen.getByRole("button", { name: /Verify Email & Create Account/i }));
    const otpInput = await screen.findByLabelText(/6-Digit Verification Code/i);
    fireEvent.change(otpInput, { target: { value: "112233" } });
    fireEvent.click(screen.getByRole("button", { name: /Verify & Track Order/i }));

    await waitFor(() => {
      expect(mockRegisterMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "99@example.com",
          firstName: "Rider",
          otp: "112233",
        }),
        expect.any(Object)
      );
    });
  });

  it("resets OTP step when email prop changes and supports Edit password back navigation", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: { data: { exists: false } },
    });

    mockSendOtpMutate.mockImplementation((payload, options) => {
      options?.onSuccess?.({
        data: { email: payload.email, expiresInSeconds: 600, cooldownSeconds: 60 },
      });
    });

    const { rerender } = render(<PostCheckoutRegisterForm email="first@example.com" name="Vikram" />);

    fireEvent.change(await screen.findByLabelText(/Set a Password/i), { target: { value: "Rider@1234" } });
    fireEvent.click(screen.getByRole("button", { name: /Verify Email & Create Account/i }));

    await screen.findByLabelText(/6-Digit Verification Code/i);
    fireEvent.click(screen.getByRole("button", { name: /Edit password/i }));
    expect(await screen.findByLabelText(/Set a Password/i)).toBeInTheDocument();

    // Go to OTP step again and change email prop
    fireEvent.click(screen.getByRole("button", { name: /Verify Email & Create Account/i }));
    await screen.findByLabelText(/6-Digit Verification Code/i);

    rerender(<PostCheckoutRegisterForm email="second@example.com" name="Vikram" />);
    expect(await screen.findByLabelText(/Set a Password/i)).toBeInTheDocument();
  });

  it("keeps direct password login without OTP when email is already registered", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { data: { exists: true } },
    });

    render(<PostCheckoutRegisterForm email="existing@example.com" name="Aarav Mehta" />);

    const passwordInput = await screen.findByLabelText(/Enter Password/i);
    fireEvent.change(passwordInput, { target: { value: "Existing@123" } });
    fireEvent.click(screen.getByRole("button", { name: /Log In & Track Order/i }));

    await waitFor(() => {
      expect(mockLoginMutate).toHaveBeenCalledWith(
        { email: "existing@example.com", password: "Existing@123" },
        expect.any(Object)
      );
    });
    expect(mockSendOtpMutate).not.toHaveBeenCalled();
  });
});
