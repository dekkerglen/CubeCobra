import React, { useContext } from 'react';
import PropTypes from 'prop-types';
import ArticlePropType from 'proptypes/ArticlePropType';

import { CardHeader, Card } from 'reactstrap';

import UserContext from 'contexts/UserContext';
import DynamicFlash from 'components/DynamicFlash';
import Article from 'components/Article';
import ButtonLink from 'components/ButtonLink';
import Banner from 'components/Banner';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';

const ArticlePage = ({ loginCallback, article }) => {
  const user = useContext(UserContext);

  return (
    <MainLayout loginCallback={loginCallback}>
      <Banner />
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
        <Article article={article} />
      </Card>
    </MainLayout>
  );
};

ArticlePage.propTypes = {
  loginCallback: PropTypes.string,
  article: ArticlePropType.isRequired,
};

ArticlePage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(ArticlePage);
