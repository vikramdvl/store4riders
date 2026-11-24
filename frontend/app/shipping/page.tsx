import type { Metadata } from "next";
import ShippingPoliciesStore4RidersPage from "../shipping-policies-store4riders/page";

export const metadata: Metadata = {
  title: "Shipping & Delivery Policy | Store4Riders",
  description:
    "Fast, reliable pan-India courier shipping for motorcycle helmets and riding gear with safe packaging and real-time tracking.",
  alternates: {
    canonical: "/shipping-policies-store4riders",
  },
};

export default function ShippingPage() {
  return <ShippingPoliciesStore4RidersPage />;
}
