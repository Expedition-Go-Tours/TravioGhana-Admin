import { describe, expect, it } from "vitest";
import { percentFromStored, percentToStored } from "@/pages/settings/settings-utils";

describe("commission percent conversion", () => {
  it("shows stored fractions as whole percentages", () => {
    expect(percentFromStored("0.15")).toBe("15");
    expect(percentFromStored("0.2")).toBe("20");
    expect(percentFromStored("1")).toBe("100");
    expect(percentFromStored("0.005")).toBe("0.5");
  });

  it("tolerates legacy percentage values already stored above 1", () => {
    expect(percentFromStored("15")).toBe("15");
  });

  it("sends fractions the backend can persist without ambiguity", () => {
    expect(percentToStored("15")).toBe("0.15");
    expect(percentToStored("0.5")).toBe("0.005");
    expect(percentToStored("100")).toBe("1");
  });

  it("returns an empty value for unparseable input", () => {
    expect(percentFromStored("")).toBe("");
    expect(percentFromStored("abc")).toBe("");
    expect(percentToStored("")).toBe("");
  });
});
