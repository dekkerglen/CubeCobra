import React from 'react';
import PropTypes from 'prop-types';
import UserPropType from 'proptypes/UserPropType';
import ArticlePropType from 'proptypes/ArticlePropType';

import { Row, Col } from 'reactstrap';

import DynamicFlash from 'components/DynamicFlash';
import ArticlePreview from 'components/ArticlePreview';
import Paginate from 'components/Paginate';
import Advertisement from 'components/Advertisement';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

const PAGE_SIZE = 24;

const ArticlesPage = ({ user, loginCallback, articles, count, page }) => (
  <MainLayout loginCallback={loginCallback} user={user}>
    <Advertisement user={user} />
    <DynamicFlash />
    <h4>Articles</h4>
    <Row>
      {articles.map((article) => (
        <Col className="mb-3" xs="12" sm="6" lg="4">
          <ArticlePreview article={article} />
        </Col>
      ))}
    </Row>
    {count > PAGE_SIZE && (
      <Paginate
        count={Math.ceil(count / PAGE_SIZE)}
        active={parseInt(page, 10)}
        urlF={(i) => `/content/articles/${i}`}
      />
    )}
  </MainLayout>
);

ArticlesPage.propTypes = {
  user: UserPropType,
  loginCallback: PropTypes.string,
  articles: PropTypes.arrayOf(ArticlePropType).isRequired,
  count: PropTypes.number.isRequired,
  page: PropTypes.number.isRequired,
};

ArticlesPage.defaultProps = {
  user: null,
  loginCallback: '/',
};

export default RenderToRoot(ArticlesPage);
