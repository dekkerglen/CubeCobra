import React, { useCallback, useState } from 'react';
import { Card, CardHeader, Col, Row, Spinner } from 'reactstrap';

import PropTypes from 'prop-types';
import InfiniteScroll from 'react-infinite-scroll-component';

import Banner from 'components/Banner';
import Text from 'components/base/Text';
import PodcastEpisodePreview from 'components/content/PodcastEpisodePreview';
import PodcastPreview from 'components/content/PodcastPreview';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';
import { csrfFetch } from 'utils/CSRF';
import { wait } from 'utils/Util';

const PodcastsPage = ({ loginCallback, episodes, podcasts, lastKey }) => {
  const [items, setItems] = useState(episodes);
  const [currentLastKey, setLastKey] = useState(lastKey);

  const fetchMoreData = useCallback(async () => {
    // intentionally wait to avoid too many DB queries
    await wait(2000);

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
        setLastKey(json.lastKey);
      }
    }
  }, [items, setItems, currentLastKey]);

  const loader = (
    <div className="centered py-3 my-4">
      <Spinner className="position-absolute" />
    </div>
  );

  return (
    <MainLayout loginCallback={loginCallback}>
      <Banner />
      <DynamicFlash />
      <Card className="my-3">
        <CardHeader>
          <Text md semibold>Podcasts</Text>
        </CardHeader>
        <Row>
          {podcasts.map((podcast) => (
            <Col xs={12} sm={6} lg={3}>
              <PodcastPreview podcast={podcast} />
            </Col>
          ))}
        </Row>
      </Card>
      <Text semibold lg>Podcast Episodes</Text>
      <InfiniteScroll dataLength={items.length} next={fetchMoreData} hasMore={currentLastKey !== null} loader={loader}>
        <Row className="mx-0">
          {items.map((episode) => (
            <Col className="mb-3" xs={12} sm={6} lg="4">
              <PodcastEpisodePreview episode={episode} />
            </Col>
          ))}
        </Row>
      </InfiniteScroll>
    </MainLayout>
  );
};

PodcastsPage.propTypes = {
  loginCallback: PropTypes.string,
  episodes: PropTypes.arrayOf({}).isRequired,
  podcasts: PropTypes.arrayOf({}).isRequired,
  lastKey: PropTypes.shape({}),
};

PodcastsPage.defaultProps = {
  loginCallback: '/',
  lastKey: null,
};

export default RenderToRoot(PodcastsPage);
