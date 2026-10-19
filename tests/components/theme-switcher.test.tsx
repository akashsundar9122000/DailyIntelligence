import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { MODE_STORAGE_KEY } from "@/lib/design/theme-script";

function stubSystem(dark: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: dark, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
}

describe("ThemeSwitcher", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    delete document.documentElement.dataset.themePref;
    stubSystem(false);
  });

  it("offers the device setting, day and night as one radio group", () => {
    render(<ThemeSwitcher />);
    expect(screen.getByRole("group", { name: "Colour scheme" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio").map((radio) => radio.getAttribute("value"))).toEqual([
      "system",
      "light",
      "dark",
    ]);
    expect(screen.getByRole("radio", { name: "Match device" })).toBeChecked();
  });

  it("applies and stores an explicit choice", () => {
    render(<ThemeSwitcher />);
    fireEvent.click(screen.getByRole("radio", { name: "Night" }));

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(MODE_STORAGE_KEY)).toBe("dark");
    expect(screen.getByRole("radio", { name: "Night" })).toBeChecked();
  });

  it("forgets the stored choice when the device setting is picked again", () => {
    stubSystem(true);
    render(<ThemeSwitcher />);
    fireEvent.click(screen.getByRole("radio", { name: "Day" }));
    fireEvent.click(screen.getByRole("radio", { name: "Match device" }));

    // Storing the resolved value would freeze it: the page would stop following the OS.
    expect(localStorage.getItem(MODE_STORAGE_KEY)).toBeNull();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
