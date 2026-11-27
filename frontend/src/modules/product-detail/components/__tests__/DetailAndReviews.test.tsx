import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { CATEGORY_SPEC_DEFINITIONS } from "@store4riders/shared-utils";
import { DetailAndReviews } from "../DetailAndReviews";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock WriteReviewModal
vi.mock("../WriteReviewModal", () => ({
  WriteReviewModal: () => <div data-testid="mock-write-review-modal" />,
}));

// Mock AllReviewsModal
vi.mock("../AllReviewsModal", () => ({
  AllReviewsModal: () => <div data-testid="mock-all-reviews-modal" />,
}));

describe("DetailAndReviews Component — Category Specifications & Attributes Template", () => {
  it("renders description and does NOT show specifications table if template/specifications are missing", () => {
    render(
      <DetailAndReviews
        fullDescription="<p>Test description for helmet</p>"
        reviews={[]}
        productName="MT Blade 2"
      />
    );

    expect(screen.getByText(/Test description for helmet/i)).toBeInTheDocument();
    expect(screen.queryByText(/Technical Specifications & Standards/i)).not.toBeInTheDocument();
  });

  it("renders specifications strictly from Category Specifications & Attributes Template and excludes unconfigured raw keys", () => {
    const attributes = {
      material: "High-Impact Polycarbonate",
      certification: "ECE 22.06 & ISI",
      pinlock_ready: "Pinlock 70 MaxVision Ready",
      closure_type: "Double D-Ring",
      suitable_for_tank: "No", // Unconfigured key — must NOT be auto-generated
      ship_cost: "250",
      attribute_set_code: "Helmets",
    };

    render(
      <DetailAndReviews
        fullDescription="<p>Full face helmet description</p>"
        reviews={[]}
        productName="MT Blade 2"
        attributes={attributes}
        specTemplate={CATEGORY_SPEC_DEFINITIONS.Helmets.fields}
      />
    );

    expect(screen.getByText(/Technical Specifications & Standards/i)).toBeInTheDocument();

    // Template labels from Helmets Category Specifications & Attributes Template
    expect(screen.getByText("Shell Material")).toBeInTheDocument();
    expect(screen.getByText("High-Impact Polycarbonate")).toBeInTheDocument();

    expect(screen.getByText("Safety Certification")).toBeInTheDocument();
    expect(screen.getByText("ECE 22.06 & ISI")).toBeInTheDocument();

    expect(screen.getByText("Pinlock Anti-Fog Ready")).toBeInTheDocument();
    expect(screen.getByText("Pinlock 70 MaxVision Ready")).toBeInTheDocument();

    expect(screen.getByText("Chin Strap Fastening")).toBeInTheDocument();
    expect(screen.getByText("Double D-Ring")).toBeInTheDocument();

    expect(screen.getAllByText("Core Spec").length).toBeGreaterThanOrEqual(1);

    // Unconfigured & ignored keys must NOT appear
    expect(screen.queryByText(/Suitable For Tank/i)).not.toBeInTheDocument();
    expect(screen.queryByText("250")).not.toBeInTheDocument();
    expect(screen.queryByText("Helmets")).not.toBeInTheDocument();
  });

  it("renders backend-resolved specifications from custom category template labels (e.g. Dry Bag luggage)", () => {
    const specifications = [
      { key: "magnetic_non_magnetic", label: "Mounting System", value: "Non Magnetic", isHighlight: false },
      { key: "convertible_in_backpack", label: "Backpack / Shoulder Conversion", value: "No", isHighlight: false },
    ];

    render(
      <DetailAndReviews
        fullDescription="<p>Rynox Expedition Dry Bag 2</p>"
        reviews={[]}
        productName="Rynox Expedition Dry Bag 2"
        specifications={specifications}
        attributes={{
          suitable_for_tank: "No",
          magnetic_non_magnetic: "Non Magnetic",
          convertible_in_backpack: "No",
        }}
      />
    );

    expect(screen.getByText("Mounting System")).toBeInTheDocument();
    expect(screen.getByText("Non Magnetic")).toBeInTheDocument();
    expect(screen.getByText("Backpack / Shoulder Conversion")).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();

    // Verify semantic table markup is used for mobile/desktop presentation
    const table = screen.getByRole("table", { name: /Technical Specifications & Standards/i });
    expect(table).toBeInTheDocument();

    // Raw unconfigured attributes must not leak
    expect(screen.queryByText(/Suitable For Tank/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Magnetic Non Magnetic/i)).not.toBeInTheDocument();
  });

  it("strictly filters out legacy Magento junk (Condition, mangled keys, HTML size charts)", () => {
    const legacyJunkAttributes = {
      Condition: "New",
      '|"Unisex",Brand': "SMK Helmets",
      "Size Chart 01": "<p><strong>SMK Size Chart:</strong></p><table><tbody><tr><td>M</td></tr></tbody></table>",
    };

    render(
      <DetailAndReviews
        fullDescription="<p>Full face helmet description</p>"
        reviews={[]}
        productName="SMK Gullwing"
        attributes={legacyJunkAttributes}
        specTemplate={CATEGORY_SPEC_DEFINITIONS.Helmets.fields}
      />
    );

    expect(screen.queryByText(/Technical Specifications & Standards/i)).not.toBeInTheDocument();
    expect(screen.queryByText("New")).not.toBeInTheDocument();
    expect(screen.queryByText(/SMK Size Chart/i)).not.toBeInTheDocument();
  });

  it("does NOT auto-generate specifications by scraping description bullet points when template fields have no values", () => {
    const descriptionWithSpecs = `
      <p>SMK Gullwing Modular Helmet</p>
      <ul>
        <li>External Shell: Aerodynamic Energy Impact Resistant Thermoplastic (EIRT)</li>
        <li>Homologation: Double ECE 22.05 (P/J) homologation</li>
      </ul>
    `;

    render(
      <DetailAndReviews
        fullDescription={descriptionWithSpecs}
        reviews={[]}
        productName="SMK Gullwing"
        attributes={{ Condition: "New" }}
        specTemplate={CATEGORY_SPEC_DEFINITIONS.Helmets.fields}
      />
    );

    // Description renders above, but no Technical Specifications & Standards table is auto-generated
    expect(screen.getByText(/SMK Gullwing Modular Helmet/i)).toBeInTheDocument();
    expect(screen.queryByText(/Technical Specifications & Standards/i)).not.toBeInTheDocument();
  });

  it("resolves and displays fullDescription images with valid AWS S3 URLs", () => {
    const descriptionWithImages = `
      <p>Rynox Jacket Features</p>
      <img src="{{media url=&quot;wysiwyg/Rynox product description photos/Rynox Urban X riding jacket Powertector Air-Tec Chest Protection.jpg&quot;}}" alt="Chest Protection" />
      <img src="https://store4riders.s3.ap-south-2.amazonaws.com/catalog/product/wysiwyg/smk-twister-specification.JPG" alt="Twister Specs" />
      <img src="https://store4riders.s3.ap-south-2.amazonaws.com/catalog/product/axor-apex-turbine-security.jpg" alt="Axor Security" />
    `;

    const { container } = render(
      <DetailAndReviews
        fullDescription={descriptionWithImages}
        reviews={[]}
        productName="Rynox Urban X"
      />
    );

    const images = container.querySelectorAll("img");
    expect(images.length).toBe(3);

    expect(images[0].getAttribute("src")).toBe(
      "https://store4riders.s3.ap-south-2.amazonaws.com/wysiwyg/Rynox%20product%20description%20photos/Rynox%20Urban%20X%20riding%20jacket%20Powertector%20Air-Tec%20Chest%20Protection.jpg"
    );
    expect(images[1].getAttribute("src")).toBe(
      "https://store4riders.s3.ap-south-2.amazonaws.com/wysiwyg/smk-twister-specification.JPG"
    );
    expect(images[2].getAttribute("src")).toBe(
      "https://store4riders.s3.ap-south-2.amazonaws.com/wysiwyg/axor-apex-turbine-security.jpg"
    );
  });
});
