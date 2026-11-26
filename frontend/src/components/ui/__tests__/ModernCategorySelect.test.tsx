import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ModernCategorySelect, MultiCategorySelect } from "../ModernCategorySelect";

const SAMPLE_DB_CATEGORIES = [
  {
    _id: "id-helmets",
    name: "Motorcycle Helmets",
    slug: "motorcycle-helmets",
    includeInMenu: true,
    children: [
      {
        _id: "id-full-face",
        name: "Full Face Helmets",
        slug: "full-face-helmets",
        includeInMenu: true,
        children: [],
      },
      {
        _id: "id-helmet-acc",
        name: "Helmet Accessories / Helmet Visors",
        slug: "helmet-accessories",
        includeInMenu: true,
        children: [],
      },
      {
        _id: "id-helmet-acc-dup",
        name: "Helmet Accessories / Helmet Visors",
        slug: "helmet-accessories-helmet-visors",
        includeInMenu: true,
        children: [],
      },
    ],
  },
  {
    _id: "id-spares",
    name: "Bike Spare Parts Online",
    slug: "spares",
    includeInMenu: true,
    children: [],
  },
  {
    _id: "id-spares-dup",
    name: "Spares",
    slug: "bike-spares",
    includeInMenu: true,
    children: [],
  },
  {
    _id: "id-exhausts",
    name: "Bike Exhausts",
    slug: "exhausts",
    includeInMenu: true,
    children: [],
  },
  {
    _id: "id-exhausts-dup",
    name: "Exhausts",
    slug: "bike-exhausts",
    includeInMenu: true,
    children: [],
  },
  {
    _id: "id-seo-best-5000",
    name: "Best helmets under Rs.5000",
    slug: "best-helmets-under-rs-5000",
    includeInMenu: false,
    children: [],
  },
  {
    _id: "id-empty-name",
    name: "",
    slug: "broken-empty-cat",
    includeInMenu: true,
    children: [],
  },
  {
    _id: "id-test-cat",
    name: "Test Category",
    slug: "test-category",
    includeInMenu: false,
    children: [],
  },
  {
    _id: "id-root-test",
    name: "Root Test 01",
    slug: "root-test-01",
    includeInMenu: true,
    children: [],
  },
];

describe("ModernCategorySelect and MultiCategorySelect", () => {
  it("deduplicates alias and identical-name categories while hiding test and empty-name categories", () => {
    const onChange = vi.fn();
    render(
      <ModernCategorySelect
        value="id-spares"
        onChange={onChange}
        dbCategories={SAMPLE_DB_CATEGORIES}
      />
    );

    // Selected category resolved cleanly via database _id even though Spares is aliased to /bike-spares in nav
    expect(screen.getByText("Bike Spare Parts Online")).toBeDefined();

    // Open dropdown
    fireEvent.click(screen.getByRole("button"));

    // Spares, Exhausts, Helmet Accessories appear once each (not duplicated by bike-spares/bike-exhausts/helmet-visors)
    expect(screen.queryAllByRole("button", { name: /^Bike Spare Parts Online$/i }).length).toBe(1);
    expect(screen.queryAllByRole("button", { name: /^Spares$/i }).length).toBe(0);
    expect(screen.queryAllByRole("button", { name: /Exhausts/i }).length).toBe(1);
    expect(screen.queryAllByRole("button", { name: /Helmet Accessories/i }).length).toBe(1);

    // Non-duplicate SEO category remains available
    expect(screen.getByRole("button", { name: /Best helmets under Rs\.5000/i })).toBeDefined();

    // Test and empty categories are excluded
    expect(screen.queryByText(/Test Category/i)).toBeNull();
    expect(screen.queryByText(/Root Test 01/i)).toBeNull();
    expect(screen.queryByText(/broken-empty-cat/i)).toBeNull();
  });

  it("matches and toggles equivalent aliases without adding duplicate secondary slugs in MultiCategorySelect", () => {
    const onChange = vi.fn();
    render(
      <MultiCategorySelect
        values={["bike-spares"]}
        onChange={onChange}
        dbCategories={SAMPLE_DB_CATEGORIES}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Search and attach/i }));

    // Clicking the canonical Spares option removes the equivalent bike-spares entry cleanly
    fireEvent.click(screen.getByRole("button", { name: /^Bike Spare Parts Online$/i }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
