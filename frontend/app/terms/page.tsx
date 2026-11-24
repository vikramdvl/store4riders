import type { Metadata } from "next";
import Store4RidersConditionsPage from "../store4riders-conditions-of-use-and-sale/page";

export const metadata: Metadata = {
  title: "Conditions of Sale & Use | Store4Riders",
  description:
    "Read the terms, conditions of sale, acceptable use guidelines, and purchasing policies for Store4Riders motorcycle gear.",
  alternates: {
    canonical: "/store4riders-conditions-of-use-and-sale",
  },
};

export default function TermsPage() {
  return <Store4RidersConditionsPage />;
}
