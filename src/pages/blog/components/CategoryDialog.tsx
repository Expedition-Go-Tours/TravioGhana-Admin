import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ArticleCategory } from "@/types/blog";

interface CategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: ArticleCategory | null;
  categories: ArticleCategory[];
  onSave: (data: { name: string; slug: string; description?: string; parentId?: string }) => Promise<void>;
}

export function CategoryDialog({ open, onOpenChange, category, categories, onSave }: CategoryDialogProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [prevCategory, setPrevCategory] = useState<ArticleCategory | null>(category);

  if (open && category !== prevCategory) {
    setPrevCategory(category);
    setName(category?.name || "");
    setSlug(category?.slug || "");
    setDescription(category?.description || "");
    setParentId(category?.parentId || "");
    setError("");
  }

  const handleNameChange = (value: string) => {
    setName(value);
    if (!category) setSlug(value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
  };

  const handleSave = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    if (!slug.trim()) { setError("Slug is required"); return; }
    setSaving(true);
    setError("");
    try {
      await onSave({ name: name.trim(), slug: slug.trim(), description: description.trim() || undefined, parentId: parentId || undefined });
      onOpenChange(false);
    } catch (e) {
      const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to save category";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{category ? "Edit Category" : "New Category"}</DialogTitle>
          <DialogDescription>
            {category ? "Update the category details below." : "Create a new article category."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
          )}
          <div className="space-y-2">
            <Label htmlFor="cat-name">Name</Label>
            <Input id="cat-name" value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="e.g. Destinations" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cat-slug">Slug</Label>
            <Input id="cat-slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="destinations" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cat-desc">Description (optional)</Label>
            <Input id="cat-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Category description" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cat-parent">Parent category (optional)</Label>
            <select
              id="cat-parent"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:border-text-secondary/50 focus-visible:ring-2 focus-visible:ring-text-secondary/20"
            >
              <option value="">None (top-level)</option>
              {categories
                .filter((c) => c.id !== category?.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-status-processing hover:bg-status-processing/90">
            {saving ? "Saving..." : category ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
