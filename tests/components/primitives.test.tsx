import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Chip } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { SelectField, TextField } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { dismissToast, toast, Toaster } from "@/components/ui/toast";

describe("TextField", () => {
  it("ties its label, hint and error to the input", () => {
    const { rerender } = render(<TextField label="Email" hint="We never share it." />);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAccessibleDescription("We never share it.");
    expect(input).not.toHaveAttribute("aria-invalid");

    rerender(<TextField label="Email" hint="We never share it." error="Enter a valid email address." />);
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription("Enter a valid email address.");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email address.");
  });

  it("keeps a hidden label readable", () => {
    render(<TextField label="Search instruments" labelHidden />);
    expect(screen.getByLabelText("Search instruments")).toBeInTheDocument();
  });
});

describe("SelectField", () => {
  it("is a native select with a label", () => {
    render(
      <SelectField label="Benchmark" defaultValue="b">
        <option value="a">A</option>
        <option value="b">B</option>
      </SelectField>,
    );
    expect(screen.getByRole("combobox", { name: "Benchmark" })).toHaveValue("b");
  });
});

describe("Segmented", () => {
  it("is one named radio group and reports the choice", () => {
    const onChange = vi.fn();
    render(
      <Segmented
        legend="Density"
        options={[
          { value: "comfortable", label: "Comfortable" },
          { value: "compact", label: "Compact" },
        ]}
        value="comfortable"
        onChange={onChange}
      />,
    );
    expect(screen.getByRole("group", { name: "Density" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Comfortable" })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: "Compact" }));
    expect(onChange).toHaveBeenCalledWith("compact");
  });

  it("gives two groups on one page separate names, so choosing in one does not clear the other", () => {
    const options = [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ];
    render(
      <>
        <Segmented legend="First" options={options} value="a" onChange={() => {}} />
        <Segmented legend="Second" options={options} value="b" onChange={() => {}} />
      </>,
    );
    const names = screen.getAllByRole("radio").map((radio) => radio.getAttribute("name"));
    expect(new Set(names).size).toBe(2);
  });
});

describe("Switch", () => {
  it("is labelled, described and toggles", () => {
    const onCheckedChange = vi.fn();
    render(<Switch label="Daily digest" description="One email each morning." checked={false} onCheckedChange={onCheckedChange} />);
    const control = screen.getByRole("switch", { name: "Daily digest" });
    expect(control).toHaveAccessibleDescription("One email each morning.");
    expect(control).toHaveAttribute("aria-checked", "false");
    fireEvent.click(control);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });
});

describe("Chip", () => {
  it("is a toggle button that reports whether it is on", () => {
    const onSelect = vi.fn();
    const { rerender } = render(<Chip onSelect={onSelect}>Energy</Chip>);
    const chip = screen.getByRole("button", { name: "Energy" });
    expect(chip).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(chip);
    expect(onSelect).toHaveBeenCalledOnce();
    rerender(
      <Chip selected onSelect={onSelect}>
        Energy
      </Chip>,
    );
    expect(screen.getByRole("button", { name: "Energy" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("Dialog", () => {
  it("is named, described and closes on Escape", () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange} title="Rename watchlist" description="Shown everywhere it is listed.">
        <p>Body</p>
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog", { name: "Rename watchlist" });
    expect(dialog).toHaveAccessibleDescription("Shown everywhere it is listed.");
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders nothing while closed", () => {
    render(<Dialog open={false} onOpenChange={() => {}} title="Hidden" />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("has a close button a screen reader can name", () => {
    render(<Dialog open onOpenChange={() => {}} title="Details" />);
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });
});

describe("ConfirmDialog", () => {
  it("labels the confirming button with what it does and calls back only on confirm", () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Delete this watchlist?"
        description="This cannot be undone."
        confirmLabel="Delete watchlist"
        onConfirm={onConfirm}
        destructive
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete watchlist" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("cannot be confirmed twice while it is working", () => {
    render(
      <ConfirmDialog open onOpenChange={() => {}} title="t" description="d" confirmLabel="Delete" onConfirm={() => {}} busy />,
    );
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });
});

describe("toast", () => {
  afterEach(() => vi.useRealTimers());

  it("announces through a live region that exists before the first message", () => {
    render(<Toaster />);
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toBeEmptyDOMElement();
    act(() => void toast.success("Watchlist saved."));
    expect(within(region).getByText("Watchlist saved.")).toBeInTheDocument();
  });

  it("clears a success by itself but keeps an error until it is dismissed", () => {
    vi.useFakeTimers();
    render(<Toaster />);
    let errorId = 0;
    act(() => {
      toast.success("Saved.");
      errorId = toast.error("That did not save.");
    });
    act(() => void vi.advanceTimersByTime(10_000));
    expect(screen.queryByText("Saved.")).toBeNull();
    expect(screen.getByText("That did not save.")).toBeInTheDocument();
    act(() => dismissToast(errorId));
    expect(screen.queryByText("That did not save.")).toBeNull();
  });

  it("marks an error in words, not only with colour", () => {
    render(<Toaster />);
    let id = 0;
    act(() => {
      id = toast.error("No connection.");
    });
    expect(screen.getByText("Error:")).toHaveClass("sr-only");
    act(() => dismissToast(id));
  });
});

describe("DataTable", () => {
  type Row = { id: string; name: string; price: string };
  const rows: Row[] = [
    { id: "1", name: "Aravalli Industries", price: "₹2,456.50" },
    { id: "2", name: "Deccan Coastal Bank", price: "₹874.15" },
  ];
  const columns = [
    { key: "name", header: "Instrument", cell: (row: Row) => row.name },
    { key: "price", header: "Price", numeric: true, cell: (row: Row) => row.price },
    { key: "id", header: "Id", cell: (row: Row) => row.id, hideOnPhone: true },
  ];

  it("renders a real table with a caption, column headers and row headers", () => {
    render(<DataTable caption="Sample instruments" columns={columns} rows={rows} rowKey={(row) => row.id} />);
    const table = screen.getByRole("table", { name: "Sample instruments" });
    expect(within(table).getAllByRole("columnheader")).toHaveLength(3);
    expect(within(table).getByRole("rowheader", { name: "Aravalli Industries" })).toBeInTheDocument();
    expect(within(table).getByText("₹874.15").closest("td")).toHaveAttribute("data-numeric");
  });

  it("also renders labelled cards for a phone, without the columns marked to hide", () => {
    const { container } = render(<DataTable caption="Sample instruments" columns={columns} rows={rows} rowKey={(row) => row.id} />);
    const cards = container.querySelector('[data-layout="cards"]') as HTMLElement;
    expect(within(cards).getAllByRole("listitem")).toHaveLength(2);
    expect(within(cards).getAllByText("Price")).toHaveLength(2);
    expect(within(cards).queryByText("Id")).toBeNull();
  });

  it("renders nothing without columns rather than an empty frame", () => {
    const { container } = render(<DataTable caption="x" columns={[]} rows={rows} rowKey={(row) => row.id} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("returning focus when an overlay closes", () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Rename
        </button>
        <Dialog open={open} onOpenChange={setOpen} title="Rename watchlist" />
      </>
    );
  }

  it("puts focus back on the control that opened a dialog opened from state", async () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Rename" });
    opener.focus();
    fireEvent.click(opener);
    const dialog = await screen.findByRole("dialog", { name: "Rename watchlist" });
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    fireEvent.keyDown(dialog, { key: "Escape" });
    // Without this, focus falls to <body> and a keyboard user starts again from the top.
    await waitFor(() => expect(opener).toHaveFocus());
  });
});
