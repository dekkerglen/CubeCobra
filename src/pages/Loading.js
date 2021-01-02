import React from 'react';

import { Spinner } from 'reactstrap';

const Loading = () => (
  <div className="centered py-3">
    <Spinner className="position-absolute" />
  </div>
);

export default Loading;
