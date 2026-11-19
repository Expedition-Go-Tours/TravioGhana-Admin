import { afterEach, describe, expect, it } from "vitest";
import { getDefaultRoute } from "@/lib/permissions";
import { searchScopes } from "@/components/layout/searchScopes";

function storeRole(role: { name: string; permissions: string[] } | null) {
  if (!role) {
    localStorage.removeItem("adminRole");
    return;
  }
  localStorage.setItem("adminRole", JSON.stringify(role));
}

afterEach(() => {
  localStorage.clear();
});

describe("getDefaultRoute", () => {
  it("lands a blog-only role on the blog, not the overview it cannot read", () => {
    storeRole({ name: "content_editor", permissions: ["blog.manage"] });

    expect(getDefaultRoute()).toBe("/admin/blog");
  });

  it("keeps the dashboard as the landing page when the role has it", () => {
    storeRole({ name: "operations_admin", permissions: ["dashboard.*", "bookings.view"] });

    expect(getDefaultRoute()).toBe("/admin/overview");
  });

  it("treats a super admin as having every landing page", () => {
    storeRole({ name: "super_admin", permissions: [] });

    expect(getDefaultRoute()).toBe("/admin/overview");
  });
});

describe("searchScopes", () => {
  it("only advertises the scopes the viewer can open", () => {
    expect(searchScopes(true, true)).toBe("pages, tours and suppliers");
    expect(searchScopes(true, false)).toBe("pages and tours");
    expect(searchScopes(false, true)).toBe("pages and suppliers");
    expect(searchScopes(false, false)).toBe("pages");
  });
});
