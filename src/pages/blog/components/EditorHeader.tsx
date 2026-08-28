import { ArrowLeft, Save, Send, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EditorHeaderProps {
  isNew: boolean;
  isPending: boolean;
  onBack: () => void;
  onSaveDraft: () => void;
  onPublish: () => void;
  onPreview?: () => void;
  canPreview?: boolean;
}

export function EditorHeader({
  isNew,
  isPending,
  onBack,
  onSaveDraft,
  onPublish,
  onPreview,
  canPreview,
}: EditorHeaderProps) {
  return (
    <header className="shrink-0 h-14 border-b border-border bg-background flex items-center justify-between px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="h-4 w-px bg-border" />
        <h1 className="text-sm font-semibold text-foreground">
          {isNew ? "New Article" : "Edit Article"}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        {onPreview && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onPreview}
            disabled={!canPreview}
            className="text-muted-foreground hover:text-foreground"
          >
            <Eye className="mr-1.5 h-4 w-4" />
            Preview
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onSaveDraft}
          disabled={isPending}
        >
          <Save className="mr-1.5 h-4 w-4" />
          {isPending ? "Saving..." : "Save Draft"}
        </Button>
        <Button
          size="sm"
          onClick={onPublish}
          disabled={isPending}
        >
          <Send className="mr-1.5 h-4 w-4" />
          {isPending ? "Publishing..." : "Publish"}
        </Button>
      </div>
    </header>
  );
}
