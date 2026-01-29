import React, { useState } from 'react';

import PostType from '@utils/datatypes/BlogPost';
import Cube from '@utils/datatypes/Cube';

import { Flexbox } from 'components/base/Layout';
import BlogPost from 'components/blog/BlogPost';
import BlogNavbar from 'components/cube/BlogNavbar';
import DynamicFlash from 'components/DynamicFlash';
import IndefinitePaginatedList from 'components/IndefinitePaginatedList';
import RenderToRoot from 'components/RenderToRoot';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';

interface CubeBlogPageProps {
  cube: Cube;
  lastKey: any;
  posts: PostType[];
}

const PAGE_SIZE = 20;

const CubeBlogPage: React.FC<CubeBlogPageProps> = ({ cube, lastKey, posts }) => {
  const [items, setItems] = useState(posts);
  const [currentLastKey, setLastKey] = useState(lastKey);

  return (
    <MainLayout useContainer={false}>
      <CubeLayout cube={cube} activeLink="blog">
        <Flexbox direction="col" gap="2" className="my-2">
          <DynamicFlash />
          <BlogNavbar />
          <IndefinitePaginatedList
            items={items}
            setItems={setItems}
            lastKey={currentLastKey}
            setLastKey={setLastKey}
            pageSize={PAGE_SIZE}
            header="Blog Posts"
            fetchMoreRoute={`/cube/blog/getmoreblogsbycube/${cube.id}`}
            renderItem={(item) => <BlogPost key={item.id} post={item} />}
            noneMessage="No blog posts for this cube."
            xs={12}
          />
        </Flexbox>
      </CubeLayout>
    </MainLayout>
  );
};

export default RenderToRoot(CubeBlogPage);
