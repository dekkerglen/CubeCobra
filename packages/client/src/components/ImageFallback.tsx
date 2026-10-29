import React, { RefObject, useEffect, useState } from 'react';

import { isAlphaPrinting } from '@utils/cardutil';
import Card, { CardDetails } from '@utils/datatypes/Card';
import classNames from 'classnames';

export interface ImageFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  fallbackSrc: string;
  innerRef?: RefObject<HTMLImageElement>;
  // The printing being shown, when the caller has it. Used only to pick the corner
  // radius, since Alpha was cut rounder than later sets. Accepts a Card or bare
  // CardDetails because callers hold one or the other. Destructured out rather than
  // spread, so it never reaches the DOM.
  card?: Card | CardDetails;
  [key: string]: any;
  className?: string;
}

// Renders the fallback image immediately and preloads the real `src` in the
// background. The visible <img> element only points at `src` once the browser
// has actually fetched and decoded it, so card grids (search results, deck
// piles, etc.) show the loading placeholder card up front instead of blank
// slots that fill in one at a time.
const ImageFallback: React.FC<ImageFallbackProps> = ({ src, fallbackSrc, innerRef, className, card, ...props }) => {
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

  // This is the one place card-border is applied, so the radius is decided here too.
  return (
    <img
      className={classNames('card-border', { 'card-border-alpha': isAlphaPrinting(card) }, className)}
      src={resolvedSrc}
      ref={innerRef}
      {...props}
    />
  );
};

export default ImageFallback;
