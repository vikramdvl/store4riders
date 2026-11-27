import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrderDetails } from "../OrderDetails";

const mockOrderData = {
  _id: "674000000000000000a58b62",
  orderNumber: "A58B62",
  status: "shipped",
  paymentMethod: "payu",
  createdAt: "2026-11-20T10:30:00.000Z",
  pricing: {
    subtotal: 4999,
    shipping: 0,
    tax: 762,
    taxRate: 18,
    total: 4999,
  },
  shippingAddress: {
    fullName: "Vikram Kumar",
    street: "12 MG Road",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560001",
    phone: "+919876543210",
  },
  items: [
    {
      _id: "item-1",
      productId: "prod-1",
      name: "Axor Apex Venomous Helmet",
      slug: "axor-apex-venomous-helmet",
      variantId: "Size: L",
      quantity: 1,
      unitPrice: 4999,
      image: "/helmet.jpg",
    },
  ],
};

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: { success: true, data: mockOrderData },
    isLoading: false,
    error: null,
  }),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
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

vi.mock("@/core/hooks/usePaymentSettings", () => ({
  usePublicSettings: () => ({
    data: {
      enabledGateways: ["payu"],
      returnWindowDays: 7,
      exchangeShippingFee: 299,
      whatsappNumber: "+91 7263007788",
    },
  }),
}));

vi.mock("@/core/hooks/useOrderActions", () => ({
  usePayExchangeFee: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useRequestReturn: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("../ExchangeOrderModal", () => ({
  ExchangeOrderModal: () => null,
}));

vi.mock("@/modules/checkout/components/DirectUpiModal", () => ({
  DirectUpiModal: () => null,
}));

describe("OrderDetails — Clean Flipkart-Style Order Detail UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders order header, tracking route link, items, payment breakdown, and support routes", () => {
    render(<OrderDetails orderId="674000000000000000a58b62" />);

    expect(screen.getByText(/Order #A58B62/i)).toBeInTheDocument();
    expect(screen.getByText("In Transit")).toBeInTheDocument();
    expect(screen.getByText("Axor Apex Venomous Helmet")).toBeInTheDocument();
    expect(screen.getByText("Size: L")).toBeInTheDocument();

    const trackLink = screen.getByRole("link", { name: /track shipment/i });
    expect(trackLink).toHaveAttribute(
      "href",
      "/account/orders/674000000000000000a58b62/tracking"
    );

    const supportLink = screen.getByRole("link", { name: /rider support/i });
    expect(supportLink).toHaveAttribute("href", "/contact-store4riders");

    const policyLink = screen.getByRole("link", { name: /exchange policy/i });
    expect(policyLink).toHaveAttribute("href", "/returns-replacements-store4riders");
  });
});
