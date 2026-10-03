import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataTable } from "@/components/shared/DataTable";
import type { Column } from "@/components/shared/DataTable";

/**
 * DataTable is a shared primitive with ~9 consumers but no tests at all, which
 * is how one unguarded `selection!` dereference managed to blank every table in
 * the app except the one page that happened to pass `selection`.
 *
 * The first suite is a regression guard against exactly that: rendering with no
 * `selection` prop and non-empty data must work.
 */

interface Row {
  id: string;
  name: string;
  amount: number;
}

const ROWS: Row[] = [
  { id: "r1", name: "Kakum Canopy Walk", amount: 486.5 },
  { id: "r2", name: "Ashanti Heritage Day Trip", amount: 129 },
  { id: "r3", name: "Mole Safari Expedition", amount: 2400 },
];

const columns: Column<Row>[] = [
  { key: "name", header: "Tour", rowHeader: true, render: (r) => r.name },
  { key: "amount", header: "Amount", numeric: true, render: (r) => r.amount.toFixed(2) },
];

const base = {
  columns,
  data: ROWS,
  keyExtractor: (r: Row) => r.id,
};

describe("DataTable without a selection prop", () => {
  it("renders rows instead of crashing on the undefined selection", () => {
    // Pre-fix this threw
    // "TypeError: Cannot read properties of undefined (reading 'selected')"
    // from `selection!.selected`, blanking the whole route behind the error
    // boundary. It only ever surfaced on pages that do NOT pass `selection`.
    expect(() => render(<DataTable {...base} />)).not.toThrow();
    expect(screen.getAllByRole("row")).toHaveLength(ROWS.length + 1);
  });

  it("does not mark every row selected when there is no selection", () => {
    render(<DataTable {...base} />);
    const rows = screen.getAllByRole("row").slice(1);
    for (const row of rows) expect(row).not.toHaveAttribute("aria-selected");
  });

  it("omits the checkbox column entirely", () => {
    render(<DataTable {...base} />);
    const table = screen.getByRole("table");
    expect(within(table).queryAllByRole("checkbox")).toHaveLength(0);
    // header and body agree on the column count
    const heads = within(table).getAllByRole("columnheader");
    const firstBodyRow = within(table).getAllByRole("row")[1];
    expect(firstBodyRow.children).toHaveLength(heads.length);
  });
});

describe("DataTable structure", () => {
  it("renders a real table with a caption and row headers", () => {
    render(<DataTable {...base} caption="Payout requests" />);
    const table = screen.getByRole("table");
    expect(table.tagName).toBe("TABLE");
    expect(within(table).getByText("Payout requests")).toBeInTheDocument();
    expect(table.querySelectorAll('th[scope="row"]')).toHaveLength(ROWS.length);
  });

  it("right-aligns and applies tabular numerals to numeric columns", () => {
    render(<DataTable {...base} />);
    const th = screen.getByRole("columnheader", { name: "Amount" });
    expect(th.className).toContain("text-right");
    const firstRow = screen.getAllByRole("row")[1];
    expect(firstRow.children[1].className).toContain("tabular-nums");
    expect(firstRow.children[1].className).toContain("text-right");
  });

  it("renders the loading skeleton as a table, not divs", () => {
    // A div-based skeleton reflows: column widths come from flex-1 on divs but
    // from the table algorithm once real cells land.
    render(<DataTable {...base} data={[]} loading />);
    const table = screen.getByRole("table");
    expect(table.tagName).toBe("TABLE");
    expect(table.querySelector("thead th")).not.toBeNull();
    expect(table.querySelector("tbody tr")).not.toBeNull();
    expect(table.querySelectorAll("tbody tr")).toHaveLength(6);
  });

  it("keeps a totals <tfoot> a direct child of the table", () => {
    render(
      <DataTable
        {...base}
        totals={<tr><td>Total</td><td>3015.50</td></tr>}
      />,
    );
    const table = screen.getByRole("table");
    const tfoot = table.querySelector("tfoot");
    expect(tfoot).not.toBeNull();
    // Invalid markup: a <tfoot> nested inside <tbody> makes the row/column
    // model ambiguous, so assistive tech stops treating it as a summary.
    expect(tfoot?.parentElement?.tagName).toBe("TABLE");
    expect(tfoot?.parentElement?.tagName).not.toBe("TBODY");
  });

  it("replaces the headers with an empty message when there is no data", () => {
    render(<DataTable {...base} data={[]} emptyMessage="Nothing here" />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows a retry affordance on error", async () => {
    const onRetry = vi.fn();
    render(<DataTable {...base} data={[]} error="Boom" onRetry={onRetry} />);
    expect(screen.getByText("Boom")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("DataTable row interaction", () => {
  it("makes the row keyboard focusable and toggles it with Enter", async () => {
    const onRowClick = vi.fn();
    render(<DataTable {...base} onRowClick={onRowClick} />);
    const row = screen.getAllByRole("row")[1];
    expect(row).toHaveAttribute("tabindex", "0");
    row.focus();
    await userEvent.keyboard("{Enter}");
    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick).toHaveBeenCalledWith(ROWS[0]);
  });

  it("does not fire the row click when a control inside the row is clicked", async () => {
    const onRowClick = vi.fn();
    const onClick = vi.fn();
    render(
      <DataTable
        {...base}
        onRowClick={onRowClick}
        columns={[
          columns[0],
          {
            key: "act",
            header: "Actions",
            render: () => (
              <button type="button" onClick={onClick}>
                Resolve
              </button>
            ),
          },
        ]}
      />,
    );
    // One Resolve button per row -- target the first, not all three.
    const buttons = screen.getAllByRole("button", { name: "Resolve" });
    expect(buttons).toHaveLength(ROWS.length);
    await userEvent.click(buttons[0]);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("does not swallow Space on a control inside the row", async () => {
    // The old handler ran preventDefault() on every Space/Enter that bubbled to
    // the row, so Space on a button inside it never activated the button and
    // expanded the row instead. This is the same path that broke keyboard
    // operation of the selection checkbox.
    const onRowClick = vi.fn();
    const onClick = vi.fn();
    render(
      <DataTable
        {...base}
        onRowClick={onRowClick}
        columns={[
          columns[0],
          {
            key: "act",
            header: "Actions",
            render: () => (
              <button type="button" onClick={onClick}>
                Resolve
              </button>
            ),
          },
        ]}
      />,
    );
    const button = screen.getAllByRole("button", { name: "Resolve" })[0];
    button.focus();
    await userEvent.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("fires the row click from cell content", async () => {
    const onRowClick = vi.fn();
    render(<DataTable {...base} onRowClick={onRowClick} />);
    await userEvent.click(screen.getByText("Kakum Canopy Walk"));
    expect(onRowClick).toHaveBeenCalledWith(ROWS[0]);
  });
});

describe("DataTable selection", () => {
  it("select-all toggles every selectable row", async () => {
    const onChange = vi.fn();
    const selected = new Set<string>();
    const { rerender } = render(
      <DataTable {...base} selection={{ selected, onChange: (n) => onChange(n) }} />,
    );
    const selectAll = screen.getByRole("checkbox", { name: /select all/i });
    await userEvent.click(selectAll);
    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls[0][0] as Set<string>;
    expect([...next].sort()).toEqual(["r1", "r2", "r3"]);
    expect(selectAll).not.toBeChecked();

    rerender(
      <DataTable {...base} selection={{ selected: new Set(["r1", "r2", "r3"]), onChange }} />,
    );
    expect(screen.getByRole("checkbox", { name: /select all/i })).toBeChecked();
  });

  it("respects isSelectable when deciding what select-all covers", async () => {
    const onChange = vi.fn();
    render(
      <DataTable
        {...base}
        selection={{ selected: new Set(), onChange, isSelectable: (r) => r.id !== "r3" }}
      />,
    );
    await userEvent.click(screen.getByRole("checkbox", { name: /select all/i }));
    const next = onChange.mock.calls[0][0] as Set<string>;
    expect([...next].sort()).toEqual(["r1", "r2"]);
    // The label falls back to the row key: these rows have no
    // `requestNumber`/`supplierName` for DataTable to prefer.
    expect(screen.getByRole("checkbox", { name: /: r1$/ })).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: /: r3$/ })).toBeDisabled();
  });

  it("marks indeterminate while some rows are selected", () => {
    render(<DataTable {...base} selection={{ selected: new Set(["r1"]), onChange: () => {} }} />);
    const selectAll = screen.getByRole("checkbox", { name: /select all/i }) as HTMLInputElement;
    expect(selectAll.indeterminate).toBe(true);
    expect(selectAll).not.toBeChecked();
  });
});

describe("DataTable responsive columns", () => {
  it("applies the hideBelow class so hidden columns leave the layout", () => {
    render(
      <DataTable
        {...base}
        columns={[
          columns[0],
          { key: "md", header: "Detail", hideBelow: "md", render: () => "x" },
          { key: "sm", header: "Wide", hideBelow: "sm", render: () => "y" },
        ]}
      />,
    );
    const table = screen.getByRole("table");
    const mdHead = within(table).getByRole("columnheader", { name: "Detail" });
    expect(mdHead.className).toContain("hidden md:table-cell");
    const smHead = within(table).getByRole("columnheader", { name: "Wide" });
    expect(smHead.className).toContain("hidden sm:table-cell");
  });
});
