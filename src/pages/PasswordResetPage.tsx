import Banner from 'components/Banner';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import Text from 'components/base/Text';
import DynamicFlash from 'components/DynamicFlash';
import PasswordResetForm from 'components/forms/PaswordResetForm';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';
import React from 'react';

interface PasswordResetPageProps {
  loginCallback?: string;
  code: string;
}

const PasswordResetPage: React.FC<PasswordResetPageProps> = ({ loginCallback = '/', code }) => (
  <MainLayout loginCallback={loginCallback}>
    <Banner />
    <DynamicFlash />
    <Card className="my-3">
      <CardHeader>
        <Text md semibold>
          Reset Password
        </Text>
      </CardHeader>
      <CardBody>
        <PasswordResetForm code={code} />
      </CardBody>
    </Card>
  </MainLayout>
);

export default RenderToRoot(PasswordResetPage);
