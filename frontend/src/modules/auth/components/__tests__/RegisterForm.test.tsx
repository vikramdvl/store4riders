import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RegisterForm } from "../RegisterForm";

const mockSendOtpMutate = vi.fn();
const mockRegisterMutate = vi.fn();

vi.mock("@/core/hooks/useAuth", () => ({
  useSendRegisterOtp: () => ({
    mutate: mockSendOtpMutate,
    isPending: false,
  }),
  useRegister: () => ({
    mutate: mockRegisterMutate,
    isPending: false,
  }),
}));

describe("RegisterForm — Email OTP Verification & Edge Cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("blocks invalid name, invalid email, and weak password before sending OTP", async () => {
    render(<RegisterForm />);

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: "A 123" } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: "bad-email" } });
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: "weak" } });
    fireEvent.click(screen.getByRole("button", { name: /CREATE ACCOUNT/i }));

    await waitFor(() => {
      expect(screen.getAllByRole("alert").length).toBeGreaterThanOrEqual(3);
    });
    expect(mockSendOtpMutate).not.toHaveBeenCalled();
  });

  it("toggles password visibility with accessible aria-pressed state", () => {
    render(<RegisterForm />);
    const passwordInput = screen.getByLabelText(/^Password$/i) as HTMLInputElement;
    const toggleButton = screen.getByRole("button", { name: /Show password/i });

    expect(passwordInput.type).toBe("password");
    expect(toggleButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(toggleButton);
    expect(passwordInput.type).toBe("text");
    expect(screen.getByRole("button", { name: /Hide password/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows inline error on Step 1 when send-register-otp returns 409 Conflict", async () => {
    mockSendOtpMutate.mockImplementation((_payload, options) => {
      options?.onError?.({
        response: { data: { error: "Email already in use" } },
      });
    });

    render(<RegisterForm />);
    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: "Vikram Kumar" } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: "taken@example.com" } });
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: "Rider@1234" } });
    fireEvent.click(screen.getByRole("button", { name: /CREATE ACCOUNT/i }));

    expect(await screen.findByText("Email already in use")).toBeInTheDocument();
    expect(screen.queryByLabelText(/6-Digit Verification Code/i)).not.toBeInTheDocument();
  });

  it("strips non-digits from formatted OTP pastes while keeping leading zeros and submits cleanly", async () => {
    mockSendOtpMutate.mockImplementation((_payload, options) => {
      options?.onSuccess?.({
        data: { email: "vikram@example.com", expiresInSeconds: 600, cooldownSeconds: 60 },
      });
    });

    render(<RegisterForm />);

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: "Vikram Kumar" } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: "Vikram@Example.com" } });
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: "Rider@1234" } });
    fireEvent.click(screen.getByRole("button", { name: /CREATE ACCOUNT/i }));

    const otpInput = await screen.findByLabelText(/6-Digit Verification Code/i);
    expect(otpInput).toHaveAttribute("autocomplete", "one-time-code");
    expect(otpInput).toHaveAttribute("inputmode", "numeric");

    // Empty submit shows validation message
    fireEvent.click(screen.getByRole("button", { name: /VERIFY & CREATE ACCOUNT/i }));
    expect(await screen.findByText(/Please enter the 6-digit verification code/i)).toBeInTheDocument();
    expect(mockRegisterMutate).not.toHaveBeenCalled();

    // Pasting a formatted string with prefix, spaces, hyphen, and leading zero preserves all 6 digits
    fireEvent.change(otpInput, { target: { value: "Code: 012-345 " } });
    expect((otpInput as HTMLInputElement).value).toBe("012345");

    fireEvent.click(screen.getByRole("button", { name: /VERIFY & CREATE ACCOUNT/i }));

    await waitFor(() => {
      expect(mockRegisterMutate).toHaveBeenCalledWith(
        {
          email: "vikram@example.com",
          password: "Rider@1234",
          firstName: "Vikram",
          lastName: "Kumar",
          otp: "012345",
        },
        expect.any(Object)
      );
    });
  });

  it("displays server OTP failure, enforces resend cooldown countdown, and allows resending at 0s", async () => {
    vi.useFakeTimers();

    mockSendOtpMutate.mockImplementation((_payload, options) => {
      options?.onSuccess?.({
        data: { email: "vikram@example.com", expiresInSeconds: 600, cooldownSeconds: 3 },
      });
    });

    mockRegisterMutate.mockImplementation((_payload, options) => {
      options?.onError?.({
        response: { data: { error: "Invalid verification code. 4 attempts remaining." } },
      });
    });

    render(<RegisterForm />);
    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: "Vikram Kumar" } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: "vikram@example.com" } });
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: "Rider@1234" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /CREATE ACCOUNT/i }));
    });

    const otpInput = screen.getByLabelText(/6-Digit Verification Code/i);
    fireEvent.change(otpInput, { target: { value: "999999" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /VERIFY & CREATE ACCOUNT/i }));
    });

    expect(screen.getByText("Invalid verification code. 4 attempts remaining.")).toBeInTheDocument();

    const resendBtn = screen.getByRole("button", { name: /Resend in 3s/i });
    expect(resendBtn).toBeDisabled();

    // Advance 3 seconds for cooldown to expire
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    const activeResendBtn = screen.getByRole("button", { name: /Resend Code/i });
    expect(activeResendBtn).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(activeResendBtn);
    });
    expect(mockSendOtpMutate).toHaveBeenCalledTimes(2);
  });

  it("skips resending OTP when only name/password change, but sends fresh OTP if email changes", async () => {
    mockSendOtpMutate.mockImplementation((payload, options) => {
      options?.onSuccess?.({
        data: { email: payload.email, expiresInSeconds: 600, cooldownSeconds: 60 },
      });
    });

    render(<RegisterForm />);

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: "Vikram Kumar" } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: "vikram@example.com" } });
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: "Rider@1234" } });
    fireEvent.click(screen.getByRole("button", { name: /CREATE ACCOUNT/i }));

    await screen.findByLabelText(/6-Digit Verification Code/i);
    expect(mockSendOtpMutate).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /Edit details/i }));

    fireEvent.change(await screen.findByLabelText(/Full Name/i), { target: { value: "Vikram Singh" } });
    fireEvent.click(screen.getByRole("button", { name: /CREATE ACCOUNT/i }));

    await screen.findByLabelText(/6-Digit Verification Code/i);
    expect(mockSendOtpMutate).toHaveBeenCalledTimes(1);

    // Now go back and change email -> must trigger a new send-register-otp call
    fireEvent.click(screen.getByRole("button", { name: /Edit details/i }));
    fireEvent.change(await screen.findByLabelText(/Email Address/i), { target: { value: "other@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /CREATE ACCOUNT/i }));

    await screen.findByLabelText(/6-Digit Verification Code/i);
    expect(mockSendOtpMutate).toHaveBeenCalledTimes(2);
    expect(mockSendOtpMutate).toHaveBeenLastCalledWith({ email: "other@example.com" }, expect.any(Object));
  });
});
