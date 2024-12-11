import Banner from 'components/Banner';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import Text from 'components/base/Text';
import DynamicFlash from 'components/DynamicFlash';
import LostPasswordForm from 'components/forms/LostPasswordForm';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';
import React from 'react';

interface LostPasswordPageProps {
  loginCallback?: string;
}

const LostPasswordPage: React.FC<LostPasswordPageProps> = ({ loginCallback = '/' }) => (
  <MainLayout loginCallback={loginCallback}>
    <Banner />
    <DynamicFlash />
    <Card className="my-3">
      <CardHeader>
        <Text md semibold>
          Recover Password
        </Text>
      </CardHeader>
      <CardBody>
        <p>
          To recover your password, provide the email associated with the account. A password reset link will be emailed
          to you.
        </p>
        <LostPasswordForm />
      </CardBody>
    </Card>
  </MainLayout>
);

export default RenderToRoot(LostPasswordPage);
