import React, { useCallback, useState } from 'react';
import InfiniteScroll from 'react-infinite-scroll-component';

import ArticlePreview from 'components/ArticlePreview';
import Banner from 'components/Banner';
import DynamicFlash from 'components/DynamicFlash';
import PodcastEpisodePreview from 'components/PodcastEpisodePreview';
import RenderToRoot from 'components/RenderToRoot';
import VideoPreview from 'components/VideoPreview';
import MainLayout from 'layouts/MainLayout';
import { csrfFetch } from 'utils/CSRF';
import { wait } from 'utils/Util';
import Spinner from 'components/base/Spinner';
import { Col, Row } from 'components/base/Layout';
import Content from 'datatypes/Content';
import Episode from 'datatypes/Episode';

interface BrowseContentPageProps {
  loginCallback?: string;
  content: Content[];
  lastKey: any; // Define a more specific type if possible
}

const BrowseContentPage: React.FC<BrowseContentPageProps> = ({ loginCallback = '/', content, lastKey }) => {
  const [items, setItems] = useState<Content[]>(content);
  const [currentLastKey, setLastKey] = useState(lastKey);

  const fetchMoreData = useCallback(async () => {
    // intentionally wait to avoid too many DB queries
    await wait(2000);

    const response = await csrfFetch(`/content/getmore`, {
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
        setItems([...items, ...json.content]);
        setLastKey(json.lastKey);
      }
    }
  }, [items, currentLastKey]);

  const loader = (
    <div className="centered py-3 my-4">
      <Spinner className="position-absolute" />
    </div>
  );

  return (
    <MainLayout loginCallback={loginCallback}>
      <Banner />
      <DynamicFlash />
      <InfiniteScroll dataLength={items.length} next={fetchMoreData} hasMore={currentLastKey !== null} loader={loader}>
        <Row className="mx-0">
          <Col xs={12}>
            <Row>
              <Col xs={6}>
                <h4>Browse Content</h4>
              </Col>
            </Row>
          </Col>
          {items
            .filter((item) => ['a', 'v', 'e'].includes(item.type))
            .map((item) => (
              <Col key={item.id} xs={6} sm={6} lg={4} xxl={3}>
                {item.type === 'a' && <ArticlePreview article={item} />}
                {item.type === 'v' && <VideoPreview video={item} />}
                {item.type === 'e' && <PodcastEpisodePreview episode={item as Episode} />}
              </Col>
            ))}
        </Row>
      </InfiniteScroll>
    </MainLayout>
  );
};

export default RenderToRoot(BrowseContentPage);
