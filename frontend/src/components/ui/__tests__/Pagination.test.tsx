import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { Pagination, getPaginationRange } from "../Pagination";

describe("Pagination component", () => {
  it("computes compact ranges cleanly with ellipses for large page counts", () => {
    expect(getPaginationRange(1, 4)).toEqual([1, 2, 3, 4]);
    expect(getPaginationRange(2, 10)).toEqual([1, 2, 3, 4, 5, "...", 10]);
    expect(getPaginationRange(5, 10)).toEqual([1, "...", 4, 5, 6, "...", 10]);
    expect(getPaginationRange(9, 10)).toEqual([1, "...", 6, 7, 8, 9, 10]);
  });

  it("renders nothing when totalPages is 1 or less", () => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={1} onPageChange={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders item counts, page numbers, active aria-current, and handles clicks", () => {
    const onPageChange = vi.fn();
    render(
      <Pagination
        currentPage={2}
        totalPages={4}
        totalCount={55}
        pageSize={18}
        itemLabel="guides"
        onPageChange={onPageChange}
      />
    );

    expect(screen.getByText("19–36")).toBeDefined();
    expect(screen.getByText("55")).toBeDefined();

    const activeBtn = screen.getByRole("button", { name: "2" });
    expect(activeBtn.getAttribute("aria-current")).toBe("page");

    fireEvent.click(activeBtn);
    expect(onPageChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "4" }));
    expect(onPageChange).toHaveBeenCalledWith(4);

    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(onPageChange).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("disables Previous on page 1 and Next on last page", () => {
    const { rerender } = render(
      <Pagination currentPage={1} totalPages={4} onPageChange={vi.fn()} />
    );
    expect((screen.getByRole("button", { name: "Previous" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(false);

    rerender(<Pagination currentPage={4} totalPages={4} onPageChange={vi.fn()} />);
    expect((screen.getByRole("button", { name: "Previous" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
