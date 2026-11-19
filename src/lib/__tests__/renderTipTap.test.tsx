import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { renderTipTap } from "../renderTipTap";

describe("renderTipTap", () => {
  it("applies text alignment saved by the editor", () => {
    const { container } = render(
      <>
        {renderTipTap({
          type: "doc",
          content: [
            {
              type: "heading",
              attrs: { level: 1, textAlign: "center" },
              content: [{ type: "text", text: "Centred headline" }],
            },
            {
              type: "paragraph",
              attrs: { textAlign: "right" },
              content: [{ type: "text", text: "Signed off" }],
            },
          ],
        })}
      </>,
    );

    expect(container.querySelector("h1")).toHaveStyle({ textAlign: "center" });
    expect(container.querySelector("p")).toHaveStyle({ textAlign: "right" });
  });
});
