import { transformImage, getSrcSet } from '@/lib/image'

interface OptimizedImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string | null | undefined
  width?: number
  height?: number
  alt?: string
  loading?: 'lazy' | 'eager'
  className?: string
  style?: React.CSSProperties
  fit?: 'crop' | 'fill' | 'scale'
}

function buildBreakpoints(width: number): number[] {
  return [width, Math.round(width * 1.5), width * 2, Math.round(width * 3)]
}

export default function OptimizedImage({
  src,
  width,
  height,
  alt = '',
  loading = 'lazy',
  className = '',
  style,
  fit = 'crop',
  onLoad,
  onError,
  ...imgProps
}: OptimizedImageProps) {
  if (!src || (!src.includes('cloudinary') && !src.includes('googleusercontent'))) {
    return <img src={src ?? undefined} alt={alt} loading={loading} className={className} style={style} onLoad={onLoad} onError={onError} {...imgProps} />
  }

  if (src.includes('googleusercontent')) {
    return <img src={src} alt={alt} loading={loading} className={className} style={style} onLoad={onLoad} onError={onError} {...imgProps} />
  }

  const transformOpts = {
    width: width ? width * 2 : undefined,
    height: height ? height * 2 : undefined,
    quality: 'auto:good' as const,
    format: 'auto' as const,
    fit,
  }

  const srcSetWidths = width ? buildBreakpoints(width) : undefined

  const transformed = transformImage(src, transformOpts)
  const srcSet = srcSetWidths ? getSrcSet(src, srcSetWidths, transformOpts) : undefined

  return (
    <img
      src={transformed ?? undefined}
      srcSet={srcSet}
      alt={alt}
      loading={loading}
      className={className}
      style={style}
      onLoad={onLoad}
      onError={onError}
      {...imgProps}
    />
  )
}
