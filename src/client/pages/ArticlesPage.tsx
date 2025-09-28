import React, { useState } from 'react';

import Banner from 'components/Banner';
import { Flexbox } from 'components/base/Layout';
import ArticlePreview from 'components/content/ArticlePreview';
import DynamicFlash from 'components/DynamicFlash';
import IndefinitePaginatedList from 'components/IndefinitePaginatedList';
import RenderToRoot from 'components/RenderToRoot';
import ArticleType from 'datatypes/Article';
import MainLayout from 'layouts/MainLayout';
interface ArticlesPageProps {
  articles: ArticleType[];
  lastKey: any; // Define a more specific type if possible
}

const ArticlesPage: React.FC<ArticlesPageProps> = ({ articles, lastKey }) => {
  const [items, setItems] = useState<ArticleType[]>(articles);
  const [currentLastKey, setLastKey] = useState(lastKey);

  return (
    <MainLayout>
      <Flexbox direction="col" gap="2" className="my-2">
        <Banner />
        <DynamicFlash />
        <IndefinitePaginatedList
          items={items}
          setItems={setItems}
          lastKey={currentLastKey}
          setLastKey={setLastKey}
          pageSize={24}
          header="Articles"
          fetchMoreRoute={`/content/getmorearticles`}
          renderItem={(item) => <ArticlePreview article={item} />}
          noneMessage="No articles found."
          xs={6}
          lg={4}
          xl={3}
          xxl={2}
          inCard
        />
      </Flexbox>
    </MainLayout>
  );
};

export default RenderToRoot(ArticlesPage);
