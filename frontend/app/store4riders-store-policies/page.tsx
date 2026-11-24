import type { Metadata } from "next";
import StorePoliciesPage from "../store-policies/page";

export const metadata: Metadata = {
  title: "Store Policies & Customer Guide | Store4Riders",
  description:
    "Master directory and comprehensive guide to Store4Riders purchasing policies, exchanges, shipping rules, and customer support.",
  alternates: {
    canonical: "https://store4riders.com/store4riders-store-policies",
  },
};

export default function Store4RidersStorePoliciesPage() {
  return <StorePoliciesPage />;
}
