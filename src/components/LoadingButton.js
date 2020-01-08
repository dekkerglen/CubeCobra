import React, { useCallback, useState } from 'react';

import { Button, Spinner } from 'reactstrap';

const LoadingButton = ({ onClick, loading, ...props }) => {
  const [stateLoading, setLoading] = useState(false);

  const handleClick = useCallback(async (event) => {
    setLoading(true);
    await onClick(event);
    setLoading(false);
  }, [onClick]);

  const loadingControlled = typeof loading !== 'undefined';
  const renderLoading = loadingControlled ? loading : stateLoading;
  const renderOnClick = loadingControlled ? onClick : handleClick;

  return (
    <div className="d-flex justify-content-center align-items-center">
      {renderLoading && <Spinner className="position-absolute" />}
      <Button {...props} onClick={renderOnClick} disabled={renderLoading} />
    </div>
  );
};

export default LoadingButton;
