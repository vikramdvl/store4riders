import type { Metadata } from "next";
import Store4RidersStorePoliciesPage from "../store4riders-store-policies/page";

export const metadata: Metadata = {
  title: "Store Policies & Customer Guide | Store4Riders",
  description:
    "Master directory and comprehensive guide to Store4Riders purchasing policies, exchanges, shipping rules, and customer support.",
  alternates: {
    canonical: "/store4riders-store-policies",
  },
};

export default function StorePoliciesPage() {
  return <Store4RidersStorePoliciesPage />;
}
