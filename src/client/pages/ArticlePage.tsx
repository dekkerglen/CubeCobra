import React, { useContext } from 'react';

import Article from 'components/content/Article';
import Banner from 'components/Banner';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import UserContext from 'contexts/UserContext';
import MainLayout from 'layouts/MainLayout';
import ArticleType from 'datatypes/Article';
import { Card, CardHeader } from 'components/base/Card';
import Text from 'components/base/Text';

interface ArticlePageProps {
  loginCallback?: string;
  article: ArticleType;
}

const ArticlePage: React.FC<ArticlePageProps> = ({ loginCallback = '/', article }) => {
  const user = useContext(UserContext);

  return (
    <MainLayout loginCallback={loginCallback}>
      <Banner />
      <DynamicFlash />
      <Card className="my-2">
        {user && user.id === article.owner.id && article.status !== 'p' && (
          <CardHeader>
            <Text semibold lg>
              <em className="pe-3">*Draft*</em>
              <a href={`/content/article/edit/${article.id}`}>Edit</a>
            </Text>
          </CardHeader>
        )}
        <Article article={article} />
      </Card>
    </MainLayout>
  );
};

export default RenderToRoot(ArticlePage);
