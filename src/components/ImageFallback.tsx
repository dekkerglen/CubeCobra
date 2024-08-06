import React, { RefObject, useEffect, useState } from 'react';

export interface ImageFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  fallbackSrc: string;
  innerRef?: RefObject<HTMLImageElement>;
  [key: string]: any;
}

const ImageFallback: React.FC<ImageFallbackProps> = ({ src, fallbackSrc, innerRef, ...props }) => {
  const [fallback, setFallback] = useState(false);

  const handleError = () => setFallback(true);

  useEffect(() => setFallback(false), [src]);

  return <img src={fallback || !src ? fallbackSrc : src} onError={handleError} ref={innerRef} {...props} />;
};

export default ImageFallback;
