import React from 'react';

import Banner from 'components/Banner';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import Text from 'components/base/Text';
import DynamicFlash from 'components/DynamicFlash';
import RegisterForm from 'components/forms/RegisterForm';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';

interface RegisterPageProps {
  email?: string;
  username?: string;
}

const RegisterPage: React.FC<RegisterPageProps> = ({ email = '', username = '' }) => (
  <MainLayout>
    <Banner />
    <DynamicFlash />
    <Card className="my-3">
      <CardHeader>
        <Text md semibold>
          Register
        </Text>
      </CardHeader>
      <CardBody>
        <RegisterForm email={email} username={username} />
      </CardBody>
    </Card>
  </MainLayout>
);

export default RenderToRoot(RegisterPage);
