import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { RichTextEditor } from "../RichTextEditor";

describe("RichTextEditor inline image support", () => {
  it("resolves legacy Magento media directives on initial load so images render inside editor", () => {
    const onChange = vi.fn();
    const { container } = render(
      <RichTextEditor
        value='<p>Check this helmet</p><img src="{{media url="magefan_blog/1 liners.jpg"}}" alt="Liner" />'
        onChange={onChange}
      />
    );

    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe(
      "https://d2zuvpvc0pfkya.cloudfront.net/magefan_blog/1%20liners.webp"
    );
  });

  it("inserts uploaded or pasted image URLs cleanly even after modal input steals focus", () => {
    const onChange = vi.fn();
    render(<RichTextEditor value="<p>Article intro</p>" onChange={onChange} />);

    // Open insert image modal
    fireEvent.click(screen.getByTitle("Insert Image (Upload or URL)"));

    // Type an image URL in the modal input (modal steals focus from contentEditable)
    const urlInput = screen.getByPlaceholderText("https://...");
    fireEvent.change(urlInput, {
      target: { value: "https://d2zuvpvc0pfkya.cloudfront.net/uploads/test-blog-img.webp" },
    });

    const altInput = screen.getByPlaceholderText("e.g. Aerodynamic spoiler ventilation");
    fireEvent.change(altInput, { target: { value: "Test Helmet Photo" } });

    fireEvent.click(screen.getByRole("button", { name: "Insert Image" }));

    expect(onChange).toHaveBeenCalled();
    const lastHtml = onChange.mock.calls[onChange.mock.calls.length - 1][0] as string;
    expect(lastHtml).toContain("https://d2zuvpvc0pfkya.cloudfront.net/uploads/test-blog-img.webp");
    expect(lastHtml).toContain('alt="Test Helmet Photo"');
  });
});
