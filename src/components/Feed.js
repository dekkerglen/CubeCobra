import React, { useCallback, useContext, useState } from 'react';
import { Spinner } from 'reactstrap';

import PropTypes from 'prop-types';
import BlogPostPropType from 'proptypes/BlogPostPropType';
import InfiniteScroll from 'react-infinite-scroll-component';

import BlogPost from 'components/BlogPost';
import UserContext from 'contexts/UserContext';
import { csrfFetch } from 'utils/CSRF';
import { wait } from 'utils/Util';

const Feed = ({ items, lastKey }) => {
  const user = useContext(UserContext);
  const [feedItems, setFeedItems] = useState(items);
  const [currentLastKey, setCurrentLastKey] = useState(lastKey);

  const fetchMoreData = useCallback(async () => {
    // intentionally wait to avoid too many DB queries
    await wait(2000);

    const response = await csrfFetch(`/getmorefeeditems`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lastKey: currentLastKey,
        user: user.id,
      }),
    });

    if (response.ok) {
      const json = await response.json();
      if (json.success === 'true') {
        setFeedItems([...items, ...json.items]);
        setCurrentLastKey(json.lastKey);
      }
    }
  }, [currentLastKey, items, user.id]);

  const loader = (
    <div className="centered py-3 my-4">
      <Spinner className="position-absolute" />
    </div>
  );

  return (
    <InfiniteScroll
      dataLength={feedItems.length}
      next={fetchMoreData}
      hasMore={currentLastKey}
      loader={loader}
      endMessage="You've reached the end of the feed!"
    >
      {feedItems.map((item) => (
        <BlogPost key={item.document.id} post={item.document} />
      ))}
    </InfiniteScroll>
  );
};

Feed.propTypes = {
  items: PropTypes.arrayOf(BlogPostPropType).isRequired,
  lastKey: PropTypes.string,
};

Feed.defaultProps = {
  lastKey: null,
};

export default Feed;
