import React from 'react';

import CSRFForm from 'components/CSRFForm';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import Button from 'components/base/Button';
import Container from 'components/base/Container';
import { Flexbox } from 'components/base/Layout';
import TextArea from 'components/base/TextArea';

interface AdminDashboardPageProps {
  loginCallback?: string;
}

const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({ loginCallback = '/' }) => (
  <MainLayout loginCallback={loginCallback}>
    <DynamicFlash />
    <Container md>
      <Card className="my-3 mx-4">
        <CSRFForm method="POST" action="/content/submitapplication">
          <CardHeader>
            <h5>Apply to be a Cube Cobra Content Creator Partner</h5>
          </CardHeader>
          <CardBody>
            <Flexbox direction="col" gap="2">
              <p>
                Content Creator Partners have access to post articles, videos, and podcasts on Cube Cobra. If you have
                more questions about the program, please reach out <a href="/contact">here</a>.
              </p>
              <p>
                Please explain why you want to become a content creator partner. Links to existing content are
                appreciated. If you do not have any existing content, what are your goals, and what sort of content are
                you looking to create?
              </p>
              <TextArea
                className="w-100 mb-3"
                id="info"
                name="info"
                placeholder="Please list as much info as you can here."
                rows={5}
              />
              <Button color="primary" block outline>
                Submit
              </Button>
            </Flexbox>
          </CardBody>
        </CSRFForm>
      </Card>
    </Container>
  </MainLayout>
);

export default RenderToRoot(AdminDashboardPage);
