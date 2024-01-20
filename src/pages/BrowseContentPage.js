import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';

import { Row, Col, Spinner } from 'reactstrap';

import InfiniteScroll from 'react-infinite-scroll-component';
import DynamicFlash from 'components/DynamicFlash';
import ArticlePreview from 'components/ArticlePreview';
import VideoPreview from 'components/VideoPreview';
import Banner from 'components/Banner';
import PodcastEpisodePreview from 'components/PodcastEpisodePreview';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';
import { csrfFetch } from 'utils/CSRF';
import { wait } from 'utils/Util';

function BrowseContentPage({ loginCallback, content, lastKey }) {
  const [items, setItems] = useState(content);
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
      <InfiniteScroll dataLength={items.length} next={fetchMoreData} hasMore={currentLastKey != null} loader={loader}>
        <Row className="mx-0">
          <Col xs="12">
            <Row>
              <Col xs="6">
                <h4>Browse Content</h4>
              </Col>
            </Row>
          </Col>
          {items.map((item) => (
            <Col className="mb-3" xs="6" md="4">
              {item.type === 'a' && <ArticlePreview article={item} />}
              {item.type === 'v' && <VideoPreview video={item} />}
              {item.type === 'e' && <PodcastEpisodePreview episode={item} />}
            </Col>
          ))}
        </Row>
      </InfiniteScroll>
    </MainLayout>
  );
}

BrowseContentPage.propTypes = {
  loginCallback: PropTypes.string,
  content: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  lastKey: PropTypes.shape({}),
};

BrowseContentPage.defaultProps = {
  loginCallback: '/',
  lastKey: null,
};

export default RenderToRoot(BrowseContentPage);
