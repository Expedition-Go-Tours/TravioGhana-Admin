/**
 * The blog "new tag" / "new category" dialogs.
 *
 * Opening either one used to crash the whole admin with React error #301
 * ("too many re-renders"): the dialog compared its `tag` prop to a stored copy
 * during render, but the editor passes no tag at all, so `undefined !== null`
 * was true on every pass and React never settled. These tests open the dialogs
 * the way the editor does — no item prop — which is exactly the crashing path.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { TagDialog } from "../components/TagDialog";
import { CategoryDialog } from "../components/CategoryDialog";

describe("TagDialog", () => {
  it("opens a blank New Tag form when the editor passes no tag", () => {
    render(<TagDialog open onOpenChange={() => {}} onSave={async () => {}} />);

    expect(screen.getByText("New Tag")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("");
    expect(screen.getByLabelText("Slug")).toHaveValue("");
  });

  it("seeds an existing tag and starts clean the next time it opens", () => {
    const onSave = vi.fn();
    const { rerender } = render(
      <TagDialog
        open
        onOpenChange={() => {}}
        tag={{ id: "tag-1", name: "Africa", slug: "africa" } as never}
        onSave={onSave}
      />
    );

    const name = screen.getByLabelText("Name");
    expect(name).toHaveValue("Africa");

    fireEvent.change(name, { target: { value: "Afrika" } });
    expect(name).toHaveValue("Afrika");

    // Close, then open for a new tag: the abandoned draft must not leak in.
    rerender(
      <TagDialog open={false} onOpenChange={() => {}} tag={null} onSave={onSave} />
    );
    rerender(<TagDialog open onOpenChange={() => {}} onSave={onSave} />);

    expect(screen.getByLabelText("Name")).toHaveValue("");
  });

  it("derives the slug from the name for a new tag", () => {
    render(<TagDialog open onOpenChange={() => {}} onSave={async () => {}} />);

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Cape Coast" } });
    expect(screen.getByLabelText("Slug")).toHaveValue("cape-coast");
  });
});

describe("CategoryDialog", () => {
  it("opens a blank New Category form without a category", () => {
    render(
      <CategoryDialog
        open
        onOpenChange={() => {}}
        category={null}
        categories={[]}
        onSave={async () => {}}
      />
    );

    expect(screen.getByText("New Category")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("");
  });

  it("seeds an existing category's fields", () => {
    render(
      <CategoryDialog
        open
        onOpenChange={() => {}}
        category={{ id: "cat-1", name: "Destinations", slug: "destinations", description: "Places" } as never}
        categories={[]}
        onSave={async () => {}}
      />
    );

    expect(screen.getByLabelText("Name")).toHaveValue("Destinations");
    expect(screen.getByLabelText("Slug")).toHaveValue("destinations");
    expect(screen.getByLabelText("Description (optional)")).toHaveValue("Places");
  });
});
