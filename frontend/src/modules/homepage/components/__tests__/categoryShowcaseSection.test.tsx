import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { CategoryShowcaseSection } from "../CategoryShowcaseSection";

describe("CategoryShowcaseSection Component", () => {
  it("renders all 4 showcase categories correctly with default props", () => {
    render(<CategoryShowcaseSection />);

    // Verify all 4 category titles are displayed
    expect(screen.getByText("RIDING BOOTS")).toBeInTheDocument();
    expect(screen.getByText("RIDING PANTS")).toBeInTheDocument();
    expect(screen.getByText("MOTORCYCLE LUGGAGE")).toBeInTheDocument();
    expect(screen.getByText("BIKE ACCESSORIES AND SPARES")).toBeInTheDocument();

    // Verify images are rendered
    expect(screen.getByAltText("RIDING BOOTS")).toBeInTheDocument();
    expect(screen.getByAltText("RIDING PANTS")).toBeInTheDocument();
    expect(screen.getByAltText("MOTORCYCLE LUGGAGE")).toBeInTheDocument();
    expect(screen.getByAltText("BIKE ACCESSORIES AND SPARES")).toBeInTheDocument();

    // Verify guide link and bottom motocross note
    expect(screen.getByRole("link", { name: "chain lubing guide." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "off-road and motocross gear." })).toBeInTheDocument();
  });

  it("renders placeholder text when imageUrl is not provided", () => {
    render(
      <CategoryShowcaseSection
        cards={[
          {
            id: "boots",
            title: "RIDING BOOTS",
            description: "Short biking boots...",
            linkUrl: "/riding-gear/motorcycle-riding-boots",
            placeholderText: "PHOTO: RIDING BOOTS",
          },
        ]}
      />
    );
    expect(screen.getByText("PHOTO: RIDING BOOTS")).toBeInTheDocument();
  });

  it("renders with custom title and subtitle", () => {
    render(
      <CategoryShowcaseSection
        title="RIDER'S ESSENTIAL GEAR"
        subtitle="Curated gear for every rider"
      />
    );

    expect(screen.getByText("RIDER'S ESSENTIAL GEAR")).toBeInTheDocument();
    expect(
      screen.getByText("Curated gear for every rider")
    ).toBeInTheDocument();
  });

  it("renders custom card title, description, badge text, and bottom note", () => {
    render(
      <CategoryShowcaseSection
        title="CUSTOM GEAR HEADING"
        bottomNoteText="Need racing gear? Check "
        bottomNoteLinkText="track day suits."
        bottomNoteLinkUrl="/products?q=racing"
        cards={[
          {
            id: "custom-1",
            title: "TRACK SUITS",
            description: "Full grain 1.3mm leather suits with CE Level 2 protectors.",
            linkUrl: "/riding-gear/suits",
            imageUrl: "https://example.com/suit.jpg",
            placeholderText: "PHOTO: SUIT",
            badgeText: "HOT",
          },
        ]}
      />
    );

    expect(screen.getByText("CUSTOM GEAR HEADING")).toBeInTheDocument();
    expect(screen.getByText("TRACK SUITS")).toBeInTheDocument();
    expect(
      screen.getByText("Full grain 1.3mm leather suits with CE Level 2 protectors.")
    ).toBeInTheDocument();
    expect(screen.getByText("HOT")).toBeInTheDocument();
    expect(screen.getByText("Need racing gear? Check")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "track day suits." })).toBeInTheDocument();
  });
});
