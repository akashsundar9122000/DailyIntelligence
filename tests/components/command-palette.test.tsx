import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { CommandPalette } from "@/components/shell/command-palette";

beforeEach(() => push.mockClear());

function open(onOpenChange = vi.fn()) {
  render(<CommandPalette open onOpenChange={onOpenChange} />);
  return { input: screen.getByRole("combobox", { name: "Search pages" }), onOpenChange };
}

describe("CommandPalette", () => {
  it("is a named dialog holding a combobox that controls a listbox", () => {
    const { input } = open();
    expect(screen.getByRole("dialog", { name: "Search and go to" })).toBeInTheDocument();
    const list = screen.getByRole("listbox", { name: "Pages" });
    expect(input).toHaveAttribute("aria-controls", list.id);
    expect(screen.getAllByRole("option")).toHaveLength(11);
  });

  it("highlights the first result and names it to assistive technology", () => {
    const { input } = open();
    const first = screen.getAllByRole("option")[0]!;
    expect(first).toHaveAttribute("aria-selected", "true");
    expect(input).toHaveAttribute("aria-activedescendant", first.id);
  });

  it("filters as the reader types", () => {
    const { input } = open();
    fireEvent.change(input, { target: { value: "brief" } });
    const labels = screen.getAllByRole("option").map((option) => option.textContent);
    expect(labels[0]).toContain("Briefings");
    expect(labels.every((label) => /brief/i.test(label ?? ""))).toBe(true);
  });

  it("moves with the arrow keys, wraps at both ends, and keeps focus in the input", () => {
    const { input } = open();
    const options = () => screen.getAllByRole("option");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(options()[1]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(options()[10]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(options()[0]).toHaveAttribute("aria-selected", "true");
  });

  it("goes to the highlighted page on Enter and closes", () => {
    const { input, onOpenChange } = open();
    fireEvent.change(input, { target: { value: "hot now" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(push).toHaveBeenCalledWith("/app/hot");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("goes to a page when it is clicked", () => {
    open();
    fireEvent.click(screen.getByRole("option", { name: /Saved/ }));
    expect(push).toHaveBeenCalledWith("/app/saved");
  });

  it("says plainly when nothing matches, and does not invent a story", () => {
    const { input } = open();
    fireEvent.change(input, { target: { value: "cyclone" } });
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByRole("status")).toHaveTextContent(/No page matches “cyclone”.*use Explore/);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(push).not.toHaveBeenCalled();
  });
});
