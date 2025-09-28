import React from 'react';

import { Card, CardBody, CardHeader } from 'components/base/Card';
import Text from 'components/base/Text';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';

interface VersionPageProps {
  version: string;
  host: string;
}

const VersionPage: React.FC<VersionPageProps> = ({ version, host }) => {
  return (
    <MainLayout>
      <Card className="my-3">
        <CardHeader>
          <Text semibold lg>
            Deployment Details
          </Text>
        </CardHeader>
        <CardBody>
          <dl className="grid grid-cols-3 gap-4">
            <dt>Build Version</dt>
            <dd>
              <p>{version}</p>
            </dd>
          </dl>
          <dl className="grid grid-cols-3 gap-4">
            <dt>Host</dt>
            <dd>
              <p>{host}</p>
            </dd>
          </dl>
        </CardBody>
      </Card>
    </MainLayout>
  );
};

export default RenderToRoot(VersionPage);
