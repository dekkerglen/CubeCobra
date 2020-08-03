import React, { useState } from 'react';

import { Col, Card, CardBody } from 'reactstrap';

const Advertisment = () => {
  const [option] = useState(Math.floor(Math.random() * 4));

  if (option === 0) {
    return (
      <Col xs="12" d className="py-2">
        <Card>
          <CardBody>
            Cube Cobra's hosting fees are covered completely by donations. If you enjoy the service Cube Cobra provides,
            please consider
            <strong>
              <a href="https://www.patreon.com/cubecobra"> donating</a>
            </strong>
            .
          </CardBody>
        </Card>
      </Col>
    );
  }
  if (option === 1) {
    return (
      <Col xs="12" className="py-2">
        <Card>
          <CardBody>
            Enjoying Cube Cobra? You can help support Cube Cobra by purchasing playmats at our
            <strong>
              <a href="https://www.inkedgaming.com/collections/artists/gwen-dekker?rfsn=4250904.d3f372&utm_source=refersion&utm_medium=affiliate&utm_campaign=4250904.d3f372">
                {' '}
                inked gaming page
              </a>
              !
            </strong>
          </CardBody>
        </Card>
      </Col>
    );
  }

  return <></>;
};

export default Advertisment;
