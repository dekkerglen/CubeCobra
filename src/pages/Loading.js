import React from 'react';

import { Spinner } from 'reactstrap';

function Loading() {
  return (
    <div className="centered py-3">
      <Spinner className="position-absolute" />
    </div>
  );
}

export default Loading;
