import React, { useState } from 'react';

import PostType from '@utils/datatypes/BlogPost';

import { Flexbox } from 'components/base/Layout';
import BlogPost from 'components/blog/BlogPost';
import BlogNavbar from 'components/cube/BlogNavbar';
import IndefinitePaginatedList from 'components/IndefinitePaginatedList';

interface BlogViewProps {
  cubeId: string;
  posts: PostType[];
  lastKey: any;
}

const PAGE_SIZE = 20;

const BlogView: React.FC<BlogViewProps> = ({ cubeId, posts, lastKey }) => {
  const [items, setItems] = useState(posts);
  const [currentLastKey, setLastKey] = useState(lastKey);

  return (
    <Flexbox direction="col" gap="2" className="mb-2">
      <BlogNavbar />
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
    </Flexbox>
  );
};

export default BlogView;
