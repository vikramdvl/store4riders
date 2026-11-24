import type { Metadata } from "next";
import { ArrowLeftRight } from "lucide-react";
import { PolicyPageLayout } from "@/components/layout/PolicyPageLayout";

export const metadata: Metadata = {
  title: "Exchange & Replacement Policy | Store4Riders",
  description:
    "Official Store4Riders exchange and replacement policy. Size & Gear Exchange on all eligible riding essentials.",
  alternates: {
    canonical: "https://store4riders.com/returns",
  },
};

export default function ReturnsPage() {
  return (
    <PolicyPageLayout
      title="Exchange & Replacement Policy"
      subtitle="Because motorcycle safety depends on a precise, secure fit, Store4Riders provides a dedicated Size & Gear Exchange on all eligible riding essentials."
      badge="Size & Fit Guarantee"
      badgeIcon={<ArrowLeftRight size={14} className="text-brand shrink-0" />}
      lastUpdated="October 2026"
      currentSlug="/returns"
      summaryAlert={{
        type: "warning",
        title: "Strict Exchange-Only Policy",
        text: (
          <span>
            Store4Riders operates on an Exchange &amp; Replacement model for size adjustments or defective items. Direct cash or bank refunds are not provided once an order has been successfully delivered in accordance with store policy.
          </span>
        ),
      }}
    >
      <section>
        <h2>1. Hassle-Free Size Exchange</h2>
        <p>
          Because motorcycle safety gear must fit securely to deliver full impact protection, Store4Riders offers a seamless <strong>Size &amp; Fit Exchange</strong> from the date of confirmed delivery. If your helmet, jacket, gloves, pants, or boots do not fit properly, we will happily exchange them for the correct size or alternative model.
        </p>

        <h2>2. Eligibility Criteria for Exchange</h2>
        <p>
          To ensure high hygiene and safety standards for all riders, items submitted for exchange must strictly fulfill these requirements:
        </p>
        <ul>
          <li><strong>Unused &amp; Unworn:</strong> The gear must not show any signs of outdoor road use, dirt, sweat, or scent.</li>
          <li><strong>Original Tags &amp; Packaging:</strong> All manufacturer tags, CE armor inserts, manuals, and original branded box must be intact.</li>
          <li><strong>Helmet Visor Peels:</strong> Protective film on helmet visors must remain completely unpeeled.</li>
          <li><strong>Timely Notice:</strong> Exchange request must be submitted within the eligible exchange window of package delivery.</li>
        </ul>

        <h2>3. Reverse Pickup &amp; Replacement Process</h2>
        <p>
          Store4Riders coordinates reverse logistics directly from your doorstep across India:
        </p>
        <div className="overflow-x-auto my-4">
          <table className="w-full">
            <thead>
              <tr>
                <th>Step</th>
                <th>Action</th>
                <th>Estimated Timeline</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>1. Raise Request</strong></td>
                <td>Submit exchange via My Orders or email contact@store4riders.com with photos.</td>
                <td>Within 24 Hours</td>
              </tr>
              <tr>
                <td><strong>2. Doorstep Pickup</strong></td>
                <td>Our courier partners pick up the packaged gear from your address.</td>
                <td>2 to 3 Business Days</td>
              </tr>
              <tr>
                <td><strong>3. QC &amp; Dispatch</strong></td>
                <td>After warehouse quality inspection, replacement size is dispatched immediately.</td>
                <td>24 to 48 Hours post QC</td>
              </tr>
            </tbody>
          </table>
        </div>

        <blockquote>
          <strong>Important Note:</strong> Products marked as &ldquo;Final Clearance&rdquo;, customized decals, balaclavas, undergarments, and base layers cannot be exchanged due to statutory hygiene guidelines.
        </blockquote>
      </section>
    </PolicyPageLayout>
  );
}
