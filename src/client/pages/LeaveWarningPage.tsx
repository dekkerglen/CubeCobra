import React from 'react';

import Button from 'components/base/Button';
import { Card, CardBody, CardFooter, CardHeader } from 'components/base/Card';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';

interface LeaveWarningPageProps {
  url: string;
}

const back = () => (window.history.length > 1 ? window.history.back() : window.close());

const LeaveWarningPage: React.FC<LeaveWarningPageProps> = ({ url }) => (
  <MainLayout>
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
        <Flexbox direction="row" gap="2" className="m-2">
          <Button href={url} color="danger" type="link">
            Yes, continue
          </Button>
          <Button color="secondary" onClick={back}>
            Go back
          </Button>
        </Flexbox>
      </CardFooter>
    </Card>
  </MainLayout>
);

export default RenderToRoot(LeaveWarningPage);
