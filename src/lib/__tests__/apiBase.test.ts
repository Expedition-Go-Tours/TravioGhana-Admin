import { describe, expect, it } from "vitest";
import { resolveApiBase } from "@/lib/apiBase";

const GHANA_API = "https://api.travioghana.com/api";

describe("resolveApiBase", () => {
  it("keeps the Ghana API base", () => {
    expect(resolveApiBase(GHANA_API, "admin.travioghana.com")).toBe(GHANA_API);
  });

  it("replaces the shared Africa API host with the Ghana API", () => {
    expect(resolveApiBase("https://apiv1.travioafrica.com/api", "admin.travioghana.com")).toBe(
      GHANA_API,
    );
  });

  it("replaces the Africa API host even on a preview deployment", () => {
    expect(
      resolveApiBase("https://apiv1.travioafrica.com/api", "travio-ghana-admin-git-x.vercel.app"),
    ).toBe(GHANA_API);
  });

  it("uses the Ghana API when no base is configured on a Ghana host", () => {
    expect(resolveApiBase("", "admin.travioghana.com")).toBe(GHANA_API);
  });

  it("keeps the Vite proxy on localhost", () => {
    expect(resolveApiBase("", "localhost")).toBe("/api");
  });

  it("honours an explicit local backend", () => {
    expect(resolveApiBase("http://localhost:5001/api/", "localhost")).toBe(
      "http://localhost:5001/api",
    );
  });
});
