import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProfileForm } from "../ProfileForm";

const mockUpdateMutateAsync = vi.fn();
const mockPasswordMutateAsync = vi.fn();
const mockLogoutMutate = vi.fn();

const mockUser = {
  id: "u1",
  firstName: "Vikram",
  lastName: "Kumar",
  email: "vikram@store4riders.com",
  phone: "+919876543210",
  addresses: [
    {
      id: "addr1",
      street: "12 MG Road",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560001",
      country: "India",
      isDefault: true,
    },
  ],
};

const mockOrders = [
  {
    _id: "order-1",
    orderNumber: "S4R-1001",
    status: "shipped",
    pricing: { total: 4999 },
    items: [{ name: "Axor Apex Helmet", image: "/helmet.jpg" }],
  },
];

const mockWishlistIds = ["prod-1", "prod-2"];
const mockSearchParams = new URLSearchParams("");

vi.mock("libphonenumber-js", () => ({
  isValidPhoneNumber: () => true,
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
}));

vi.mock("next/image", () => ({
  default: ({ fill: _fill, ...props }: any) => <img {...props} alt={props.alt || ""} />,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/ui/PhoneInput", () => ({
  default: ({ label, value, onChange, error }: any) => (
    <div>
      <label htmlFor="mock-phone">{label}</label>
      <input
        id="mock-phone"
        value={value || ""}
        onChange={(e) => onChange?.(e.target.value)}
      />
      {error && <span>{error}</span>}
    </div>
  ),
}));

vi.mock("@/stores/useAuthStore", () => ({
  useAuthStore: () => ({
    user: mockUser,
    isAuthenticated: true,
  }),
}));

vi.mock("@/core/hooks/useAuth", () => ({
  useLogout: () => ({
    mutate: mockLogoutMutate,
    isPending: false,
  }),
}));

vi.mock("@/core/hooks/useWishlist", () => ({
  useWishlist: () => ({
    data: mockWishlistIds,
  }),
}));

vi.mock("@/core/hooks/useAccount", () => ({
  useProfile: () => ({
    data: mockUser,
  }),
  useUpdateProfile: () => ({
    mutateAsync: mockUpdateMutateAsync,
    isPending: false,
  }),
  useChangePassword: () => ({
    mutateAsync: mockPasswordMutateAsync,
    isPending: false,
  }),
  useMyOrders: () => ({
    data: mockOrders,
  }),
}));

describe("ProfileForm — Flipkart-style Account Hub", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders rider profile details, quick-action grid, latest order, and default address", () => {
    render(<ProfileForm />);

    expect(screen.getByText("Vikram Kumar")).toBeInTheDocument();
    expect(screen.getAllByText("vikram@store4riders.com").length).toBeGreaterThan(0);
    expect(screen.getByText("Personal Information")).toBeInTheDocument();
    expect(screen.getByText(/S4R-1001/)).toBeInTheDocument();
    expect(screen.getByText("Axor Apex Helmet")).toBeInTheDocument();
    expect(screen.getByText(/12 MG Road, Bengaluru, Karnataka/)).toBeInTheDocument();
    expect(screen.getByText("Exchanges")).toBeInTheDocument();
  });

  it("switches Personal Information from view mode to edit mode and saves changes", async () => {
    mockUpdateMutateAsync.mockResolvedValueOnce({
      ...mockUser,
      lastName: "Singh",
    });

    render(<ProfileForm />);

    const editButtons = screen.getAllByRole("button", { name: /edit/i });
    fireEvent.click(editButtons[editButtons.length - 1]);

    const lastNameInput = await screen.findByLabelText(/last name/i);
    fireEvent.change(lastNameInput, { target: { value: "Singh" } });

    const saveBtn = screen.getByRole("button", { name: /save changes/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: "Vikram",
          lastName: "Singh",
        })
      );
    });
  });

  it("toggles Password & Security disclosure and password visibility controls", async () => {
    render(<ProfileForm />);

    const toggleSecurityBtn = screen.getByRole("button", { name: /change password/i });
    expect(toggleSecurityBtn).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggleSecurityBtn);

    expect(toggleSecurityBtn).toHaveAttribute("aria-expanded", "true");
    const newPasswordInput = await screen.findByLabelText(/^new password$/i);
    expect(newPasswordInput).toHaveAttribute("type", "password");

    const showNewBtn = screen.getByRole("button", { name: /show new password/i });
    fireEvent.click(showNewBtn);

    expect(newPasswordInput).toHaveAttribute("type", "text");
    expect(showNewBtn).toHaveAttribute("aria-pressed", "true");

    // Verify complexity validation rejects weak password missing uppercase/number/symbol
    const currentPwdInput = screen.getByLabelText(/^current password$/i);
    const confirmPwdInput = screen.getByLabelText(/^confirm new password$/i);
    fireEvent.change(currentPwdInput, { target: { value: "OldPass@123" } });
    fireEvent.change(newPasswordInput, { target: { value: "weakpass" } });
    fireEvent.change(confirmPwdInput, { target: { value: "weakpass" } });

    const updatePwdBtn = screen.getByRole("button", { name: /update password/i });
    fireEvent.click(updatePwdBtn);

    expect(await screen.findByText(/must contain at least 1 uppercase letter/i)).toBeInTheDocument();
    expect(mockPasswordMutateAsync).not.toHaveBeenCalled();
  });
});
