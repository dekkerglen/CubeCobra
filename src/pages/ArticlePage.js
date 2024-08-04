import React, { useContext } from 'react';
import { Card, CardHeader } from 'reactstrap';

import PropTypes from 'prop-types';
import ContentPropType from 'proptypes/ContentPropType';

import Article from 'components/Article';
import Banner from 'components/Banner';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import UserContext from 'contexts/UserContext';
import MainLayout from 'layouts/MainLayout';

const ArticlePage = ({ loginCallback, article }) => {
  const user = useContext(UserContext);

  return (
    <MainLayout loginCallback={loginCallback}>
      <Banner />
      <DynamicFlash />
      <Card className="mb-3">
        {user && user.id === article.owner.id && article.status !== 'p' && (
          <CardHeader>
            <h5>
              <em className="pe-3">*Draft*</em>
              <a href={`/content/article/edit/${article.id}`}>Edit</a>
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
  article: ContentPropType.isRequired,
};

ArticlePage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(ArticlePage);
