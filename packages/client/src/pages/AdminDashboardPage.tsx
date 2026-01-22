import React from 'react';

import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import Container from 'components/base/Container';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';

interface AdminDashboardPageProps {
  noticeCount: number;
  contentInReview: number;
}

const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({ noticeCount, contentInReview }) => (
  <MainLayout>
    <DynamicFlash />
    <Container sm>
      <Card className="my-3 mx-4">
        <CardHeader>
          <Text semibold xl>
            Admin Dashboard
          </Text>
        </CardHeader>
        <CardBody>
          <Flexbox direction="col" gap="2">
            <Button href="/admin/notices" block outline color="primary" type="link">
              {`Notices (${noticeCount})`}
            </Button>
            <Button href="/admin/reviewcontent" block outline color="primary" type="link">
              {`Review Content (${contentInReview})`}
            </Button>
            <Button href="/admin/featuredcubes" block outline color="primary" type="link">
              Featured Cubes Queue
            </Button>
            <Button href="/admin/cardupdates" block outline color="primary" type="link">
              Card Updates & Tasks
            </Button>
          </Flexbox>
        </CardBody>
      </Card>
    </Container>
  </MainLayout>
);

export default RenderToRoot(AdminDashboardPage);
