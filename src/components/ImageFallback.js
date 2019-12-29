import React, { useCallback, useEffect, useState } from 'react';

import { Spinner } from 'reactstrap';

const ImageFallback = ({ src, fallbackSrc, innerRef, ...props }) => {
  const [fallback, setFallback] = useState(false);

  const handleError = useCallback((event) => {
    setFallback(true);
  });

  useEffect(() => {
    setFallback(false);
  }, [src]);

  return <img src={fallback ? fallbackSrc : src} onError={handleError} ref={innerRef} {...props} />;
};

export default ImageFallback;
