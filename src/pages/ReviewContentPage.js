import React from 'react';
import PropTypes from 'prop-types';

import { Card, CardHeader, CardBody, Row, Col } from 'reactstrap';

import DynamicFlash from 'components/DynamicFlash';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';
import ButtonLink from 'components/ButtonLink';

function ReviewContentPage({ loginCallback, content }) {
  return (
    <MainLayout loginCallback={loginCallback}>
      <DynamicFlash />
      <Card className="my-3">
        <CardHeader>
          <h5>Content in Review</h5>
        </CardHeader>
        {content.map((document) => (
          <CardBody className="border-top">
            <Row>
              <Col xs="12" sm="4">
                <p>type: {document.type}</p>
                <a href={`/content/${document.type}/${document.id}`}>{document.title}</a>
              </Col>
              <Col xs="12" sm="4">
                <ButtonLink color="accent" outline block href={`/admin/publish/${document.id}`}>
                  Publish
                </ButtonLink>
              </Col>
              <Col xs="12" sm="4">
                <ButtonLink color="unsafe" outline block href={`/admin/removereview/${document.id}`}>
                  Remove from Reviews
                </ButtonLink>
              </Col>
            </Row>
          </CardBody>
        ))}
      </Card>
    </MainLayout>
  );
}

ReviewContentPage.propTypes = {
  loginCallback: PropTypes.string,
  content: PropTypes.arrayOf({}).isRequired,
};

ReviewContentPage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(ReviewContentPage);
