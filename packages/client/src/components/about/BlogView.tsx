import React, { useContext, useEffect, useState } from 'react';

import PostType from '@utils/datatypes/BlogPost';

import { Flexbox } from 'components/base/Layout';
import Spinner from 'components/base/Spinner';
import Text from 'components/base/Text';
import BlogPost from 'components/blog/BlogPost';
import BlogNavbar from 'components/cube/BlogNavbar';
import IndefinitePaginatedList from 'components/IndefinitePaginatedList';
import { CSRFContext } from 'contexts/CSRFContext';

interface BlogViewProps {
  cubeId: string;
  posts?: PostType[];
  lastKey: any;
}

const PAGE_SIZE = 20;

const BlogView: React.FC<BlogViewProps> = ({ cubeId, posts, lastKey }) => {
  const { csrfFetch } = useContext(CSRFContext);
  const [items, setItems] = useState(posts);
  const [currentLastKey, setLastKey] = useState(lastKey);
  const [initialLoading, setInitialLoading] = useState(posts === undefined);

  useEffect(() => {
    const fetchInitialData = async () => {
      if (items === undefined) {
        setInitialLoading(true);
        const response = await csrfFetch(`/cube/blog/getmoreblogsbycube/${cubeId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ lastKey: null }),
        });

        if (response.ok) {
          const json = await response.json();
          if (json.success === 'true') {
            setItems(json.items);
            setLastKey(json.lastKey);
          }
        }
        setInitialLoading(false);
      }
    };

    fetchInitialData();
  }, [items, cubeId, csrfFetch]);

  return (
    <Flexbox direction="col" gap="2" className="mb-2">
      <BlogNavbar />
      {initialLoading ? (
        <Flexbox direction="col" alignItems="center" justify="center" className="py-8">
          <Spinner lg />
          <Text lg className="mt-4">
            Loading blog posts...
          </Text>
        </Flexbox>
      ) : (
        <IndefinitePaginatedList
          items={items}
          setItems={setItems}
          lastKey={currentLastKey}
          setLastKey={setLastKey}
          pageSize={PAGE_SIZE}
          header="Blog Posts"
          fetchMoreRoute={`/cube/blog/getmoreblogsbycube/${cubeId}`}
          renderItem={(item) => <BlogPost key={item.id} post={item} />}
          noneMessage="No blog posts for this cube."
          xs={12}
        />
      )}
    </Flexbox>
  );
};

export default BlogView;
