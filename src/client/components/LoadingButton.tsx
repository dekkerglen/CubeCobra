import React, { useCallback, useState } from 'react';

import Button, { ButtonProps } from './base/Button';
import Spinner from './base/Spinner';

interface LoadingButtonProps extends Omit<ButtonProps, 'onClick'> {
  loading?: boolean | null;
  onClick: () => void | Promise<void>;
}

const LoadingButton: React.FC<LoadingButtonProps> = ({ onClick, loading = null, children, ...props }) => {
  const [stateLoading, setLoading] = useState(false);

  const handleClick = useCallback(async () => {
    setLoading(true);
    await onClick();
    setLoading(false);
  }, [onClick]);

  const loadingControlled = loading !== null;
  const renderLoading = loadingControlled ? loading : stateLoading;
  const renderOnClick = loadingControlled ? onClick : handleClick;

  return (
    <Button {...props} onClick={() => renderOnClick()} disabled={renderLoading}>
      <div className={`centered`}>{renderLoading ? <Spinner className="position-absolute" /> : children}</div>
    </Button>
  );
};

export default LoadingButton;
