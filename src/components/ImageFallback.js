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

  return <>
    {props.cardid ?
      <a href={'/tool/card/' + props.cardid}>
        <img src={fallback ? fallbackSrc : src} onError={handleError} ref={innerRef} {...props} />
      </a>
      :
      <img src={fallback ? fallbackSrc : src} onError={handleError} ref={innerRef} {...props} />
    }
  </>;
};

export default ImageFallback;
