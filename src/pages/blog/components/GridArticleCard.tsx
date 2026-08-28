import { useState } from "react"
import { MoreVertical, Edit, Trash2, ArrowUpDown, ArrowUpRight, BookOpen } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Article, ArticleStatus } from "@/types/blog"
import OptimizedImage from "@/components/shared/OptimizedImage"

interface GridArticleCardProps {
  article: Article
  onPreview: () => void
  onEdit: () => void
  onDelete: () => void
  onToggleStatus: () => void
}

const statusConfig: Record<ArticleStatus, { label: string; dot: string }> = {
  DRAFT: { label: "Draft", dot: "bg-status-pending" },
  PUBLISHED: { label: "Published", dot: "bg-status-active" },
  ARCHIVED: { label: "Archived", dot: "bg-text-tertiary" },
}

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days} days ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export function GridArticleCard({ article, onPreview, onEdit, onDelete, onToggleStatus }: GridArticleCardProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const status = statusConfig[article.status]
  const hasImage = !!article.featuredImage

  return (
    <div className="group relative rounded-sm bg-surface-base shadow-lg ring-1 ring-border/30 overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 cursor-pointer">
      <div className="relative h-60 overflow-hidden bg-surface-muted" onClick={onPreview}>
        {hasImage ? (
          <OptimizedImage
            src={article.featuredImage!}
            alt={article.title}
            width={800}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-xl bg-surface-muted p-3">
                <BookOpen className="h-6 w-6 text-text-tertiary" />
              </div>
              <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">No image</span>
            </div>
          </div>
        )}

        <div className="absolute top-3 right-3" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <button className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-base/90 backdrop-blur-sm shadow-sm ring-1 ring-border/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-surface-base">
                <MoreVertical className="h-4 w-4 text-text-secondary" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onToggleStatus}>
                <ArrowUpDown className="h-4 w-4" />
                {article.status === "PUBLISHED" ? "Unpublish" : "Publish"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-red-600 focus:text-red-600 focus:bg-red-50">
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="absolute top-3 left-3" onClick={(e) => e.stopPropagation()}>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium bg-surface-base/90 backdrop-blur-sm shadow-sm ring-1 ring-border/30`}>
            <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </span>
        </div>
      </div>

      <div className="p-6 pt-5" onClick={onPreview}>
        {article.category && (
          <span className="inline-block text-sm font-semibold text-primary mb-2">
            {article.category.name}
          </span>
        )}

        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="text-xl font-semibold text-text-primary leading-snug line-clamp-2 group-hover:text-primary transition-colors duration-200">
            {article.title}
          </h3>
          <ArrowUpRight className="h-5 w-5 min-w-5 text-text-tertiary mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        </div>

        {article.excerpt && (
          <p className="text-base text-text-secondary leading-relaxed line-clamp-2 mb-6">
            {article.excerpt}
          </p>
        )}

        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full overflow-hidden bg-surface-muted ring-2 ring-surface-base shrink-0">
            {article.author?.photoURL ? (
              <OptimizedImage src={article.author.photoURL} alt="" width={40} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-surface-muted to-surface-muted/60" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">
              {article.author?.name || "Anonymous"}
            </p>
            <p className="text-sm text-text-secondary">
              {article.publishedAt ? formatDate(article.publishedAt) : formatDate(article.createdAt)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
