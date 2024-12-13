import React from 'react';
import { Col, Row } from 'components/base/Layout';
import Text from 'components/base/Text';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import Button from 'components/base/Button';

interface Document {
  id: string;
  type: string;
  title: string;
}

interface ReviewContentPageProps {
  loginCallback?: string;
  content: Document[];
}

const ReviewContentPage: React.FC<ReviewContentPageProps> = ({ loginCallback = '/', content }) => {
  return (
    <MainLayout loginCallback={loginCallback}>
      <DynamicFlash />
      <Card className="my-3">
        <CardHeader>
          <Text semibold lg>
            Content in Review
          </Text>
        </CardHeader>
        {content.map((document) => (
          <CardBody key={document.id} className="border-t">
            <Row>
              <Col xs={12} sm={4}>
                <p>type: {document.type}</p>
                <a href={`/content/${document.type}/${document.id}`}>{document.title}</a>
              </Col>
              <Col xs={12} sm={4}>
                <Button type="link" color="accent" outline block href={`/admin/publish/${document.id}`}>
                  Publish
                </Button>
              </Col>
              <Col xs={12} sm={4}>
                <Button type="link" color="danger" outline block href={`/admin/removereview/${document.id}`}>
                  Remove from Reviews
                </Button>
              </Col>
            </Row>
          </CardBody>
        ))}
      </Card>
    </MainLayout>
  );
};

export default RenderToRoot(ReviewContentPage);
