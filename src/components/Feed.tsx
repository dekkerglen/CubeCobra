import React, { useCallback, useContext, useState } from 'react';
import BlogPost from 'components/blog/BlogPost';
import UserContext from 'contexts/UserContext';
import { csrfFetch } from 'utils/CSRF';
import Spinner from 'components/base/Spinner';
import BlogPostType from 'datatypes/BlogPost';
import { Flexbox } from 'components/base/Layout';
import Button from 'components/base/Button';

interface FeedProps {
  items: BlogPostType[];
  lastKey?: string;
}

const Feed: React.FC<FeedProps> = ({ items, lastKey = null }) => {
  const user = useContext(UserContext);
  const [feedItems, setFeedItems] = useState(items);
  const [loading, setLoading] = useState(false);
  const [currentLastKey, setCurrentLastKey] = useState(lastKey);

  const fetchMoreData = useCallback(async () => {
    setLoading(true);

    const response = await csrfFetch(`/getmorefeeditems`, {
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
        setFeedItems([...feedItems, ...json.items]);
        setCurrentLastKey(json.lastKey);
      }
    }
    setLoading(false);
  }, [currentLastKey, feedItems, user]);

  const loader = (
    <div className="centered py-3 my-4">
      <Spinner className="position-absolute" />
    </div>
  );

  return (
    <Flexbox direction="col" className="w-full" gap="2">
      {feedItems.map((item) => (
        <BlogPost key={item.id} post={item} />
      ))}
      {loading && loader}
      {!loading && currentLastKey && (
        <Button onClick={fetchMoreData} className="w-full">
          Load More
        </Button>
      )}
    </Flexbox>
  );
};

export default Feed;
