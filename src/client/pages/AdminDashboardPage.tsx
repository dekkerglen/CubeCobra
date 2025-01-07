import React from 'react';

import Button from 'components/base/Button';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';
import Container from 'components/base/Container';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import Text from 'components/base/Text';
import { Flexbox } from 'components/base/Layout';

interface AdminDashboardPageProps {
  loginCallback?: string;
  noticeCount: number;
  contentInReview: number;
}

const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({
  loginCallback = '/',
  noticeCount,
  contentInReview,
}) => (
  <MainLayout loginCallback={loginCallback}>
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
          </Flexbox>
        </CardBody>
      </Card>
    </Container>
  </MainLayout>
);

export default RenderToRoot(AdminDashboardPage);
