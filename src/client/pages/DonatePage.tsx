import React from 'react';

import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';

interface DonatePageProps {
  loginCallback?: string;
}

const DonatePage: React.FC<DonatePageProps> = ({ loginCallback = '/' }) => (
  <MainLayout loginCallback={loginCallback}>
    <DynamicFlash />
    <Card className="my-3 mx-4">
      <CardHeader>
        <Text semibold lg>
          Donate
        </Text>
      </CardHeader>
      <CardBody>
        <Flexbox direction="col" gap="2">
          <p>
            Donations are the best way to support Cube Cobra. All donations go towards maintenance costs for Cube Cobra.
          </p>
          <Text lg semibold>
            How to Donate
          </Text>
          <p>
            You can donate to Cube Cobra by becoming a patron on Patreon. Our patrons receive a range of exclusive
            features in return for their generous support. We also accept one-time donations through PayPal.
          </p>
          <Text lg semibold>
            Patreon Rewards
          </Text>
          <ul>
            <li>A totally ad-free browsing experience</li>
            <li>
              Access to exclusive <Link href="https://discord.gg/YYF9x65Ane">Discord</Link> channels available only to
              Patreon supporters
            </li>
            <li>
              A place for your cube on the <Text semibold>featured cubes</Text> list (from $5/month)
            </li>
            <li>
              Ability to submit high priority feature requests that will be prioritized by the developers (from
              $15/month)
            </li>
          </ul>
          <p>
            After becoming a patron, make sure to{' '}
            <Link href="/user/account?nav=patreon">link your Cube Cobra account</Link> to gain access to these benefits.
            If you are experiencing issues with your Patreon subscription, feel free to contact us on{' '}
            <Link href="https://discord.gg/YYF9x65Ane">Discord</Link>.
          </p>
          <Text lg semibold>
            Donation Links
          </Text>
          <Row>
            <Col xs={12} sm={4}>
              <Text semibold>Patreon (subscription)</Text>
            </Col>
            <Col xs={12} sm={8} className="mb-1">
              <Link href="https://www.patreon.com/cubecobra" target="_blank" rel="noopener noreferrer">
                https://www.patreon.com/cubecobra
              </Link>
            </Col>
            <Col xs={12} sm={4}>
              <Text semibold>Paypal (one-time donation)</Text>
            </Col>
            <Col xs={12} sm={8} className="mb-1">
              <Link href="https://www.paypal.me/cubecobra" target="_blank" rel="noopener noreferrer">
                https://www.paypal.me/cubecobra
              </Link>
            </Col>
          </Row>
        </Flexbox>
      </CardBody>
    </Card>
  </MainLayout>
);

export default RenderToRoot(DonatePage);
