import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';

import { Spinner } from 'reactstrap';
import { fromEntries } from '../utils/Util';

const withLoading = (Tag, handlers) => {
  const LoadingWrapped = ({ loading, spinnerSize, ...props }) => {
    const [stateLoading, setLoading] = useState(false);

    const wrappedHandlers = useMemo(
      () =>
        fromEntries(
          (handlers || []).map((name) => [
            name,
            async (event) => {
              setLoading(true);
              await props[name](event);
              setLoading(false);
            },
          ]),
        ),
      handlers.map((name) => props[name]),
    );

    const renderLoading = loading === null ? stateLoading : loading;

    return (
      <div className="d-flex justify-content-center align-items-center flex-grow-1">
        {renderLoading && <Spinner size={spinnerSize} className="position-absolute" />}
        <Tag {...props} {...wrappedHandlers} disabled={renderLoading} />
      </div>
    );
  };

  LoadingWrapped.propTypes = {
    loading: PropTypes.bool,
    spinnerSize: PropTypes.string,
  };

  LoadingWrapped.defaultProps = {
    loading: null,
    spinnerSize: undefined,
  };

  return LoadingWrapped;
};

export default withLoading;
