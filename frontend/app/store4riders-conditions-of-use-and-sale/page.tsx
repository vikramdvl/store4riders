import type { Metadata } from "next";
import TermsPage from "../terms/page";

export const metadata: Metadata = {
  title: "Conditions of Sale & Use | Store4Riders",
  description:
    "Read the terms, conditions of sale, acceptable use guidelines, and purchasing policies for Store4Riders motorcycle gear.",
  alternates: {
    canonical: "https://store4riders.com/store4riders-conditions-of-use-and-sale",
  },
};

export default function Store4RidersConditionsPage() {
  return <TermsPage />;
}
