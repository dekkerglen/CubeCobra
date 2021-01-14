import { useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import { Button, Spinner } from 'reactstrap';

const LoadingButton = ({ onClick, loading, ...props }) => {
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
    <div className="d-flex justify-content-center align-items-center">
      {renderLoading && <Spinner className="position-absolute" />}
      <Button {...props} onClick={renderOnClick} disabled={renderLoading} />
    </div>
  );
};
LoadingButton.propTypes = {
  onClick: PropTypes.func.isRequired,
  loading: PropTypes.bool,
};
LoadingButton.defaultProps = {
  loading: null,
};

export default LoadingButton;
