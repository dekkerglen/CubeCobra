import React from 'react';

import { Row, Col, Card, CardHeader, CardBody } from 'reactstrap';
import RenderToRoot from 'utils/RenderToRoot';

const DownTimePage = () => (
  <Col xs="12" md="8" xl="5" style={{ margin: 'auto' }}>
    <Row style={{ margin: 'auto' }} width="50%" className="mb-5 mt-4">
      <img src="/content/logo.png" alt="Cube Cobra logo" width="50%" style={{ margin: 'auto' }} />
    </Row>
    <Card>
      <CardHeader>
        <h5>Cube Cobra is currently down for scheduled maintenence.</h5>
      </CardHeader>
      <CardBody>
        <p>
          The Cube Cobra developers are working hard on improving the service! This downtime is neccesary to improve the
          long-term performance of Cube Cobra. Sorry for any temporary inconvenience!
        </p>
        <p>
          Feel free to contact us if you have any issues or concerns. Comments, ideas, and suggestions are always
          welcome. Here are the easiest ways to get in touch with us:
        </p>

        <Row>
          <Col xs="12" sm="4">
            <strong>Official Twitter</strong>
          </Col>
          <Col xs="12" sm="8" className="mb-3">
            <a href="https://twitter.com/CubeCobra1" target="_blank" rel="noopener noreferrer">
              @CubeCobra1
            </a>
          </Col>
          <Col xs="12" sm="4">
            <strong>Email</strong>
          </Col>
          <Col xs="12" sm="8" className="mb-3">
            <a href="mailto:support@cubecobra.com">support@cubecobra.com</a>
          </Col>
          <Col xs="12" sm="4">
            <strong>Discord</strong>
          </Col>
          <Col xs="12" sm="8">
            <a href="https://discord.gg/Hn39bCU" target="_blank" rel="noopener noreferrer">
              https://discord.gg/Hn39bCU
            </a>
          </Col>
        </Row>
      </CardBody>
    </Card>
  </Col>
);

export default RenderToRoot(DownTimePage);
