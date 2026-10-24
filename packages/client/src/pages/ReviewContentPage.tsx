import React from 'react';

import { ContentType } from '@utils/datatypes/Content';

import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Col, Row } from 'components/base/Layout';
import Link from 'components/base/Link';
import PostButton from 'components/base/PostButton';
import Text from 'components/base/Text';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
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
                <PostButton action={`/admin/publish/${document.id}`} color="primary" outline block>
                  Publish
                </PostButton>
              </Col>
              <Col xs={12} sm={4}>
                <PostButton action={`/admin/removereview/${document.id}`} color="danger" outline block>
                  Remove from Reviews
                </PostButton>
              </Col>
            </Row>
          </CardBody>
        ))}
      </Card>
    </MainLayout>
  );
};

export default RenderToRoot(ReviewContentPage);
