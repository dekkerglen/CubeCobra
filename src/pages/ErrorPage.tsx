import React from 'react';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import Text from 'components/base/Text';

import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';
import { Flexbox } from 'components/base/Layout';

interface ErrorPageProps {
  title: string;
  requestId?: string;
  error?: string;
  details?: Record<string, unknown>;
  loginCallback?: string;
}

const ErrorPage: React.FC<ErrorPageProps> = ({ title, error, requestId, loginCallback = '/', details }) => {
  console.log(details);

  return (
    <MainLayout loginCallback={loginCallback}>
      <DynamicFlash />
      <Card className="my-2">
        <CardHeader>
          <Text semibold lg>
            {title}
          </Text>
        </CardHeader>
        <CardBody>
          <Flexbox direction="col" gap="2">
            <p>
              If you think this was a mistake, please report this on the{' '}
              <a href="https://discord.gg/Hn39bCU">Cube Cobra Discord</a>
            </p>
            {error && (
              <p>
                <code>{error}</code>
              </p>
            )}
            {requestId && (
              <p>
                Request ID: <code>{requestId}</code>
              </p>
            )}
          </Flexbox>
        </CardBody>
      </Card>
    </MainLayout>
  );
};

export default RenderToRoot(ErrorPage);
