import React from 'react';
import { Card, CardBody, CardHeader } from 'reactstrap';

import PropTypes from 'prop-types';

const CubeDraftError = ({ message }) => {
  return (
    <Card className="mt-4">
      <CardHeader>
        <h4>Error: could not join draft.</h4>
      </CardHeader>
      <CardBody>
        <p>{message}</p>
      </CardBody>
    </Card>
  );
};

CubeDraftError.propTypes = {
  message: PropTypes.string.isRequired,
};

export default CubeDraftError;
