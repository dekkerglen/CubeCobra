import React, { useState, useCallback } from 'react';
import InfiniteScroll from 'react-infinite-scroll-component';

import ArticlePreview from 'components/content/ArticlePreview';
import Banner from 'components/Banner';
import DynamicFlash from 'components/DynamicFlash';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'components/RenderToRoot';
import { csrfFetch } from 'utils/CSRF';
import { wait } from 'utils/Util';
import ArticleType from 'datatypes/Article';
import { Row, Col } from 'components/base/Layout';
import Spinner from 'components/base/Spinner';

interface ArticlesPageProps {
  loginCallback?: string;
  articles: ArticleType[];
  lastKey: any; // Define a more specific type if possible
}

const loader = (
  <div className="centered py-3 my-4">
    <Spinner className="position-absolute" />
  </div>
);

const ArticlesPage: React.FC<ArticlesPageProps> = ({ loginCallback = '/', articles, lastKey }) => {
  const [items, setItems] = useState<ArticleType[]>(articles);
  const [currentLastKey, setLastKey] = useState(lastKey);

  const fetchMoreData = useCallback(async () => {
    // intentionally wait to avoid too many DB queries
    await wait(2000);

    const response = await csrfFetch(`/content/getmorearticles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lastKey: currentLastKey,
      }),
    });

    if (response.ok) {
      const json = await response.json();
      if (json.success === 'true') {
        setItems([...items, ...json.articles]);
        setLastKey(json.lastKey);
      }
    }
  }, [items, currentLastKey]);

  return (
    <MainLayout loginCallback={loginCallback}>
      <Banner />
      <DynamicFlash />
      <h4>Articles</h4>
      <InfiniteScroll dataLength={items.length} next={fetchMoreData} hasMore={currentLastKey !== null} loader={loader}>
        <Row>
          {items.map((item) => (
            <Col key={item.id} xs={6} sm={6} lg={4} xxl={3}>
              <ArticlePreview article={item} />
            </Col>
          ))}
        </Row>
      </InfiniteScroll>
    </MainLayout>
  );
};

export default RenderToRoot(ArticlesPage);
