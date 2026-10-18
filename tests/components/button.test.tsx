import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("does not submit a surrounding form unless asked to", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("type", "button");
  });

  it("can be a submit button", () => {
    render(<Button type="submit">Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("type", "submit");
  });

  it("is disabled and announced as busy while loading", () => {
    render(<Button loading>Saving</Button>);
    const button = screen.getByRole("button", { name: "Saving" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("renders as its child so navigation stays a real link", () => {
    render(
      <Button asChild>
        <a href="/app/hot">Read Hot Now</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Read Hot Now" });
    expect(link).toHaveAttribute("href", "/app/hot");
    expect(link).not.toHaveAttribute("type");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("lets a className override a variant class", () => {
    render(<Button className="h-12">Tall</Button>);
    const button = screen.getByRole("button", { name: "Tall" });
    expect(button.className).toContain("h-12");
    expect(button.className).not.toContain("h-10");
  });
});
