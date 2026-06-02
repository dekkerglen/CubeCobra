import React, { RefObject, useEffect, useState } from 'react';

export interface ImageFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  fallbackSrc: string;
  innerRef?: RefObject<HTMLImageElement>;
  [key: string]: any;
  className?: string;
}

// Renders the fallback image immediately and preloads the real `src` in the
// background. The visible <img> element only points at `src` once the browser
// has actually fetched and decoded it, so card grids (search results, deck
// piles, etc.) show the loading placeholder card up front instead of blank
// slots that fill in one at a time.
const ImageFallback: React.FC<ImageFallbackProps> = ({ src, fallbackSrc, innerRef, className, ...props }) => {
  const [resolvedSrc, setResolvedSrc] = useState<string>(fallbackSrc);

  useEffect(() => {
    setResolvedSrc(fallbackSrc);
    if (!src) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setResolvedSrc(src);
    };
    img.onerror = () => {
      if (!cancelled) setResolvedSrc(fallbackSrc);
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src, fallbackSrc]);

  return <img className={`card-border ${className}`} src={resolvedSrc} ref={innerRef} {...props} />;
};

export default ImageFallback;
