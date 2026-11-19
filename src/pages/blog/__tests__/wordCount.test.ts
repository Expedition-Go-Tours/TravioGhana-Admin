import { describe, expect, it } from "vitest";
import { countWords } from "../wordCount";

describe("countWords", () => {
  it("counts prose, not the JSON structure", () => {
    expect(
      countWords({
        type: "doc",
        content: [
          { type: "heading", attrs: { level: 1, textAlign: "center" }, content: [{ type: "text", text: "Hello" }] },
          { type: "paragraph", content: [{ type: "text", text: "world again" }] },
        ],
      }),
    ).toBe(3);
  });

  it("returns zero for an empty document and for no content", () => {
    expect(countWords(null)).toBe(0);
    expect(countWords({ type: "doc", content: [] })).toBe(0);
  });

  it("accepts a legacy plain-string body", () => {
    expect(countWords("one two three")).toBe(3);
  });
});
