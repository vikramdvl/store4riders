import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { Footer } from "../Footer";

let mockPublicSettingsData: Record<string, unknown> = {
  footerConfig: {
    column1Title: "EXCHANGE & REPLACEMENTS",
    column2Title: "SUPPORT AND SERVICES",
    column3Title: "POLICIES & LEGAL",
    column4Title: "ABOUT US",
  },
};

vi.mock("@/core/hooks/usePaymentSettings", () => ({
  usePublicSettings: () => ({
    data: mockPublicSettingsData,
  }),
}));

describe("Footer Component Navigation Architecture", () => {
  it("renders distinct tabs for About Us, Exchange, Policies, and Support", () => {
    render(<Footer />);

    // Verify all 4 tab headings exist
    expect(screen.getByText("ABOUT US")).toBeInTheDocument();
    expect(screen.getByText("EXCHANGE & REPLACEMENTS")).toBeInTheDocument();
    expect(screen.getByText("POLICIES & LEGAL")).toBeInTheDocument();
    expect(screen.getByText("SUPPORT AND SERVICES")).toBeInTheDocument();

    // Verify About Us and Contact Us are rendered
    expect(screen.getByRole("link", { name: "About us" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Contact Us" })).toBeInTheDocument();

    // Verify Policy links are rendered
    expect(screen.getByRole("link", { name: "Conditions of Sale & Use" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Privacy and Cookie Policy" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Legal" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Store Policies" })).toBeInTheDocument();

    // Verify Exchange links are rendered
    expect(screen.getByRole("link", { name: "Exchange & Replacements" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Warranty" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Shipping Policies" })).toBeInTheDocument();

    // Verify Support links are rendered
    expect(screen.getByRole("link", { name: "Your Account" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Rider Assist" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cash on Delivery" })).toBeInTheDocument();
  });

  it("renders Contact Us phone as a clickable tel link on one line without breaking", () => {
    mockPublicSettingsData = {
      footerConfig: {
        showContact: true,
        contactPhone: "+91 7263007788",
        contactEmail: "contact@store4riders.com",
      },
    };

    render(<Footer />);

    const contactLink = screen.getByRole("link", { name: /Contact Us:/i });
    expect(contactLink).toBeInTheDocument();
    expect(contactLink).toHaveAttribute("href", "tel:+917263007788");
    expect(contactLink).toHaveClass("whitespace-nowrap");
    expect(contactLink).toHaveTextContent("+91 7263007788");

    const emailLink = screen.getByRole("link", { name: /Email:/i });
    expect(emailLink).toBeInTheDocument();
    expect(emailLink).toHaveAttribute("href", "mailto:contact@store4riders.com");
    expect(emailLink).toHaveClass("whitespace-nowrap");
  });
});
