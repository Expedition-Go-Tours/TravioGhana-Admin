export interface Article {
  id: string
  title: string
  slug: string
  excerpt: string
  body: unknown
  featuredImage: string | null
  images: string[] | null
  metaTitle: string | null
  metaDescription: string | null
  canonicalUrl: string | null
  publishedAt: string | null
  status: ArticleStatus
  readTime: number | null
  locale: string
  viewCount: number
  shareCount: number
  author: {
    id: string
    name: string
    photoURL: string | null
  }
  category: ArticleCategory
  tags: { id: string; name: string; slug: string }[]
  relatedTours: {
    id: string
    title: string
    slug: string
    coverPhoto: string | null
    category: string | null
    city: string | null
    country: string | null
    startingPrice: number | null
    currency: string
    averageRating: number | null
    reviewCount: number
  }[]
  jsonLd?: object
  alternateLocales?: { locale: string; slug: string }[]
  createdAt: string
  updatedAt: string
}

export type ArticleStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

export interface ArticleCategory {
  id: string
  name: string
  slug: string
  description: string | null
  parentId: string | null
  articleCount?: number
  children?: ArticleCategory[]
}

export interface ArticleTag {
  id: string
  name: string
  slug: string
  articleCount?: number
  _count?: { articles?: number }
}

export interface ArticleListDTO {
  id: string
  title: string
  slug: string
  excerpt: string
  featuredImage: string | null
  category: { id: string; name: string; slug: string } | null
  tags: { id: string; name: string; slug: string }[]
  author: { id: string; name: string; photoURL: string | null } | null
  publishedAt: string | null
  readTime: number | null
  locale: string
  status: ArticleStatus
  viewCount: number
}

export interface Pagination {
  currentPage: number
  totalPages: number
  totalCount: number
  limit: number
}

export interface PaginatedResponse<T> {
  status: string
  data: T
  pagination: Pagination
}
