import React, { useCallback, useContext, useState } from 'react';

import Episode from '@utils/datatypes/Episode';
import Podcast from '@utils/datatypes/Podcast';

import Banner from 'components/Banner';
import { Card, CardBody, CardHeader } from 'components/base/Card';
import CursorPagination from 'components/base/CursorPagination';
import { Col, Flexbox, Row } from 'components/base/Layout';
import Text from 'components/base/Text';
import PodcastEpisodePreview from 'components/content/PodcastEpisodePreview';
import PodcastPreview from 'components/content/PodcastPreview';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import { CSRFContext } from 'contexts/CSRFContext';
import MainLayout from 'layouts/MainLayout';
import {
  fetchIndefiniteMoreData,
  getIndefinitePageCount,
  handleIndefinitePageSelection,
  hasIndefiniteMore,
} from 'utils/indefinitePagination';

interface PodcastsPageProps {
  episodes: Episode[];
  podcasts: Podcast[];
  lastKey?: string;
}

const PAGE_SIZE = 24;

const PodcastsPage: React.FC<PodcastsPageProps> = ({ episodes, podcasts, lastKey }) => {
  const [items, setItems] = useState(episodes);
  const { callApi } = useContext(CSRFContext);
  const [currentLastKey, setLastKey] = useState(lastKey);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = React.useState(0);

  const pageCount = getIndefinitePageCount(items, PAGE_SIZE);
  const hasMore = hasIndefiniteMore(currentLastKey);

  const fetchMoreData = useCallback(
    async (targetPage: number) => {
      await fetchIndefiniteMoreData<Episode>({
        callApi,
        fetchMoreRoute: '/content/getmorepodcasts',
        items,
        setItems,
        lastKey: currentLastKey,
        setLastKey,
        setPage,
        pageSize: PAGE_SIZE,
        itemsKey: 'episodes',
        setLoading,
        targetPage,
      });
    },
    [callApi, currentLastKey, items],
  );

  const pager = (
    <CursorPagination
      active={page}
      loadedPages={pageCount}
      hasMore={hasMore}
      onPageChange={async (newPage) => {
        await handleIndefinitePageSelection({
          newPage,
          pageCount,
          setPage,
          fetchMoreData,
        });
      }}
      loading={loading}
    />
  );

  return (
    <MainLayout>
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
              Blog Posts
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
