import { useRef, useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import ImageExtension from "@tiptap/extension-image";
import LinkExtension from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Quote,
  Minus,
  Undo2,
  Redo2,
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  Link,
  Unlink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ImageUploadDialog } from "./ImageUploadDialog";

interface RichTextEditorProps {
  value: Record<string, unknown> | null;
  onChange: (value: Record<string, unknown> | null) => void;
  placeholder?: string;
  disabled?: boolean;
  expand?: boolean;
}

function ToolbarButton({
  onClick,
  active,
  icon: Icon,
  label,
}: {
  onClick: () => void;
  active?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors ${
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function ToolbarDivider() {
  return <div className="mx-1 h-5 w-px bg-border" />;
}

export function RichTextEditor({ value, onChange, placeholder, disabled, expand }: RichTextEditorProps) {
  const initialRender = useRef(true);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      ImageExtension.configure({ inline: true }),
      LinkExtension.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: placeholder || "Start writing..." }),
    ],
    content: value || "",
    onUpdate: ({ editor }) => {
      const json = editor.getJSON();
      onChange(json);
    },
    editable: !disabled,
    immediatelyRender: false,
  });

  useEffect(() => {
    if (editor && value && initialRender.current) {
      const currentJSON = editor.getJSON();
      if (JSON.stringify(currentJSON) !== JSON.stringify(value)) {
        editor.commands.setContent(value);
      }
      initialRender.current = false;
    }
  }, [value, editor]);

  useEffect(() => {
    return () => { editor?.destroy(); };
  }, [editor]);

  if (!editor) return null;

  const openLinkDialog = () => {
    setLinkUrl(editor.getAttributes('link').href || "");
    setLinkDialogOpen(true);
  };

  const applyLink = () => {
    if (linkUrl) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
    } else {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    }
    setLinkDialogOpen(false);
  };

  const handleImageSelect = (url: string) => {
    editor.chain().focus().setImage({ src: url }).run();
    setImageDialogOpen(false);
  };

  const containerClass = expand
    ? "flex flex-col h-full rounded-sm border border-border"
    : "flex flex-col rounded-xl border border-border bg-card shadow-soft";
  const contentAreaClass = expand
    ? "flex-1 overflow-y-auto p-6"
    : "p-4 sm:p-6";
  const editorClass = expand
    ? "prose prose-sm max-w-none focus:outline-none h-full"
    : "prose prose-sm max-w-none focus:outline-none min-h-[400px]";

  return (
    <div className={containerClass}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-3 py-2 shrink-0">
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} icon={Bold} label="Bold" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} icon={Italic} label="Italic" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} icon={UnderlineIcon} label="Underline" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} icon={Strikethrough} label="Strikethrough" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} icon={Code} label="Code" />

        <ToolbarDivider />

        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} icon={Heading1} label="Heading 1" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} icon={Heading2} label="Heading 2" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} icon={Heading3} label="Heading 3" />

        <ToolbarDivider />

        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} icon={List} label="Bullet list" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} icon={ListOrdered} label="Ordered list" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} icon={Quote} label="Blockquote" />
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} icon={Minus} label="Horizontal rule" />

        <ToolbarDivider />

        <ToolbarButton onClick={openLinkDialog} active={editor.isActive('link')} icon={Link} label="Add link" />
        {editor.isActive('link') && (
          <ToolbarButton onClick={() => editor.chain().focus().unsetLink().run()} icon={Unlink} label="Remove link" />
        )}
        <ToolbarButton onClick={() => setImageDialogOpen(true)} icon={ImageIcon} label="Add image" />

        <ToolbarDivider />

        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} icon={Undo2} label="Undo" />
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} icon={Redo2} label="Redo" />
      </div>

      <div className={contentAreaClass}>
        <EditorContent
          editor={editor}
          className={editorClass}
        />
      </div>

      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Add Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="link-url">URL</Label>
              <Input id="link-url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." autoFocus />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>Cancel</Button>
            <Button onClick={applyLink} className="bg-primary hover:bg-primary/90">{linkUrl ? "Apply" : "Remove"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImageUploadDialog
        open={imageDialogOpen}
        onOpenChange={setImageDialogOpen}
        onImageSelect={handleImageSelect}
        title="Add Image"
      />
    </div>
  );
}
