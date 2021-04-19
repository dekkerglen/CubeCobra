import React, { useState } from 'react';

import { Col, Card, CardBody } from 'reactstrap';

const Advertisement = () => {
  const [option] = useState(Math.floor(Math.random() * 6));

  switch (option) {
    case 0:
      return (
        <Col xs="12" className="py-2">
          <Card>
            <CardBody>
              Cube Cobra's hosting fees are covered completely by donations. If you enjoy the service Cube Cobra
              provides, please consider{' '}
              <strong>
                <a href="https://www.patreon.com/cubecobra">donating</a>
              </strong>
              .
            </CardBody>
          </Card>
        </Col>
      );

    case 1:
      return (
        <Col xs="12" className="py-2">
          <Card>
            <CardBody>
              Enjoying Cube Cobra? You can help support Cube Cobra by purchasing playmats at our{' '}
              <strong>
                <a href="https://www.inkedgaming.com/collections/artists-gwen-dekker?rfsn=4250904.d3f372&utm_source=refersion&utm_medium=affiliate&utm_campaign=4250904.d3f372">
                  inked gaming page
                </a>
                !
              </strong>
            </CardBody>
          </Card>
        </Col>
      );

    case 2:
      return (
        <Col xs="12" className="py-2">
          <Card>
            <CardBody>
              Want to showcase your cube? You can feature it as a reward for{' '}
              <strong>
                <a href="https://www.patreon.com/cubecobra">donating</a>
              </strong>{' '}
              to Cube Cobra.{' '}
              <strong>
                <a href="/donate">Find out more.</a>
              </strong>
            </CardBody>
          </Card>
        </Col>
      );

    default:
      return <></>;
  }
};

export default Advertisement;
