import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate, useBlocker } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Image, Calendar, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getArticleById, createArticle, updateArticle, getCategories, getTags, createCategory, createTag } from "@/services/blogService";
import api from "@/lib/axios";
import { RichTextEditor } from "./components/RichTextEditor";
import { ImageUploadDialog } from "./components/ImageUploadDialog";
import { SlugField } from "./components/SlugField";
import { TagSelector } from "./components/TagSelector";
import { TourSelector } from "./components/TourSelector";
import { GoogleSnippetPreview } from "./components/GoogleSnippetPreview";
import { ExitConfirmDialog } from "./components/ExitConfirmDialog";
import { EditorHeader } from "./components/EditorHeader";
import { CategoryDialog } from "./components/CategoryDialog";
import { TagDialog } from "./components/TagDialog";
import type { ArticleStatus } from "@/types/blog";
import OptimizedImage from "@/components/shared/OptimizedImage";

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="border-t border-border pt-4 mt-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{label}</p>
    </div>
  );
}

export default function BlogEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new";
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState<Record<string, unknown> | null>(null);
  const [categoryId, setCategoryId] = useState<string>("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [relatedTourIds, setRelatedTourIds] = useState<string[]>([]);
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [featuredImage, setFeaturedImage] = useState("");
  const [publishDate, setPublishDate] = useState("");
  const [slugError, setSlugError] = useState("");
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [articleStatus, setArticleStatus] = useState<string>("DRAFT");
  const [navigatingAfterSave, setNavigatingAfterSave] = useState(false);
  const [original, setOriginal] = useState<Record<string, unknown>>({});
  const [lastLoadedArticleId, setLastLoadedArticleId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/admin/me");
        setCurrentUserId(res.data?.data?.id);
      } catch {
        // silently fail
      }
    })();
  }, []);

  const queryClient = useQueryClient();

  const hasUnsavedChanges = useMemo(() => {
    if (navigatingAfterSave) return false;
    if (isNew) return !!title || !!slug || !!excerpt || !!content;
    return (
      title !== (original.title as string) ||
      slug !== (original.slug as string) ||
      excerpt !== (original.excerpt as string) ||
      JSON.stringify(content) !== JSON.stringify(original.body) ||
      categoryId !== (original.categoryId as string) ||
      JSON.stringify(tagIds) !== JSON.stringify(original.tagIds) ||
      JSON.stringify(relatedTourIds) !== JSON.stringify(original.relatedTourIds) ||
      metaTitle !== (original.metaTitle as string) ||
      metaDescription !== (original.metaDescription as string) ||
      featuredImage !== (original.featuredImage as string) ||
      publishDate !== (original.publishDate as string)
    );
  }, [navigatingAfterSave, isNew, title, slug, excerpt, content, categoryId, tagIds, relatedTourIds, metaTitle, metaDescription, featuredImage, publishDate, original]);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasUnsavedChanges && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  const { data: articleData, isLoading: articleLoading, isError: articleError } = useQuery({
    queryKey: ["article", id],
    queryFn: () => getArticleById(id!),
    enabled: !isNew,
  });

  const { data: categoriesData, isError: categoriesError } = useQuery({
    queryKey: ["categories"],
    queryFn: () => getCategories(),
  });

  const { data: tagsData, isError: tagsError } = useQuery({
    queryKey: ["tags"],
    queryFn: () => getTags(),
  });

  const { data: toursData, isError: toursError } = useQuery({
    queryKey: ["tours-for-blog"],
    queryFn: () => api.get("/tours?limit=500").then((r) => r.data?.data?.tours || r.data?.data || []),
  });

  const article = articleData?.data?.article;
  const categories = categoriesData?.data?.categories || [];
  const tags = tagsData?.data?.tags || [];
  const tours = Array.isArray(toursData) ? toursData : toursData?.tours || [];

  const createCategoryMutation = useMutation({
    mutationFn: (data: { name: string; slug: string; description?: string; parentId?: string }) => createCategory(data),
    onSuccess: (res) => {
      const created = res?.data?.data?.category as { id?: string } | undefined;
      if (created?.id) setCategoryId(created.id);
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Category created");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to create category";
      toast.error(msg);
    },
  });

  const createTagMutation = useMutation({
    mutationFn: (data: { name: string; slug: string }) => createTag(data),
    onSuccess: (res) => {
      const created = res?.data?.data?.tag as { id?: string } | undefined;
      if (created?.id) setTagIds((prev) => (prev.includes(created.id as string) ? prev : [...prev, created.id as string]));
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      toast.success("Tag created");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to create tag";
      toast.error(msg);
    },
  });

  if (article && article.id !== lastLoadedArticleId) {
    setLastLoadedArticleId(article.id);
    setTitle(article.title);
    setSlug(article.slug);
    setExcerpt(article.excerpt || "");
    setContent(article.body);
    setCategoryId(article.category?.id || "");
    setTagIds(article.tags?.map((t: Record<string, unknown>) => t.id as string) || []);
    setRelatedTourIds(article.relatedTours?.map((rt: Record<string, unknown>) => rt.id as string) || []);
    setMetaTitle(article.metaTitle || "");
    setMetaDescription(article.metaDescription || "");
    setFeaturedImage(article.featuredImage || "");
    setPublishDate(article.publishedAt ? article.publishedAt.slice(0, 10) : "");
    setArticleStatus(article.status || "DRAFT");
    setOriginal({
      title: article.title,
      slug: article.slug,
      excerpt: article.excerpt || "",
      body: article.body,
      categoryId: article.category?.id || "",
      tagIds: article.tags?.map((t: Record<string, unknown>) => t.id) || [],
      relatedTourIds: article.relatedTours?.map((rt: Record<string, unknown>) => rt.id) || [],
      metaTitle: article.metaTitle || "",
      metaDescription: article.metaDescription || "",
      featuredImage: article.featuredImage || "",
      publishDate: article.publishedAt ? article.publishedAt.slice(0, 10) : "",
    });
  }

  const wordCount = useMemo(() => {
    if (!content) return 0;
    const text = JSON.stringify(content);
    const stripped = text.replace(/<[^>]*>/g, "").replace(/[{}[\]"]/g, " ");
    return stripped.split(/\s+/).filter(Boolean).length;
  }, [content]);

  const readTime = Math.max(1, Math.round(wordCount / 200));

  const handleTitleChange = useCallback((value: string) => {
    setTitle(value);
    if (isNew) {
      const generated = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      setSlug(generated);
    }
  }, [isNew]);

  const handleSlugChange = useCallback((value: string) => {
    setSlug(value);
    setSlugError("");
  }, []);

  const saveMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      isNew ? createArticle(data) : updateArticle(id!, data),
    onSuccess: () => {
      toast.success(isNew ? "Article created" : "Article updated");
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      if (!isNew) queryClient.invalidateQueries({ queryKey: ["article", id] });
      setNavigatingAfterSave(true);
      navigate("/admin/blog");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to save article";
      toast.error(msg);
    },
  });

  const handleSave = useCallback(async (status: ArticleStatus) => {
    if (status === "PUBLISHED" && !title.trim()) {
      toast.error("Title is required to publish");
      return;
    }
    if (status === "PUBLISHED" && !slug.trim()) {
      toast.error("Slug is required to publish");
      return;
    }
    if (status === "PUBLISHED" && !content) {
      toast.error("Content is required to publish");
      return;
    }
    const payload: Record<string, unknown> = {
      title: title.trim(),
      slug: slug.trim(),
      excerpt: excerpt.trim() || undefined,
      body: content,
      authorId: currentUserId,
      categoryId: categoryId || undefined,
      tagIds: tagIds.length > 0 ? tagIds : undefined,
      relatedTourIds: relatedTourIds.length > 0 ? relatedTourIds : undefined,
      metaTitle: metaTitle.trim() || undefined,
      metaDescription: metaDescription.trim() || undefined,
      featuredImage: featuredImage || undefined,
      status,
    };
    if (publishDate && status === "PUBLISHED") {
      payload.publishedAt = new Date(publishDate).toISOString();
    }
    saveMutation.mutate(payload);
  }, [title, slug, excerpt, content, categoryId, tagIds, relatedTourIds, metaTitle, metaDescription, featuredImage, publishDate, saveMutation, currentUserId]);

  const saveAsDraftAndPreview = useCallback(async () => {
    const payload: Record<string, unknown> = {
      title: title.trim() || "Untitled",
      slug: slug.trim() || "untitled",
      excerpt: excerpt.trim() || undefined,
      body: content,
      authorId: currentUserId,
      categoryId: categoryId || undefined,
      tagIds: tagIds.length > 0 ? tagIds : undefined,
      relatedTourIds: relatedTourIds.length > 0 ? relatedTourIds : undefined,
      metaTitle: metaTitle.trim() || undefined,
      metaDescription: metaDescription.trim() || undefined,
      featuredImage: featuredImage || undefined,
      status: "DRAFT",
    };

    try {
      const res = isNew
        ? await createArticle(payload)
        : await updateArticle(id!, payload);
      const savedId = res?.data?.article?.id || id;
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      if (savedId) {
        setNavigatingAfterSave(true);
        navigate(`/admin/blog/preview/${savedId}`);
      }
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to save draft for preview";
      toast.error(msg);
    }
  }, [isNew, id, title, slug, excerpt, content, categoryId, tagIds, relatedTourIds, metaTitle, metaDescription, featuredImage, currentUserId, navigate, queryClient]);

  const canPreview = !isNew || (!!title && !!slug);

  const handleFeaturedImageSelect = (url: string) => {
    setFeaturedImage(url);
    setImageDialogOpen(false);
  };

  const loading = articleLoading && !isNew;
  const showError = articleError && !isNew;

  return (
    <div className="h-screen flex flex-col bg-background">
      <EditorHeader
        isNew={isNew}
        isPending={saveMutation.isPending}
        onBack={() => navigate("/admin/blog")}
        onSaveDraft={() => handleSave("DRAFT")}
        onPublish={() => handleSave("PUBLISHED")}
        onPreview={saveAsDraftAndPreview}
        canPreview={canPreview}
      />

      {showError ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <div className="rounded-sm border border-destructive/30 bg-destructive/5 p-6 max-w-md">
            <h2 className="text-base font-semibold text-foreground mb-1">Failed to load article</h2>
            <p className="text-sm text-muted-foreground mb-4">The article may have been removed or there was a network error.</p>
            <Button variant="outline" size="sm" onClick={() => navigate("/admin/blog")}>Back to articles</Button>
          </div>
        </div>
      ) : loading ? (
        <div className="flex-1 flex overflow-hidden">
          <aside className="w-[35%] min-w-[320px] max-w-[420px] border-r border-border p-5 space-y-5 overflow-y-auto">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </aside>
          <main className="flex-1 p-5">
            <Skeleton className="h-full w-full rounded-sm" />
          </main>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          <aside className="w-[35%] min-w-[320px] max-w-[420px] border-r border-border p-5 space-y-5 overflow-y-auto scrollbar-thin">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Title</Label>
              <Input
                placeholder="Article title..."
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                className="text-base font-semibold"
              />
              <p className="text-xs text-muted-foreground">{title.length} characters</p>
            </div>

            <SlugField value={slug} onChange={handleSlugChange} error={slugError} />

            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Excerpt</Label>
              <Textarea
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder="Brief summary of the article..."
                rows={3}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">{excerpt.length}/200 characters</p>
            </div>

            <SectionDivider label="Publishing" />

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Status</Label>
                <Select value={articleStatus} onValueChange={setArticleStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="PUBLISHED">Published</SelectItem>
                    <SelectItem value="ARCHIVED">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-muted-foreground">Category</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-xs text-primary hover:text-primary/80"
                    onClick={() => setCategoryDialogOpen(true)}
                  >
                    <Plus className="h-3 w-3 mr-0.5" /> New
                  </Button>
                </div>
                <Select value={categoryId || "none"} onValueChange={(v) => setCategoryId(v === "none" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={categoriesError ? "Failed to load" : categories.length === 0 ? "No categories yet" : "No category"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No category</SelectItem>
                    {categories?.map((c: Record<string, unknown>) => (
                      <SelectItem key={c.id as string} value={c.id as string}>{c.name as string}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {categoriesError && <p className="text-xs text-destructive">Could not load categories</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Publish date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={publishDate}
                    onChange={(e) => setPublishDate(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            <SectionDivider label="Tags" />
            <div className="flex items-center justify-end -mt-2 mb-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-xs text-primary hover:text-primary/80"
                onClick={() => setTagDialogOpen(true)}
              >
                <Plus className="h-3 w-3 mr-0.5" /> New Tag
              </Button>
            </div>
            {tagsError ? (
              <p className="text-xs text-destructive">Could not load tags</p>
            ) : (
              <TagSelector tags={tags} selectedIds={tagIds} onChange={setTagIds} />
            )}

            <SectionDivider label="Related Tours" />
            {toursError ? (
              <p className="text-xs text-destructive">Could not load tours</p>
            ) : (
              <TourSelector tours={tours} selectedIds={relatedTourIds} onChange={setRelatedTourIds} />
            )}

            <SectionDivider label="Featured Image" />
            <div className="space-y-3">
              {featuredImage ? (
                <div className="relative rounded-sm overflow-hidden border border-border aspect-[3/1]">
                  <OptimizedImage src={featuredImage} alt="Featured" width={800} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-muted-foreground/30 py-6 text-center">
                  <Image className="h-5 w-5 text-muted-foreground/50 mb-1" />
                  <p className="text-xs text-muted-foreground">No image selected</p>
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setImageDialogOpen(true)}>
                  <Image className="mr-1.5 h-3.5 w-3.5" />
                  {featuredImage ? "Change" : "Add Image"}
                </Button>
                {featuredImage && (
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setFeaturedImage("")}>
                    Remove
                  </Button>
                )}
              </div>
            </div>

            <SectionDivider label="SEO" />
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Meta title</Label>
                <Input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} placeholder="SEO title" />
                <p className={`text-xs ${metaTitle.length > 60 ? "text-destructive" : "text-muted-foreground"}`}>
                  {metaTitle.length}/60
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Meta description</Label>
                <Textarea value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} placeholder="SEO description" rows={2} className="resize-none" />
                <p className={`text-xs ${metaDescription.length > 160 ? "text-destructive" : "text-muted-foreground"}`}>
                  {metaDescription.length}/160
                </p>
              </div>
              <GoogleSnippetPreview
                title={metaTitle || title}
                description={metaDescription || excerpt}
                slug={slug}
              />
            </div>

            <SectionDivider label="Stats" />
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{wordCount.toLocaleString()} <span className="text-xs">words</span></span>
              <span className="text-border">|</span>
              <span>{readTime} <span className="text-xs">min read</span></span>
              <span className="text-border">|</span>
              <span className={content ? "text-foreground font-medium" : ""}>{content ? "Ready" : "Empty"}</span>
            </div>
          </aside>

          <main className="flex-1 flex flex-col overflow-hidden p-5 pt-5">
            <RichTextEditor value={content} onChange={setContent} expand />
          </main>
        </div>
      )}

      <ImageUploadDialog
        open={imageDialogOpen}
        onOpenChange={setImageDialogOpen}
        onImageSelect={handleFeaturedImageSelect}
        title="Featured Image"
      />

      <CategoryDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        category={null}
        categories={categories}
        onSave={async (data) => {
          await createCategoryMutation.mutateAsync(data);
        }}
      />

      <TagDialog
        open={tagDialogOpen}
        onOpenChange={setTagDialogOpen}
        onSave={async (data) => {
          await createTagMutation.mutateAsync(data);
        }}
      />

      <ExitConfirmDialog
        open={blocker.state === "blocked"}
        onStay={() => blocker.reset?.()}
        onLeave={() => blocker.proceed?.()}
      />
    </div>
  );
}
