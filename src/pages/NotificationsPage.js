import React, { useCallback, useState } from 'react';
import { Card, CardBody, CardHeader, Spinner } from 'reactstrap';

import PropTypes from 'prop-types';
import InfiniteScroll from 'react-infinite-scroll-component';

import Banner from 'components/Banner';
import DynamicFlash from 'components/DynamicFlash';
import Notification from 'components/nav/Notification';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';
import { csrfFetch } from 'utils/CSRF';
import { wait } from 'utils/Util';

const Notifications = ({ notifications, lastKey, loginCallback }) => {
  const [items, setItems] = useState(notifications);
  const [currentLastKey, setLastKey] = useState(lastKey);

  const fetchMoreData = useCallback(async () => {
    // intentionally wait to avoid too many DB queries
    await wait(2000);

    const response = await csrfFetch(`/user/getmorenotifications`, {
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
        setItems([...items, ...json.notifications]);
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
      <Card className="mx-auto">
        <CardHeader>
          <h5>Notifications</h5>
        </CardHeader>
        <InfiniteScroll
          dataLength={items.length}
          next={fetchMoreData}
          hasMore={currentLastKey !== null}
          loader={loader}
        >
          <CardBody className="p-0">
            {items.length > 0 ? (
              items.map((notification) => <Notification key={notification.id} notification={notification} />)
            ) : (
              <p className="m-2">
                You don't have any notifications! Why don't you try sharing your cube on the{' '}
                <a href="https://discord.gg/Hn39bCU">Cube Cobra Discord?</a>
              </p>
            )}
          </CardBody>
        </InfiniteScroll>
      </Card>
    </MainLayout>
  );
};

Notifications.propTypes = {
  notifications: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  lastKey: PropTypes.shape({}),
  loginCallback: PropTypes.string,
};

Notifications.defaultProps = {
  loginCallback: '/',
  lastKey: null,
};

export default RenderToRoot(Notifications);
