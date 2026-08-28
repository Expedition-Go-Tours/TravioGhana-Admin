interface GoogleSnippetPreviewProps {
  title: string;
  description: string;
  slug: string;
}

export function GoogleSnippetPreview({ title, description, slug }: GoogleSnippetPreviewProps) {
  const displayTitle = title || "SEO Title";
  const displayDesc = description || "SEO description will appear here…";
  const url = `travioghana.com › blog › ${slug || "article-slug"}`;

  return (
    <div className="rounded-lg border border-border bg-surface-base p-4 space-y-1.5">
      <p className="text-xs text-[#006621] leading-tight truncate">{url}</p>
      <p className="text-sm font-medium text-[#1a0dab] leading-snug truncate hover:underline cursor-pointer">
        {displayTitle}
      </p>
      <p className="text-xs text-[#545454] leading-normal line-clamp-2">
        {displayDesc}
      </p>
    </div>
  );
}
