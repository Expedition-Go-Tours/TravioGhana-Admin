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
import type { ArticleTag } from "@/types/blog";

interface TagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag?: ArticleTag | null;
  onSave: (data: { id?: string; name: string; slug: string }) => Promise<void>;
}

export function TagDialog({ open, onOpenChange, tag = null, onSave }: TagDialogProps) {
  const [name, setName] = useState(tag?.name || "");
  const [slug, setSlug] = useState(tag?.slug || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Seed the fields when the dialog OPENS — that is the only moment that
  // matters. The previous version compared `tag` to a stored copy and reset
  // state during render; "New tag" passes no tag (undefined) while the stored
  // copy starts as null, `undefined !== null` stayed true on every render, and
  // React aborted with "too many re-renders" (#301). `wasOpen` flips exactly
  // once per open, so this settles after a single extra render.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName(tag?.name || "");
      setSlug(tag?.slug || "");
      setError("");
    }
  }

  const handleNameChange = (value: string) => {
    setName(value);
    if (!tag) {
      setSlug(value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
    }
  };

  const handleSave = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    if (!slug.trim()) { setError("Slug is required"); return; }
    setSaving(true);
    setError("");
    try {
      await onSave({ id: tag?.id, name: name.trim(), slug: slug.trim() });
      onOpenChange(false);
    } catch (e) {
      const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to save tag";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{tag ? "Edit Tag" : "New Tag"}</DialogTitle>
          <DialogDescription>{tag ? "Update article tag." : "Create a new article tag."}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {error && (
            <div className="rounded-md bg-status-rejected/10 p-3 text-sm text-status-rejected-text">{error}</div>
          )}
          <div className="space-y-2">
            <Label htmlFor="tag-name">Name</Label>
            <Input id="tag-name" value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="e.g. Paris" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tag-slug">Slug</Label>
            <Input id="tag-slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="paris" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-status-processing hover:bg-status-processing/90">
            {saving ? "Saving..." : tag ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}