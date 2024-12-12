import React from 'react';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import Text from 'components/base/Text';
import Banner from 'components/Banner';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';
import Button from 'components/base/Button';
import LoginForm from 'components/forms/LoginForm';
import { Flexbox } from 'components/base/Layout';

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
            <Button type="submit" color="accent" block onClick={() => formRef.current?.submit()}>
              Login
            </Button>
          </Flexbox>
        </CardBody>
      </Card>
    </MainLayout>
  );
};

export default RenderToRoot(LoginPage);
