import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithDataRouter } from "@/test/test-utils";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/services/blogService", () => ({
  getArticleById: vi.fn(),
  createArticle: vi.fn(),
  updateArticle: vi.fn(),
  getCategories: vi.fn(),
  getTags: vi.fn(),
}));

vi.mock("@/lib/axios", () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { data: { id: "author-1" } } }),
  },
}));

import { getArticleById, getCategories, getTags } from "@/services/blogService";
import BlogEditorPage from "../BlogEditorPage";

const mockCategories = [
  { id: "cat-1", name: "Destinations", slug: "destinations" },
  { id: "cat-2", name: "Travel Tips", slug: "travel-tips" },
];

const mockTags = [
  { id: "tag-1", name: "Africa", slug: "africa" },
  { id: "tag-2", name: "Adventure", slug: "adventure" },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCategories).mockResolvedValue({ data: { categories: mockCategories } });
  vi.mocked(getTags).mockResolvedValue({ data: { tags: mockTags } });
  vi.mocked(getArticleById).mockResolvedValue({ data: { article: null } });
});

describe("BlogEditorPage (new article)", () => {
  it("renders the editor form", async () => {
    renderWithDataRouter(<BlogEditorPage />, {
      path: "/admin/blog/:id",
      initialEntries: ["/admin/blog/new"],
    });
    await waitFor(() => {
      expect(screen.getByText("New Article")).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText("Article title...")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("article-slug")).toBeInTheDocument();
    expect(screen.getByText("Save Draft")).toBeInTheDocument();
    expect(screen.getByText("Publish")).toBeInTheDocument();
  });

  it("generates slug from title for new articles", async () => {
    renderWithDataRouter(<BlogEditorPage />, {
      path: "/admin/blog/:id",
      initialEntries: ["/admin/blog/new"],
    });
    const titleInput = screen.getByPlaceholderText("Article title...");
    await userEvent.type(titleInput, "My New Article");
    await waitFor(() => {
      const slugInput = screen.getByPlaceholderText("article-slug") as HTMLInputElement;
      expect(slugInput.value).toBe("my-new-article");
    }, { timeout: 10000 });
  });

  it("loads categories and tags on mount", async () => {
    renderWithDataRouter(<BlogEditorPage />, {
      path: "/admin/blog/:id",
      initialEntries: ["/admin/blog/new"],
    });
    await waitFor(() => {
      expect(getCategories).toHaveBeenCalled();
      expect(getTags).toHaveBeenCalled();
    });
  });

  it("shows tags as clickable badges", async () => {
    renderWithDataRouter(<BlogEditorPage />, {
      path: "/admin/blog/:id",
      initialEntries: ["/admin/blog/new"],
    });
    await waitFor(() => {
      expect(screen.getByText("Africa")).toBeInTheDocument();
    });
    expect(screen.getByText("Adventure")).toBeInTheDocument();
  });

  it("disables publish when title is empty", async () => {
    renderWithDataRouter(<BlogEditorPage />, {
      path: "/admin/blog/:id",
      initialEntries: ["/admin/blog/new"],
    });
    await waitFor(() => {
      expect(screen.getByText("Publish")).toBeInTheDocument();
    });
    const publishBtn = screen.getByText("Publish");
    await userEvent.click(publishBtn);
    expect(await screen.findByText("Title is required to publish")).toBeInTheDocument();
  });
});
