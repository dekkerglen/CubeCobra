import React from 'react';
import PropTypes from 'prop-types';
import UserPropType from 'proptypes/UserPropType';
import ArticlePropType from 'proptypes/ArticlePropType';

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
        {user && user._id === article.owner && article.status !== 'published' && (
          <CardHeader>
            <h5>
              <em className="pr-3">*Draft*</em>
              <ButtonLink color="success" outline href={`/content/article/edit/${article._id}`}>
                Edit
              </ButtonLink>
            </h5>
          </CardHeader>
        )}
        <Article article={article} userid={user && user._id} />
      </Card>
    </MainLayout>
  );
};

ArticlePage.propTypes = {
  user: UserPropType,
  loginCallback: PropTypes.string,
  article: ArticlePropType.isRequired,
};

ArticlePage.defaultProps = {
  user: null,
  loginCallback: '/',
};

export default RenderToRoot(ArticlePage);
