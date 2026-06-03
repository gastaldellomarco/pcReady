import type { ImgHTMLAttributes } from "react";

/**
 *
 */
export type OptimizedImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  /** Above-the-fold / LCP candidates: eager load, no lazy deferral. */
  priority?: boolean;
};

/** img wrapper with lazy-loading and decoding defaults for non-critical images. */
export function OptimizedImage({
  priority = false,
  loading,
  decoding,
  fetchPriority,
  ...props
}: OptimizedImageProps) {
  return (
    <img
      loading={loading ?? (priority ? "eager" : "lazy")}
      decoding={decoding ?? (priority ? "sync" : "async")}
      fetchPriority={fetchPriority ?? (priority ? "high" : undefined)}
      {...props}
    />
  );
}
