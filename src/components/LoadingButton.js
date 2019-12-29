import React, { useCallback, useState } from 'react';

import { Button, Spinner } from 'reactstrap';

const LoadingButton = ({ onClick, ...props }) => {
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(async (event) => {
    setLoading(true);
    await onClick(event);
    setLoading(false);
  });

  return (
    <div className="d-flex justify-content-center align-items-center">
      {loading && <Spinner className="position-absolute" />}
      <Button {...props} onClick={handleClick} disabled={loading} />
    </div>
  );
};

export default LoadingButton;
