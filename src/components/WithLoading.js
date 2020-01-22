import React, { useMemo, useState } from 'react';

import { Spinner } from 'reactstrap';
import { fromEntries } from '../utils/Util';

const withLoading = (Tag, handlers) => ({ spinnerSize, ...props }) => {
  const [loading, setLoading] = useState(false);

  const wrappedHandlers = useMemo(
    () =>
      fromEntries(
        handlers.map((name) => [
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

  return (
    <div className="d-flex justify-content-center align-items-center">
      {loading && <Spinner size={spinnerSize} className="position-absolute" />}
      <Tag {...props} {...wrappedHandlers} disabled={loading} />
    </div>
  );
};

export default withLoading;
