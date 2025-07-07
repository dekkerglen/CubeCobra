import React, { useContext, useState } from 'react';

import Controls from 'components/base/Controls';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import BlogPost from 'components/blog/BlogPost';
import DynamicFlash from 'components/DynamicFlash';
import IndefinitePaginatedList from 'components/IndefinitePaginatedList';
import CreateBlogModal from 'components/modals/CreateBlogModal';
import RenderToRoot from 'components/RenderToRoot';
import withModal from 'components/WithModal';
import UserContext from 'contexts/UserContext';
import PostType from 'datatypes/BlogPost';
import Cube from 'datatypes/Cube';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';

interface CubeBlogPageProps {
  cube: Cube;
  lastKey: any;
  posts: PostType[];
}

const CreateBlogModalLink = withModal(Link, CreateBlogModal);

const PAGE_SIZE = 20;

const CubeBlogPage: React.FC<CubeBlogPageProps> = ({ cube, lastKey, posts }) => {
  const [items, setItems] = useState(posts);
  const [currentLastKey, setLastKey] = useState(lastKey);
  const user = useContext(UserContext);

  return (
    <MainLayout>
      <CubeLayout cube={cube} activeLink="blog" hasControls={!!user && cube.owner.id === user.id}>
        <Controls>
          <Flexbox direction="row" justify="start" gap="4" alignItems="center" className="py-2 px-4">
            <CreateBlogModalLink color="primary" modalprops={{ cubeID: cube.id, post: null }}>
              Create new blog post
            </CreateBlogModalLink>
          </Flexbox>
        </Controls>
        <Flexbox direction="col" gap="2" className="my-2">
          <DynamicFlash />
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
