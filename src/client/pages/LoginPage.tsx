import React from 'react';

import Banner from 'components/Banner';
import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import DynamicFlash from 'components/DynamicFlash';
import LoginForm from 'components/forms/LoginForm';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';

const LoginPage: React.FC = () => {
  const formRef = React.useRef<HTMLFormElement>(null);
  return (
    <MainLayout loginCallback={'/'}>
      <Banner />
      <DynamicFlash />
      <Card className="my-3">
        <CardHeader>
          <Text md semibold>
            Login
          </Text>
        </CardHeader>
        <CardBody>
          <Flexbox direction="col" gap="2">
            <LoginForm loginCallback={'/'} formRef={formRef} />
            <Button type="submit" color="primary" block onClick={() => formRef.current?.submit()}>
              Login
            </Button>
          </Flexbox>
        </CardBody>
      </Card>
    </MainLayout>
  );
};

export default RenderToRoot(LoginPage);
