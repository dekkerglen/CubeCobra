import React, { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { csrfFetch } from 'utils/CSRF';
import { wait } from 'utils/Util';
import InfiniteScroll from 'react-infinite-scroll-component';
import { Spinner, Card, CardBody, Row, Col, CardHeader } from 'reactstrap';
import BlogPostChangelog from 'components/BlogPostChangelog';

const loader = (
  <div className="centered py-3 my-4">
    <Spinner className="position-absolute" />
  </div>
);

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const addOrdinal = (num) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = num % 100;
  return num + (s[(v - 20) % 10] || s[v] || s[0]);
};

const formatDate = (date) => {
  const month = date.getMonth();
  const day = date.getDate();
  const year = date.getFullYear();

  return `${monthNames[month]} ${addOrdinal(day)}, ${year}`;
};

const CubeHistory = ({ changes, lastKey }) => {
  const [items, setItems] = useState(changes);
  const [currentLastKey, setLastKey] = useState(lastKey);

  const evens = useMemo(() => {
    return items.filter((item, index) => index % 2 === 0);
  }, [items]);

  const odds = useMemo(() => {
    return items.filter((item, index) => index % 2 !== 0);
  }, [items]);

  const fetchMoreData = useCallback(async () => {
    // intentionally wait to avoid too many DB queries
    await wait(2000);

    const response = await csrfFetch(`/cube/getmorechangelogs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cubeId: items[0].cubeId,
        lastKey: currentLastKey,
      }),
    });

    if (response.ok) {
      const json = await response.json();
      console.log(json);
      if (json.success === 'true') {
        setItems([...items, ...json.posts]);
        setLastKey(json.lastKey);
      }
    }
  }, [currentLastKey, items]);

  return (
    <InfiniteScroll dataLength={items.length} next={fetchMoreData} hasMore={currentLastKey != null} loader={loader}>
      <div className="d-block d-sm-none">
        {items.length > 0 ? (
          items.map((changelog) => (
            <Card className="my-2">
              <div style={{ overflow: 'auto', maxHeight: '20vh' }}>
                <CardBody>
                  <BlogPostChangelog changelog={changelog.changelog} />
                </CardBody>
              </div>
            </Card>
          ))
        ) : (
          <p>This cube has no history!</p>
        )}
      </div>
      <div className="d-none d-sm-block">
        <Row className="g-0 m-0 p-0">
          <Col xs={6} className="pe-4 border-end border-4">
            {items.length > 0 ? (
              evens.map((changelog) => (
                <Card className="my-2 rightArrowBox">
                  <CardHeader className="text-end">
                    <h6>
                      <h6>{formatDate(new Date(changelog.date))}</h6>
                    </h6>
                  </CardHeader>
                  <div style={{ overflow: 'auto', height: '15vh' }}>
                    <CardBody>
                      <BlogPostChangelog changelog={changelog.changelog} />
                    </CardBody>
                  </div>
                </Card>
              ))
            ) : (
              <p>This cube has no history!</p>
            )}
          </Col>
          <Col xs={6} className="ps-4">
            <div style={{ height: '8vh' }} />
            {odds.map((changelog) => (
              <Card className="my-2 leftArrowBox">
                <CardHeader>
                  <h6>{formatDate(new Date(changelog.date))}</h6>
                </CardHeader>
                <div style={{ overflow: 'auto', height: '15vh' }}>
                  <CardBody>
                    <BlogPostChangelog changelog={changelog.changelog} />
                  </CardBody>
                </div>
              </Card>
            ))}
          </Col>
        </Row>
      </div>
    </InfiniteScroll>
  );
};

CubeHistory.propTypes = {
  changes: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  lastKey: PropTypes.string,
};

CubeHistory.defaultProps = {
  lastKey: null,
};

export default CubeHistory;
