import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/test-utils";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/services/blogService", () => ({
  getArticles: vi.fn(),
  deleteArticle: vi.fn(),
  updateArticle: vi.fn(),
}));

import { getArticles } from "@/services/blogService";
import BlogListPage from "../BlogListPage";

const mockArticles = [
  {
    id: "1",
    title: "Test Article",
    slug: "test-article",
    excerpt: "An excerpt",
    body: null,
    featuredImage: null,
    images: null,
    metaTitle: null,
    metaDescription: null,
    canonicalUrl: null,
    publishedAt: new Date("2026-07-01").toISOString(),
    status: "PUBLISHED",
    readTime: 5,
    locale: "en",
    viewCount: 42,
    shareCount: 0,
    author: { id: "a1", name: "Admin", photoURL: null },
    category: { id: "c1", name: "Destinations", slug: "destinations", description: null, parentId: null },
    tags: [],
    relatedTours: [],
    createdAt: new Date("2026-07-01").toISOString(),
    updatedAt: new Date("2026-07-01").toISOString(),
  },
  {
    id: "2",
    title: "Draft Article",
    slug: "draft-article",
    excerpt: null,
    body: null,
    featuredImage: null,
    images: null,
    metaTitle: null,
    metaDescription: null,
    canonicalUrl: null,
    publishedAt: null,
    status: "DRAFT",
    readTime: 3,
    locale: "en",
    viewCount: 0,
    shareCount: 0,
    author: { id: "a1", name: "Admin", photoURL: null },
    category: null,
    tags: [],
    relatedTours: [],
    createdAt: new Date("2026-07-02").toISOString(),
    updatedAt: new Date("2026-07-02").toISOString(),
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BlogListPage", () => {
  it("renders loading state initially", async () => {
    vi.mocked(getArticles).mockResolvedValueOnce({ data: { articles: [] }, pagination: { totalCount: 0, totalPages: 1 } });
    renderWithProviders(<BlogListPage />);
    expect(screen.getByText("Resources and insights")).toBeInTheDocument();
    expect(screen.getByText("Discover Africa's hidden gems, travel tips, and unforgettable experiences.")).toBeInTheDocument();
    expect(screen.getByText("New Article")).toBeInTheDocument();
  });

  it("renders article list after loading", async () => {
    vi.mocked(getArticles).mockResolvedValueOnce({
      data: { articles: mockArticles },
      pagination: { totalCount: 2, totalPages: 1, currentPage: 1, limit: 20 },
    });
    renderWithProviders(<BlogListPage />);
    await waitFor(() => {
      expect(screen.getByText("Test Article")).toBeInTheDocument();
    });
    expect(screen.getByText("Draft Article")).toBeInTheDocument();
    expect(screen.getByText("2 articles")).toBeInTheDocument();
  });

  it("renders empty state when no articles", async () => {
    vi.mocked(getArticles).mockResolvedValueOnce({
      data: { articles: [] },
      pagination: { totalCount: 0, totalPages: 1, currentPage: 1, limit: 20 },
    });
    renderWithProviders(<BlogListPage />);
    await waitFor(() => {
      expect(screen.getByText("No articles yet")).toBeInTheDocument();
    });
  });

  it("navigates to new article on button click", async () => {
    vi.mocked(getArticles).mockResolvedValueOnce({
      data: { articles: mockArticles },
      pagination: { totalCount: 2, totalPages: 1, currentPage: 1, limit: 20 },
    });
    renderWithProviders(<BlogListPage />);
    await waitFor(() => {
      expect(screen.getByText("Test Article")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText("New Article"));
    expect(mockNavigate).toHaveBeenCalledWith("/admin/blog/new");
  });

  it("calls getArticles with search query after debounce", async () => {
    vi.mocked(getArticles).mockResolvedValue({
      data: { articles: [] },
      pagination: { totalCount: 0, totalPages: 1, currentPage: 1, limit: 20 },
    });
    renderWithProviders(<BlogListPage />);
    const searchInput = screen.getByPlaceholderText("Search");
    await userEvent.type(searchInput, "safari");
    await waitFor(() => {
      expect(getArticles).toHaveBeenCalledWith(
        expect.objectContaining({ search: "safari" }),
      );
    });
  });
});
