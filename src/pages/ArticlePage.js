import React from 'react';
import PropTypes from 'prop-types';

import { CardHeader, Card } from 'reactstrap';

import DynamicFlash from 'components/DynamicFlash';
import Article from 'components/Article';
import ButtonLink from 'components/ButtonLink';
import Advertisement from 'components/Advertisement';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

const ArticlePage = ({ user, loginCallback, article }) => {
  return (
    <MainLayout loginCallback={loginCallback} user={user}>
      <Advertisement />
      <DynamicFlash />
      <Card className="mb-3">
        {user && user.id === article.owner && article.status !== 'published' && (
          <CardHeader>
            <h5>
              <em className="pr-3">*Draft*</em>
              <ButtonLink color="success" outline href={`/content/article/edit/${article._id}`}>
                Edit
              </ButtonLink>
            </h5>
          </CardHeader>
        )}
        <Article article={article} userid={user && user.id} />
      </Card>
    </MainLayout>
  );
};

ArticlePage.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    notifications: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  }),
  loginCallback: PropTypes.string,
  article: PropTypes.shape({
    title: PropTypes.string.isRequired,
    body: PropTypes.string.isRequired,
    _id: PropTypes.string.isRequired,
    owner: PropTypes.string.isRequired,
    status: PropTypes.string.isRequired,
  }).isRequired,
};

ArticlePage.defaultProps = {
  user: null,
  loginCallback: '/',
};

export default RenderToRoot(ArticlePage);
