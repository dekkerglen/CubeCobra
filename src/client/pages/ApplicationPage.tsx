import React from 'react';

import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import Container from 'components/base/Container';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import TextArea from 'components/base/TextArea';
import CSRFForm from 'components/CSRFForm';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';

interface AdminDashboardPageProps {
  loginCallback?: string;
}

const ApplicationPage: React.FC<AdminDashboardPageProps> = ({ loginCallback = '/' }) => {
  const [info, setInfo] = React.useState<string>('');
  const formRef = React.useRef<HTMLFormElement>(null);
  const formData = React.useMemo(() => ({}), []);

  return (
    <MainLayout loginCallback={loginCallback}>
      <DynamicFlash />
      <Container md>
        <Card className="my-3 mx-4">
          <CSRFForm method="POST" action="/content/submitapplication" ref={formRef} formData={formData}>
            <CardHeader>
              <Text md semibold>
                Apply to be a Cube Cobra Content Creator Partner
              </Text>
            </CardHeader>
            <CardBody>
              <Flexbox direction="col" gap="2">
                <p>
                  Content Creator Partners have access to post articles, videos, and podcasts on Cube Cobra. If you have
                  more questions about the program, please reach out <a href="/contact">here</a>.
                </p>
                <p>
                  Please explain why you want to become a content creator partner. Links to existing content are
                  appreciated. If you do not have any existing content, what are your goals, and what sort of content
                  are you looking to create?
                </p>
                <TextArea
                  className="w-full mb-3"
                  id="info"
                  name="info"
                  placeholder="Please list as much info as you can here."
                  rows={5}
                  value={info}
                  onChange={(e) => setInfo(e.target.value)}
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
};

export default RenderToRoot(ApplicationPage);
