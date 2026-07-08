import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';

import { isAdFree } from '@utils/adsUtil';
import BlogPostType from '@utils/datatypes/BlogPost';

import { CSRFContext } from '../contexts/CSRFContext';
import UserContext from '../contexts/UserContext';
import Advertisment from './Advertisment';
import Button from './base/Button';
import { Flexbox } from './base/Layout';
import Link from './base/Link';
import Spinner from './base/Spinner';
import Text from './base/Text';
import BlogPost from './blog/BlogPost';

const AD_INTERVAL = 10;

const Feed: React.FC = () => {
  const { csrfFetch } = useContext(CSRFContext);
  const user = useContext(UserContext);
  const showAds = !isAdFree(user?.roles);

  const [feedItems, setFeedItems] = useState<BlogPostType[] | undefined>(undefined);
  const [currentLastKey, setCurrentLastKey] = useState<any>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const fetchedRef = useRef(false);

  const fetchPage = useCallback(
    async (lastKey: any) => {
      const response = await csrfFetch('/dashboard/getmorefeeditems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastKey }),
      });
      if (!response.ok) {
        return { items: [] as BlogPostType[], lastKey: null };
      }
      const json = await response.json();
      if (json.success !== 'true') {
        return { items: [] as BlogPostType[], lastKey: null };
      }
      return { items: (json.items || []) as BlogPostType[], lastKey: json.lastKey ?? null };
    },
    [csrfFetch],
  );

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    (async () => {
      const { items, lastKey } = await fetchPage(null);
      setFeedItems(items);
      setCurrentLastKey(lastKey);
    })();
  }, [fetchPage]);

  const handleShowMore = useCallback(async () => {
    setLoadingMore(true);
    const { items, lastKey } = await fetchPage(currentLastKey);
    setFeedItems((prev) => [...(prev ?? []), ...items]);
    setCurrentLastKey(lastKey);
    setLoadingMore(false);
  }, [currentLastKey, fetchPage]);

  const header = (
    <Text lg semibold>
      Feed
    </Text>
  );

  if (feedItems === undefined) {
    return (
      <Flexbox direction="col" gap="2">
        {header}
        <Flexbox direction="row" justify="center" alignItems="center" className="w-full py-8">
          <Spinner xl />
        </Flexbox>
      </Flexbox>
    );
  }

  if (feedItems.length === 0) {
    return (
      <Flexbox direction="col" gap="2">
        {header}
        <Text semibold lg>
          No feed items found, go <Link href="/search?order=pop">like some cubes</Link>!
        </Text>
      </Flexbox>
    );
  }

  const hasMore = !!currentLastKey;

  return (
    <Flexbox direction="col" gap="2">
      {header}
      <Flexbox direction="col" gap="2">
        {feedItems.map((item, index) => (
          <React.Fragment key={item.id}>
            <BlogPost post={item} />
            {showAds && (index + 1) % AD_INTERVAL === 0 && index < feedItems.length - 1 && (
              <Advertisment
                placementId={`feed-banner-${Math.floor(index / AD_INTERVAL)}`}
                media="desktop"
                size="banner"
              />
            )}
          </React.Fragment>
        ))}
      </Flexbox>
      {hasMore && (
        <Flexbox direction="row" justify="center" className="w-full pt-2">
          <Button color="primary" onClick={handleShowMore} disabled={loadingMore}>
            {loadingMore ? <Spinner sm /> : 'Show More'}
          </Button>
        </Flexbox>
      )}
    </Flexbox>
  );
};

export default Feed;
