import React from 'react';
import PropTypes from 'prop-types';
import DraftPropType from 'proptypes/DraftPropType';

import { Button, Card, CardHeader, CardBody, CardFooter } from 'reactstrap';

const CubeDraft = ({ draft, seat, start }) => {
  return (
    <Card className="mt-4">
      <CardHeader>
        <h4>Setting Up Draft...</h4>
      </CardHeader>
      <CardBody>
        <p>TODO: add player join mechanism here</p>
      </CardBody>
      <CardFooter>
        <Button color="success" outline onClick={start}>
          Start Draft
        </Button>
      </CardFooter>
    </Card>
  );
};

CubeDraft.propTypes = {
  seat: PropTypes.number.isRequired,
  draft: DraftPropType.isRequired,
};

export default CubeDraft;
