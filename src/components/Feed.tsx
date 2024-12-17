import BlogPost from 'components/blog/BlogPost';
import BlogPostType from 'datatypes/BlogPost';
import React, { useState } from 'react';
import IndefinitePaginatedList from './IndefinitePaginatedList';

interface FeedProps {
  items: BlogPostType[];
  lastKey?: string;
}

const Feed: React.FC<FeedProps> = ({ items, lastKey = null }) => {
  const [feedItems, setFeedItems] = useState(items);
  const [currentLastKey, setCurrentLastKey] = useState(lastKey);

  return (
    <IndefinitePaginatedList
      items={feedItems}
      setItems={setFeedItems}
      lastKey={currentLastKey}
      setLastKey={setCurrentLastKey}
      pageSize={24}
      header="Feed"
      fetchMoreRoute={`/getmorefeeditems`}
      renderItem={(item) => <BlogPost key={item.id} post={item} />}
      noneMessage="No feed items found, go follow some cubes!"
      xs={12}
    />
  );
};

export default Feed;
