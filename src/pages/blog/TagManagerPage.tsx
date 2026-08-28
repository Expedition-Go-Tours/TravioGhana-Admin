import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { getTags, createTag, updateTag, deleteTag } from "@/services/blogService";
import type { ArticleTag } from "@/types/blog";
import { TagDialog } from "./components/TagDialog";

export default function TagManagerPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<ArticleTag | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: tagsData, isLoading } = useQuery({
    queryKey: ["tags"],
    queryFn: () => getTags(),
  });

  const tags = tagsData?.data?.tags || [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTag(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tags"] }),
  });

  const saveMutation = useMutation({
    mutationFn: (data: { id?: string; name: string; slug: string }) =>
      data.id
        ? updateTag(data.id, { name: data.name, slug: data.slug })
        : createTag(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tags"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Tags</h1>
          <p className="mt-1 text-sm text-text-secondary">Manage article tags</p>
        </div>
        <Button onClick={() => { setEditingTag(null); setDialogOpen(true); }} className="bg-status-processing hover:bg-status-processing/90">
          <Plus className="mr-2 h-4 w-4" /> New Tag
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-8 w-20 rounded-full bg-surface-muted animate-pulse" />
          ))}
        </div>
      ) : tags?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="rounded-full bg-surface-muted p-4 mb-4">
            <Tags className="h-8 w-8 text-text-tertiary" />
          </div>
          <h3 className="text-lg font-medium text-text-primary">No tags yet</h3>
          <p className="mt-1 text-sm text-text-secondary">Create your first tag to label articles.</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tags?.map((tag: ArticleTag) => (
            <div key={tag.id} className="group inline-flex items-center gap-2 rounded-full border bg-surface-base px-3 py-1.5 text-sm hover:border-text-secondary/40 transition-colors">
              <span>{tag.name}</span>
              <span className="text-xs text-text-tertiary">({tag._count?.articles || 0})</span>
              <button
                className="ml-1 text-text-tertiary hover:text-status-processing transition-colors"
                onClick={() => { setEditingTag(tag); setDialogOpen(true); }}
              >
                <Edit className="h-3.5 w-3.5" />
              </button>
              <button
                className="text-text-tertiary hover:text-status-rejected transition-colors"
                onClick={() => setDeleteConfirm(tag.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <TagDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tag={editingTag}
        onSave={async (data) => {
          await saveMutation.mutateAsync(data);
        }}
      />

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={() => setDeleteConfirm(null)}
        onConfirm={() => { if (deleteConfirm) deleteMutation.mutate(deleteConfirm); setDeleteConfirm(null); }}
        title="Delete tag"
        description="Are you sure you want to delete this tag? It will be removed from all associated articles."
        confirmLabel="Delete"
        confirmVariant="destructive"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}