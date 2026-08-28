import { useState, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, Search, ArrowUpDown, LayoutList, BarChart3, ChevronDown, FolderTree, Tags } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { getArticles, deleteArticle, updateArticle } from "@/services/blogService"
import type { Article, ArticleStatus } from "@/types/blog"
import { GridArticleCard } from "./components/GridArticleCard"

type SortOption = "newest" | "oldest" | "popular"

export default function BlogListPage() {
  const navigate = useNavigate()
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<SortOption>("newest")
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const limit = 20
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput)
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [searchInput])

  const queryClient = useQueryClient()

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ["articles-grid", search, statusFilter, sortBy],
    queryFn: ({ pageParam = 1 }) =>
      getArticles({
        search,
        status: statusFilter !== "all" ? (statusFilter as ArticleStatus) : undefined,
        sortBy,
        page: pageParam,
        limit,
      }),
    getNextPageParam: (lastPage) => {
      const pagination = lastPage?.pagination
      if (!pagination) return undefined
      return pagination.currentPage < pagination.totalPages ? pagination.currentPage + 1 : undefined
    },
    initialPageParam: 1,
  })

  const articles = data?.pages?.flatMap((page) => page?.data?.articles || []) || []
  const totalCount = data?.pages?.[0]?.pagination?.totalCount || 0

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteArticle(id),
    onSuccess: () => {
      toast.success("Article deleted")
      queryClient.invalidateQueries({ queryKey: ["articles-grid"] })
    },
  })

  const handleStatusToggle = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ArticleStatus }) =>
      updateArticle(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["articles-grid"] })
    },
  })

  return (
    <div className="space-y-0">
      <div className="bg-primary/5 relative overflow-hidden rounded-2xl mb-10">
        <div className="px-4 sm:px-8 pt-6 sm:pt-8 pb-12 sm:pb-16 relative z-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-8 mb-6 sm:mb-8">
            <div>
              <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary mb-4">
                Our blog
              </span>
              <h1 className="text-4xl md:text-5xl font-semibold text-text-primary tracking-tight leading-[1.2]">
                Resources and insights
              </h1>
              <p className="mt-2 text-lg md:text-xl text-primary max-w-2xl">
                Discover Africa's hidden gems, travel tips, and unforgettable experiences.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={() => navigate("/admin/blog/analytics")}
                className="rounded-full bg-surface-base/80 backdrop-blur-sm border-border-muted text-primary hover:bg-surface-base hover:border-border"
              >
                <BarChart3 className="mr-2 h-4 w-4" /> Analytics
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="rounded-full bg-surface-base/80 backdrop-blur-sm border-border-muted text-text-secondary hover:bg-surface-base hover:border-border"
                  >
                    Manage <ChevronDown className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[10rem]">
                  <DropdownMenuLabel>Blog structure</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => navigate("/admin/blog/categories")}>
                    <FolderTree className="h-4 w-4 text-primary" /> Categories
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/admin/blog/tags")}>
                    <Tags className="h-4 w-4 text-primary" /> Tags
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                onClick={() => navigate("/admin/blog/new")}
                className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
              >
                <Plus className="mr-2 h-4 w-4" /> New Article
              </Button>
            </div>
          </div>

          <div className="w-full sm:max-w-xs">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
              <Input
                placeholder="Search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-10 pr-4 rounded-lg bg-surface-base border-border-muted shadow-sm text-sm h-10"
              />
            </div>
          </div>
        </div>

        <svg
          className="absolute bottom-0 left-0 w-full h-24 text-surface-base"
          viewBox="0 0 1440 96"
          fill="none"
          preserveAspectRatio="none"
        >
          <path
            d="M0 64C160 96 320 32 480 48C640 64 800 80 960 48C1120 16 1280 32 1440 48V96H0V64Z"
            fill="white"
            opacity="0.6"
          />
          <path
            d="M0 80C160 96 320 64 480 72C640 80 800 88 960 72C1120 56 1280 64 1440 72V96H0V80Z"
            fill="white"
          />
        </svg>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-4 px-1">
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px] rounded-xl h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="PUBLISHED">Published</SelectItem>
              <SelectItem value="ARCHIVED">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v: SortOption) => setSortBy(v)}>
            <SelectTrigger className="w-[140px] rounded-xl h-9 text-sm">
              <ArrowUpDown className="mr-2 h-3.5 w-3.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
              <SelectItem value="popular">Most viewed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {totalCount > 0 && (
          <p className="text-sm text-text-secondary">
            {totalCount} article{totalCount !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl overflow-hidden">
              <Skeleton className="h-60 rounded-none" />
              <div className="p-6 space-y-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-4 w-full" />
                <div className="flex items-center gap-3 pt-2">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="rounded-full bg-primary/5 p-4 mb-4 ring-1 ring-primary/10">
            <LayoutList className="h-8 w-8 text-primary/60" />
          </div>
          <h3 className="text-lg font-medium text-text-primary">
            {search || statusFilter !== "all" ? "No articles found" : "No articles yet"}
          </h3>
          <p className="mt-1 text-sm text-text-secondary max-w-sm">
            {search || statusFilter !== "all"
              ? "Try adjusting your search or filter to find what you're looking for."
              : "Create your first article to start building your blog content."}
          </p>
          {!search && statusFilter === "all" && (
            <Button
              onClick={() => navigate("/admin/blog/new")}
              className="mt-4 bg-primary hover:bg-primary/90 rounded-full px-5"
            >
              <Plus className="mr-2 h-4 w-4" /> New Article
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {articles.map((article: Article) => (
            <GridArticleCard
              key={article.id}
              article={article}
              onPreview={() => navigate(`/admin/blog/preview/${article.id}`)}
              onEdit={() => navigate(`/admin/blog/${article.id}`)}
              onDelete={() => setDeleteConfirm(article.id)}
              onToggleStatus={() =>
                handleStatusToggle.mutate({
                  id: article.id,
                  status: article.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED",
                })
              }
            />
          ))}
        </div>
      )}

      {hasNextPage && articles.length > 0 && (
        <div className="flex justify-center pt-10 pb-6">
          <Button
            variant="outline"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="rounded-full px-8 py-2.5 h-auto bg-primary/5 border-primary/20 text-primary hover:bg-primary/10 hover:border-primary/30 font-medium"
          >
            {isFetchingNextPage ? (
              <div className="h-4 w-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin mr-2" />
            ) : (
              <ChevronDown className="mr-2 h-4 w-4" />
            )}
            Load more
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm) deleteMutation.mutate(deleteConfirm)
          setDeleteConfirm(null)
        }}
        title="Delete article"
        description="Are you sure you want to delete this article? This action cannot be undone."
        confirmLabel="Delete"
        confirmVariant="destructive"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
