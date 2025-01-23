import React, { useCallback, useContext, useState } from 'react';

import Banner from 'components/Banner';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Pagination from 'components/base/Pagination';
import Text from 'components/base/Text';
import PodcastEpisodePreview from 'components/content/PodcastEpisodePreview';
import PodcastPreview from 'components/content/PodcastPreview';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import { CSRFContext } from 'contexts/CSRFContext';
import Episode from 'datatypes/Episode';
import Podcast from 'datatypes/Podcast';
import MainLayout from 'layouts/MainLayout';

interface PodcastsPageProps {
  loginCallback?: string;
  episodes: Episode[];
  podcasts: Podcast[];
  lastKey?: string;
}

const PAGE_SIZE = 24;

//Foo
const PodcastsPage: React.FC<PodcastsPageProps> = ({ loginCallback = '/', episodes, podcasts, lastKey }) => {
  const [items, setItems] = useState(episodes);
  const { csrfFetch } = useContext(CSRFContext);
  const [currentLastKey, setLastKey] = useState(lastKey);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = React.useState(0);

  const pageCount = Math.ceil(items.length / PAGE_SIZE);
  const hasMore = !!currentLastKey;

  const fetchMoreData = useCallback(async () => {
    setLoading(true);

    const response = await csrfFetch(`/content/getmorepodcasts`, {
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
        setItems([...items, ...json.episodes]);
        setPage(page + 1);
        setLastKey(json.lastKey);
      }
    }
    setLoading(false);
  }, [items, currentLastKey, page]);

  const pager = (
    <Pagination
      count={pageCount}
      active={page}
      hasMore={hasMore}
      onClick={async (newPage) => {
        console.log(newPage, pageCount);
        if (newPage >= pageCount) {
          await fetchMoreData();
        } else {
          setPage(newPage);
        }
      }}
      loading={loading}
    />
  );

  return (
    <MainLayout loginCallback={loginCallback}>
      <Banner />
      <DynamicFlash />
      <Card className="my-3">
        <CardHeader>
          <Text md semibold>
            Podcasts
          </Text>
        </CardHeader>
        <CardBody>
          <Row>
            {podcasts.map((podcast) => (
              <Col key={podcast.id} xs={12} sm={6} lg={3}>
                <PodcastPreview podcast={podcast} />
              </Col>
            ))}
          </Row>
        </CardBody>
      </Card>
      <Card className="my-3">
        <CardHeader>
          <Flexbox direction="row" justify="between" alignItems="center" className="w-full">
            <Text lg semibold>
              Blog Posts ({items.length}
              {hasMore ? '+' : ''})
            </Text>
            {pager}
          </Flexbox>
        </CardHeader>
        <CardBody>
          <Row>
            {items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((episode) => (
              <Col key={episode.id} className="mb-3" xs={6} sm={4} lg={3}>
                <PodcastEpisodePreview episode={episode} />
              </Col>
            ))}
          </Row>
          <Flexbox direction="row" justify="end" alignItems="center" className="w-full">
            {pager}
          </Flexbox>
        </CardBody>
      </Card>
    </MainLayout>
  );
};

export default RenderToRoot(PodcastsPage);
