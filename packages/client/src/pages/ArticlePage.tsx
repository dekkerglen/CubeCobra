import React, { useContext } from 'react';

import Banner from 'components/Banner';
import { Card, CardHeader } from 'components/base/Card';
import Text from 'components/base/Text';
import Article from 'components/content/Article';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import UserContext from 'contexts/UserContext';
import ArticleType from '@utils/datatypes/Article';
import { ContentStatus } from '@utils/datatypes/Content';
import MainLayout from 'layouts/MainLayout';

interface ArticlePageProps {
  article: ArticleType;
}

const ArticlePage: React.FC<ArticlePageProps> = ({ article }) => {
  const user = useContext(UserContext);

  return (
    <MainLayout>
      <Banner />
      <DynamicFlash />
      <Card className="my-2">
        {user && user.id === article.owner.id && article.status !== ContentStatus.PUBLISHED && (
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
