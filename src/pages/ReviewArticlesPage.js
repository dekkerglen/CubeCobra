import React from 'react';
import PropTypes from 'prop-types';
import ArticlePropType from 'proptypes/ArticlePropType';

import { Card, CardHeader, CardBody, Row, Col } from 'reactstrap';

import DynamicFlash from 'components/DynamicFlash';
import Paginate from 'components/Paginate';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';
import ButtonLink from 'components/ButtonLink';
import ArticlePreview from 'components/ArticlePreview';

const PAGE_SIZE = 24;

const ReviewArticlesPage = ({ loginCallback, articles, count, page }) => (
  <MainLayout loginCallback={loginCallback}>
    <DynamicFlash />
    <Card className="my-3">
      <CardHeader>
        <h5>Articles in Review</h5>
        {count > PAGE_SIZE ? (
          <>
            <h6>
              {`Displaying ${PAGE_SIZE * page + 1}-${Math.min(count, PAGE_SIZE * (page + 1))} of ${count} Articles`}
            </h6>
            <Paginate
              count={Math.ceil(count / PAGE_SIZE)}
              active={parseInt(page, 10)}
              urlF={(i) => `/admin/reviewarticles/${i}`}
            />
          </>
        ) : (
          <h6>{`Displaying all ${count} Articles`}</h6>
        )}
      </CardHeader>
      {articles.map((article) => (
        <CardBody className="border-top">
          <Row>
            <Col xs="12" sm="4">
              <ArticlePreview article={article} />
            </Col>
            <Col xs="12" sm="4">
              <ButtonLink color="success" outline block href={`/admin/publisharticle/${article._id}`}>
                Publish
              </ButtonLink>
            </Col>
            <Col xs="12" sm="4">
              <ButtonLink color="danger" outline block href={`/admin/removearticlereview/${article._id}`}>
                Remove from Reviews
              </ButtonLink>
            </Col>
          </Row>
        </CardBody>
      ))}
    </Card>
  </MainLayout>
);

ReviewArticlesPage.propTypes = {
  loginCallback: PropTypes.string,
  articles: PropTypes.arrayOf(ArticlePropType).isRequired,
  count: PropTypes.number.isRequired,
  page: PropTypes.number.isRequired,
};

ReviewArticlesPage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(ReviewArticlesPage);
