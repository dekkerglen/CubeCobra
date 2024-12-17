import React from 'react';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Text from 'components/base/Text';
import RenderToRoot from 'components/RenderToRoot';
import Link from 'components/base/Link';

const DownTimePage: React.FC = () => (
  <Col xs={12} md={8} xl={5} className="mx-auto">
    <Row className="mb-5 mt-4">
      <img src="/content/logo.png" alt="Cube Cobra logo" className="mx-auto" style={{ width: '50%' }} />
    </Row>
    <Card>
      <CardHeader>
        <Text semibold lg>
          Cube Cobra is currently down for scheduled maintenance.
        </Text>
      </CardHeader>
      <CardBody>
        <Flexbox direction="col" gap="2">
          <Text>
            The Cube Cobra developers are working hard on improving the service! This downtime is necessary to improve
            the long-term performance of Cube Cobra. Sorry for any temporary inconvenience!
          </Text>
          <Text>
            Feel free to contact us if you have any issues or concerns. Comments, ideas, and suggestions are always
            welcome. Here are the easiest ways to get in touch with us:
          </Text>
          <Row>
            <Col xs={12} sm={4}>
              <Text semibold>Official Twitter</Text>
            </Col>
            <Col xs={12} sm={8} className="mb-3">
              <Link href="https://twitter.com/CubeCobra1" target="_blank" rel="noopener noreferrer">
                @CubeCobra1
              </Link>
            </Col>
            <Col xs={12} sm={4}>
              <Text semibold>Email</Text>
            </Col>
            <Col xs={12} sm={8} className="mb-3">
              <Link href="mailto:support@cubecobra.com">support@cubecobra.com</Link>
            </Col>
            <Col xs={12} sm={4}>
              <Text semibold>Discord</Text>
            </Col>
            <Col xs={12} sm={8}>
              <Link href="https://discord.gg/Hn39bCU" target="_blank" rel="noopener noreferrer">
                https://discord.gg/Hn39bCU
              </Link>
            </Col>
          </Row>
        </Flexbox>
      </CardBody>
    </Card>
  </Col>
);

export default RenderToRoot(DownTimePage);
