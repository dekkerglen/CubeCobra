import React from 'react';
import { Card, CardBody, CardFooter, CardHeader } from 'reactstrap';

import Button from 'components/base/Button';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';
import Text from 'components/base/Text';

interface LeaveWarningPageProps {
  url: string;
  loginCallback?: string;
}

const back = () => (window.history.length > 1 ? window.history.back() : window.close());

const LeaveWarningPage: React.FC<LeaveWarningPageProps> = ({ url, loginCallback = '/' }) => (
  <MainLayout loginCallback={loginCallback}>
    <DynamicFlash />
    <Card className="my-3">
      <CardHeader>
        <Text semibold lg>
          You are about to leave CubeCobra
        </Text>
      </CardHeader>
      <CardBody>
        <p>
          This link leads to: <code>{url}</code>
        </p>
        <p>Are you sure you want to proceed?</p>
      </CardBody>
      <CardFooter>
        <Button href={url} color="danger">
          Yes, continue
        </Button>
        <Button color="secondary" onClick={back}>
          Go back
        </Button>
      </CardFooter>
    </Card>
  </MainLayout>
);

export default RenderToRoot(LeaveWarningPage);
