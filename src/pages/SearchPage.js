import React, { useCallback } from 'react';
import { Col, Row, Spinner } from 'reactstrap';

import PropTypes from 'prop-types';
import CubePropType from 'proptypes/CubePropType';
import InfiniteScroll from 'react-infinite-scroll-component';

import CubePreview from 'components/CubePreview';
import CubeSearchNavBar from 'components/CubeSearchNavBar';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';
import { csrfFetch } from 'utils/CSRF';
import { wait } from 'utils/Util';

const SearchPage = ({ cubes, query, order, loginCallback, lastKey, ascending }) => {
  const [items, setItems] = React.useState(cubes);
  const [currentLastKey, setCurrentLastKey] = React.useState(lastKey);

  const fetchMoreData = useCallback(async () => {
    // intentionally wait to avoid too many DB queries
    await wait(2000);

    const response = await csrfFetch(`/getmoresearchitems`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lastKey: currentLastKey,
        query,
        order,
        ascending,
      }),
    });

    if (response.ok) {
      const json = await response.json();
      if (json.success === 'true') {
        setItems([...items, ...json.cubes]);
        setCurrentLastKey(json.lastKey);
      }
    }
  }, [ascending, currentLastKey, items, order, query]);

  const loader = (
    <div className="centered py-3 my-4">
      <Spinner className="position-absolute" />
    </div>
  );

  return (
    <MainLayout loginCallback={loginCallback}>
      <CubeSearchNavBar query={query} order={order} title="Cube Search" ascending={ascending} />
      <br />
      <DynamicFlash />
      {(cubes && cubes.length) > 0 ? (
        <InfiniteScroll
          dataLength={items.length}
          next={fetchMoreData}
          hasMore={currentLastKey}
          loader={loader}
          endMessage="You've reached the end of the search."
        >
          <Row noGutters>
            {items.map((cube) => (
              <Col className="pb-4" xl={3} lg={3} md={4} sm={6} xs={12}>
                <CubePreview cube={cube} />
              </Col>
            ))}
          </Row>
        </InfiniteScroll>
      ) : (
        <h4>No Results</h4>
      )}
    </MainLayout>
  );
};

SearchPage.propTypes = {
  cubes: PropTypes.arrayOf(CubePropType).isRequired,
  query: PropTypes.string,
  order: PropTypes.string,
  loginCallback: PropTypes.string,
  lastKey: PropTypes.shape({}).isRequired,
  ascending: PropTypes.bool,
};

SearchPage.defaultProps = {
  query: '',
  order: 'pop',
  loginCallback: '/',
  ascending: false,
};

export default RenderToRoot(SearchPage);
