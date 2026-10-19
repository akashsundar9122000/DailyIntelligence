import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PalettePicker } from "@/components/ui/palette-picker";
import { PALETTE_COPY } from "@/config/themes";
import { PALETTES } from "@/lib/design/palettes";
import { PALETTE_STORAGE_KEY } from "@/lib/design/theme-script";

describe("PalettePicker", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.dataset.palette = "aurora";
    document.documentElement.dataset.theme = "light";
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    );
  });

  it("offers every palette as one radio group, named and described in words", () => {
    render(<PalettePicker />);
    expect(screen.getByRole("group", { name: "Theme" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio").map((radio) => radio.getAttribute("value"))).toEqual([...PALETTES]);
    for (const palette of PALETTES) {
      const radio = screen.getByRole("radio", { name: new RegExp(PALETTE_COPY[palette].name) });
      // The preview is decoration; the summary is what a screen reader hears.
      expect(radio).toHaveAccessibleDescription(PALETTE_COPY[palette].summary);
    }
    expect(screen.getByRole("radio", { name: /Aurora/ })).toBeChecked();
  });

  it("applies and keeps a choice in this browser when signed out", () => {
    render(<PalettePicker />);
    fireEvent.click(screen.getByRole("radio", { name: /Newspaper/ }));
    expect(document.documentElement.dataset.palette).toBe("newspaper");
    expect(localStorage.getItem(PALETTE_STORAGE_KEY)).toBe("newspaper");
    expect(screen.getByRole("radio", { name: /Newspaper/ })).toBeChecked();
  });

  it("hands the choice to the caller instead, when signed in", () => {
    const onChoose = vi.fn();
    render(<PalettePicker onChoose={onChoose} />);
    fireEvent.click(screen.getByRole("radio", { name: /Newspaper/ }));
    expect(onChoose).toHaveBeenCalledWith("newspaper");
    // The store applies it; the picker does not apply it a second way behind the store's back.
    expect(localStorage.getItem(PALETTE_STORAGE_KEY)).toBeNull();
  });

  it("draws each preview in its own palette, in the mode on screen", () => {
    document.documentElement.dataset.theme = "dark";
    const { container } = render(<PalettePicker />);
    const previews = [...container.querySelectorAll("[data-preview-palette]")];
    expect(previews.map((el) => el.getAttribute("data-preview-palette"))).toEqual([...PALETTES]);
    for (const preview of previews) {
      expect(preview).toHaveAttribute("data-preview-mode", "dark");
      expect(preview).toHaveAttribute("aria-hidden", "true");
    }
  });
});
