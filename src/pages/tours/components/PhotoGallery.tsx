import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ImagePlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import OptimizedImage from "@/components/shared/OptimizedImage";

interface PhotoGalleryProps {
  photos: string[];
  maxVisible?: number;
}

export function PhotoGallery({ photos, maxVisible = 6 }: PhotoGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  if (!photos || photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-surface-muted/30 py-10 text-center">
        <ImagePlus className="mb-2 h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No photos uploaded</p>
      </div>
    );
  }

  const visible = photos.slice(0, maxVisible);
  const overflow = photos.length - maxVisible;

  const openLightbox = (index: number) => {
    setActiveIndex(index);
    setLightboxOpen(true);
  };

  const goTo = (dir: 'prev' | 'next') => {
    setActiveIndex((prev) =>
      dir === 'prev'
        ? (prev - 1 + photos.length) % photos.length
        : (prev + 1) % photos.length
    );
  };

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {visible.map((photo, i) => (
          <button
            key={photo}
            onClick={() => openLightbox(i)}
            className="group relative aspect-[16/10] overflow-hidden rounded-lg border border-border/40 transition-all duration-200 hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-secondary/30"
          >
            <OptimizedImage
              src={photo}
              alt={`Tour photo ${i + 1}`}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              width={600}
            />
            {i === maxVisible - 1 && overflow > 0 && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
                <span className="text-lg font-bold text-white">+{overflow}</span>
              </div>
            )}
          </button>
        ))}
      </div>

      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-4xl border-0 bg-black/95 p-0 backdrop-blur-sm [&>button]:text-white/70 [&>button]:hover:text-white">
          <div className="relative flex items-center justify-center">
            <OptimizedImage
              src={photos[activeIndex]}
              alt={`Tour photo ${activeIndex + 1}`}
              className="max-h-[80vh] rounded-lg object-contain"
              width={1600}
              fit="fill"
            />

            {photos.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 text-white hover:bg-black/60"
                  onClick={() => goTo('prev')}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 text-white hover:bg-black/60"
                  onClick={() => goTo('next')}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </>
            )}

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
              {activeIndex + 1} / {photos.length}
            </div>
          </div>

          {photos.length > 1 && (
            <div className="flex justify-center gap-1.5 px-4 pb-4">
              {photos.map((photo, i) => (
                <button
                  key={photo}
                  onClick={() => setActiveIndex(i)}
                  className={cn(
                    'h-1.5 w-1.5 rounded-full transition-all duration-200',
                    i === activeIndex
                      ? 'w-4 bg-white'
                      : 'bg-white/30 hover:bg-white/50'
                  )}
                />
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
