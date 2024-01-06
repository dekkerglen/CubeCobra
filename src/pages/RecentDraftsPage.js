import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import DeckPropType from 'proptypes/DeckPropType';

import InfiniteScroll from 'react-infinite-scroll-component';
import DeckPreview from 'components/DeckPreview';
import DynamicFlash from 'components/DynamicFlash';
import Banner from 'components/Banner';
import MainLayout from 'layouts/MainLayout';
import RenderToRoot from 'utils/RenderToRoot';
import { csrfFetch } from 'utils/CSRF';
import { wait } from 'utils/Util';

import { Card, Col, Row, Spinner, CardBody, CardHeader } from 'reactstrap';

function RecentDraftsPage({ decks, lastKey, loginCallback }) {
  const [items, setItems] = useState(decks);
  const [currentLastKey, setLastKey] = useState(lastKey);

  const fetchMoreData = useCallback(async () => {
    // intentionally wait to avoid too many DB queries
    await wait(2000);

    const response = await csrfFetch(`/getmoredecks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lastKey: currentLastKey,
        type: 'a',
      }),
    });

    if (response.ok) {
      const json = await response.json();
      if (json.success === 'true') {
        setItems([...items, ...json.items]);
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
      <Row className="my-3">
        <Col xs="12">
          <Card>
            <CardHeader>
              <h5>Recent drafts of your cubes</h5>
            </CardHeader>
            <CardBody className="p-0">
              {items.length > 0 ? (
                <InfiniteScroll
                  dataLength={items.length}
                  next={fetchMoreData}
                  hasMore={currentLastKey != null}
                  loader={loader}
                >
                  {items.map((deck) => (
                    <DeckPreview key={deck.id} deck={deck} nextURL="/dashboard" canEdit />
                  ))}
                </InfiniteScroll>
              ) : (
                <p className="m-2">
                  Nobody has drafted your cubes! Perhaps try reaching out on the{' '}
                  <a href="https://discord.gg/Hn39bCU">Discord draft exchange?</a>
                </p>
              )}
            </CardBody>
          </Card>
        </Col>
      </Row>
    </MainLayout>
  );
}

RecentDraftsPage.propTypes = {
  decks: PropTypes.arrayOf(DeckPropType).isRequired,
  lastKey: PropTypes.string.isRequired,
  loginCallback: PropTypes.string,
};

RecentDraftsPage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(RecentDraftsPage);
