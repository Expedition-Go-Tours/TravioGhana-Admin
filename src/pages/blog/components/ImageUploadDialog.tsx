import { useState } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { uploadBlogImage } from "@/services/blogService";

interface ImageUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImageSelect: (url: string) => void;
  title?: string;
}

export function ImageUploadDialog({ open, onOpenChange, onImageSelect, title = "Upload Image" }: ImageUploadDialogProps) {
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  const validateAndSetFile = (f: File) => {
    if (!f.type.startsWith('image/')) {
      setError("Only image files are allowed");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError("File exceeds maximum size of 10MB");
      return;
    }
    setError("");
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) validateAndSetFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    try {
      const res = await uploadBlogImage(file, setProgress);
      onImageSelect(res.data.url);
      onOpenChange(false);
      reset();
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Upload failed";
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setProgress(0);
    setError("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!uploading) { onOpenChange(v); if (!v) reset(); } }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div
            className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
              dragOver ? "border-status-processing bg-surface-muted" : "border-border hover:border-text-secondary/40"
            } ${preview ? "py-4" : "py-8"}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            {preview ? (
              <div className="relative w-full">
                <img src={preview} alt="Preview" className="mx-auto max-h-48 rounded-lg object-contain" />
                <Button variant="ghost" size="sm" className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/50 p-0 text-white hover:bg-black/70" onClick={() => { setFile(null); setPreview(null); }}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="rounded-full bg-surface-muted p-3">
                  <Upload className="h-6 w-6 text-text-tertiary" />
                </div>
                <p className="text-sm text-text-secondary">
                  <span className="font-medium text-status-processing">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-text-tertiary">PNG, JPG, WebP up to 10MB</p>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              className="absolute inset-0 cursor-pointer opacity-0"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) validateAndSetFile(f);
              }}
            />
          </div>

          {error && <p className="text-xs text-status-rejected">{error}</p>}

          {uploading && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-text-secondary">
                <span>Uploading...</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                <div className="h-full rounded-full bg-status-processing transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { if (!uploading) { onOpenChange(false); reset(); } }} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!file || uploading} className="bg-status-processing hover:bg-status-processing/90">
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              "Upload"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}