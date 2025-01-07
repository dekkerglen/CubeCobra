import React from 'react';

import Banner from 'components/Banner';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Row, Col, Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import Link from 'components/base/Link';

interface ContactPageProps {
  loginCallback?: string;
}

const ContactPage: React.FC<ContactPageProps> = ({ loginCallback = '/' }) => (
  <MainLayout loginCallback={loginCallback}>
    <Banner />
    <DynamicFlash />
    <Card className="my-3 mx-4">
      <CardHeader>
        <Text semibold xl>
          Contact
        </Text>
      </CardHeader>
      <CardBody>
        <Flexbox direction="col" gap="2">
          <Text>
            Cube Cobra is a free service, and we want to make sure that all users have a great experience. We are
            dedicated to providing the best service we can, and we are always looking for ways to improve.
          </Text>
          <Text>
            Feel free to contact us if you have any issues or concerns. Comments, ideas, and suggestions are always
            welcome. Here are the easiest ways to get in touch with us:
          </Text>
          <Row>
            <Col xs={12} sm={4}>
              <Text semibold>Official Bluesky</Text>
            </Col>
            <Col xs={12} sm={8} className="mb-3">
              <Link href="https://bsky.app/profile/cubecobra.com" target="_blank" rel="noopener noreferrer">
                @cubecobra.com
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
              <Link href="https://discord.gg/YYF9x65Ane" target="_blank" rel="noopener noreferrer">
                https://discord.gg/YYF9x65Ane
              </Link>
            </Col>
          </Row>
          <Text className="mt-4">
            If you're looking to apply to be a Cube Cobra content creator partner, please fill out the application{' '}
            <Link href="/content/application">here</Link>.
          </Text>
        </Flexbox>
      </CardBody>
    </Card>
  </MainLayout>
);

export default RenderToRoot(ContactPage);
