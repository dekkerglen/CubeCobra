import React from 'react';

import Button from 'components/base/Button';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Col, Row } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import { ContentType } from '@utils/datatypes/Content';
import MainLayout from 'layouts/MainLayout';

interface Document {
  id: string;
  type: ContentType.ARTICLE | ContentType.VIDEO | ContentType.PODCAST;
  title: string;
}

interface ReviewContentPageProps {
  content: Document[];
}

const typeMap = {
  a: 'article',
  v: 'video',
  p: 'podcast',
};

const ReviewContentPage: React.FC<ReviewContentPageProps> = ({ content }) => {
  return (
    <MainLayout>
      <DynamicFlash />
      <Card className="my-3">
        <CardHeader>
          <Text semibold lg>
            Content in Review
          </Text>
        </CardHeader>
        {content.map((document) => (
          <CardBody key={document.id}>
            <Row>
              <Col xs={12} sm={4}>
                <Text semibold>
                  {typeMap[document.type]}
                  {': '}
                </Text>
                <Link href={`/content/${typeMap[document.type]}/${document.id}`}>{document.title}</Link>
              </Col>
              <Col xs={12} sm={4}>
                <Button type="link" color="primary" outline block href={`/admin/publish/${document.id}`}>
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
