import { useParams, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { ChevronLeft, Edit3 } from "lucide-react"
import { getArticleById } from "@/services/blogService"
import { renderTipTap, type TipTapNode } from "@/lib/renderTipTap"
import type { Article } from "@/types/blog"
import OptimizedImage from "@/components/shared/OptimizedImage";

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return ""
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

const statusConfig = {
  DRAFT: { label: "Draft", dot: "bg-status-pending" },
  PUBLISHED: { label: "Published", dot: "bg-status-active" },
  ARCHIVED: { label: "Archived", dot: "bg-text-tertiary" },
} as const

export default function BlogPreviewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ["article-preview", id],
    queryFn: () => getArticleById(id!),
    enabled: !!id,
  })

  const article = data?.data?.article as Article | undefined

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-border border-t-foreground animate-spin" />
      </div>
    )
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-center px-4">
        <h2 className="text-xl font-semibold text-text-primary">Article not found</h2>
        <p className="mt-2 text-sm text-text-secondary">
          This article may have been removed or the link is invalid.
        </p>
        <button
          onClick={() => navigate("/admin/blog")}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to articles
        </button>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <AdminBar article={article} navigate={navigate} />

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[768px] px-6 pt-6 pb-16 bg-surface-base border border-border">
          {article.category && (
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                {article.category.name}
              </span>
            </div>
          )}

          <h1 className="text-4xl md:text-[48px] font-bold leading-[1.1] text-text-primary tracking-tight text-balance mb-8">
            {article.title}
          </h1>

          {article.featuredImage && (
            <div className="w-full aspect-[3/1] overflow-hidden bg-surface-muted mb-8">
              <OptimizedImage
                src={article.featuredImage}
                alt={article.title}
                className="w-full h-full object-cover"
                width={800}
              />
            </div>
          )}

          <div className="flex items-center gap-3 pb-6 border-b border-border mb-8">
            {article.author?.photoURL ? (
              <OptimizedImage
                src={article.author.photoURL}
                alt=""
                className="h-10 w-10 rounded-full object-cover shrink-0"
                width={40}
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-surface-muted shrink-0" />
            )}
            <div className="text-sm text-text-primary">
              <span className="font-semibold">{article.author?.name || "Anonymous"}</span>
              <span className="text-text-secondary mx-1.5">•</span>
              <span className="text-text-secondary">
                {article.publishedAt ? formatDate(article.publishedAt) : "Not published"}
              </span>
            </div>
          </div>

          {article.excerpt && (
            <p className="text-base leading-[1.8] text-text-primary mb-8">
              {article.excerpt}
            </p>
          )}

          <div
            className="text-base leading-[1.8] text-text-primary space-y-6
            [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:text-text-primary [&_h1]:tracking-tight [&_h1]:mt-12 [&_h1]:mb-4
            [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-text-primary [&_h2]:tracking-tight [&_h2]:mt-10 [&_h2]:mb-3
            [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-text-primary [&_h3]:mt-8 [&_h3]:mb-2
            [&_p]:leading-[1.8] [&_p]:mb-5
            [&_blockquote]:border-t [&_blockquote]:border-b [&_blockquote]:border-border [&_blockquote]:py-6 [&_blockquote]:my-10 [&_blockquote]:px-0 [&_blockquote]:italic [&_blockquote]:text-text-secondary [&_blockquote]:w-full
            [&_img]:max-w-full [&_img]:h-auto [&_img]:my-8 [&_img]:mx-auto [&_img]:rounded-sm
            [&_pre]:bg-foreground [&_pre]:p-5 [&_pre]:text-sm [&_pre]:leading-relaxed [&_pre]:my-8 [&_pre]:overflow-x-auto
            [&_code]:bg-surface-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-sm [&_code]:font-mono [&_code]:text-primary
            [&_pre_code]:bg-transparent [&_pre_code]:text-background
            [&_ul]:space-y-2 [&_ul]:pl-5 [&_ol]:space-y-2 [&_ol]:pl-5
            [&_hr]:border-border [&_hr]:my-10
            [&_a]:underline [&_a]:underline-offset-4 [&_a]:decoration-border [&_a:hover]:decoration-primary [&_a]:transition-all [&_a]:duration-300"
          >
            {renderTipTap(article.body as TipTapNode | null)}
          </div>
        </div>
      </main>
    </div>
  )
}

function AdminBar({
  article,
  navigate,
}: {
  article: Article
  navigate: ReturnType<typeof useNavigate>
}) {
  const status = statusConfig[article.status] ?? statusConfig.DRAFT
  return (
    <div className="bg-surface-base border-b border-border shrink-0">
      <div className="mx-auto max-w-[1400px] px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/admin/blog")}
            className="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold text-text-secondary hover:text-text-primary hover:bg-surface-muted transition-all"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <span className="h-4 w-px bg-border" />
          <button
            onClick={() => navigate(`/admin/blog/${article.id}`)}
            className="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold text-text-secondary hover:text-text-primary hover:bg-surface-muted transition-all"
          >
            <Edit3 className="h-3.5 w-3.5" />
            Edit
          </button>
        </div>
        <span className="flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold bg-surface-muted text-text-secondary">
          <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
          {status.label}
        </span>
      </div>
    </div>
  )
}
