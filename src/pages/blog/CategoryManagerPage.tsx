import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, ChevronRight, ChevronDown, FolderTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { getCategories, createCategory, updateCategory, deleteCategory } from "@/services/blogService";
import type { ArticleCategory } from "@/types/blog";
import { CategoryDialog } from "./components/CategoryDialog";

export default function CategoryManagerPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ArticleCategory | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: categoriesData, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: () => getCategories(),
  });

  const categories: ArticleCategory[] = categoriesData?.data?.categories || [];

  const saveMutation = useMutation({
    mutationFn: (data: { name: string; slug: string; description?: string; parentId?: string }) =>
      editingCategory
        ? updateCategory(editingCategory.id, data)
        : createCategory(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categories"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categories"] }),
  });

  const rootCategories = categories?.filter((c) => !c.parentId) || [];
  const childCategories = (parentId: string) => categories?.filter((c) => c.parentId === parentId) || [];

  const renderCategory = (cat: ArticleCategory, depth = 0) => (
    <div key={cat.id}>
      <div
        className="flex items-center justify-between px-4 py-3 hover:bg-surface-muted/50 rounded-lg group"
        style={{ paddingLeft: `${16 + depth * 24}px` }}
      >
        <div className="flex items-center gap-2">
          {childCategories(cat.id).length > 0 && (
            <button onClick={() => setExpanded((prev) => { const next = new Set(prev); if (next.has(cat.id)) next.delete(cat.id); else next.add(cat.id); return next; })}>
              {expanded.has(cat.id) ? <ChevronDown className="h-4 w-4 text-text-tertiary" /> : <ChevronRight className="h-4 w-4 text-text-tertiary" />}
            </button>
          )}
          <span className="text-sm font-medium text-text-primary">{cat.name}</span>
          <span className="text-xs text-text-tertiary ml-2">({cat.articleCount || 0})</span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingCategory(cat); setDialogOpen(true); }}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-status-rejected" onClick={() => setDeleteConfirm(cat.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {expanded.has(cat.id) && childCategories(cat.id).map((child) => renderCategory(child, depth + 1))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Categories</h1>
          <p className="mt-1 text-sm text-text-secondary">Organize your articles into categories</p>
        </div>
        <Button onClick={() => { setEditingCategory(null); setDialogOpen(true); }} className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" /> New Category
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-surface-muted animate-pulse" />
          ))}
        </div>
      ) : rootCategories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="rounded-full bg-surface-muted p-4 mb-4">
            <FolderTree className="h-8 w-8 text-text-tertiary" />
          </div>
          <h3 className="text-lg font-medium text-text-primary">No categories yet</h3>
          <p className="mt-1 text-sm text-text-secondary">Create your first category to organize articles.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface-base divide-y divide-border">
          {rootCategories.map((cat) => renderCategory(cat))}
        </div>
      )}

      <CategoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        category={editingCategory}
        categories={categories || []}
        onSave={async (data) => {
          await saveMutation.mutateAsync(data);
        }}
      />

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={() => setDeleteConfirm(null)}
        onConfirm={() => { if (deleteConfirm) deleteMutation.mutate(deleteConfirm); setDeleteConfirm(null); }}
        title="Delete category"
        description="Are you sure you want to delete this category? Articles in this category will become uncategorized."
        confirmLabel="Delete"
        confirmVariant="destructive"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
