import React, { useCallback, useState } from 'react';
import { Button, Spinner } from 'reactstrap';

import PropTypes from 'prop-types';

const LoadingButton = ({ onClick, loading, block, outline, color, children }) => {
  const [stateLoading, setLoading] = useState(false);

  const handleClick = useCallback(
    async (event) => {
      setLoading(true);
      await onClick(event);
      setLoading(false);
    },
    [onClick],
  );

  const loadingControlled = loading !== null;
  const renderLoading = loadingControlled ? loading : stateLoading;
  const renderOnClick = loadingControlled ? onClick : handleClick;

  return (
    <div className={`d-flex justify-content-center align-items-center ${block ? 'w-100' : ''}`}>
      {renderLoading && <Spinner className="position-absolute" />}
      <Button block={block} outline={outline} color={color} onClick={renderOnClick} disabled={renderLoading}>
        {children}
      </Button>
    </div>
  );
};
LoadingButton.propTypes = {
  onClick: PropTypes.func,
  loading: PropTypes.bool,
  block: PropTypes.bool,
  outline: PropTypes.bool,
  color: PropTypes.string,
  children: PropTypes.node.isRequired,
};

LoadingButton.defaultProps = {
  loading: null,
  onClick: async () => {},
  block: false,
  outline: false,
  color: 'primary',
};

export default LoadingButton;
