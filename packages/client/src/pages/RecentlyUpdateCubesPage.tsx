import React, { useState } from 'react';

import CubePreview from 'components/cube/CubePreview';
import IndefinitePaginatedList from 'components/IndefinitePaginatedList';
import RenderToRoot from 'components/RenderToRoot';
import Cube from '@utils/datatypes/Cube';
import MainLayout from 'layouts/MainLayout';

interface SearchPageProps {
  items: Cube[];
  lastKey?: string;
  parsedQuery?: string[];
  query?: string;
}

const SearchPage: React.FC<SearchPageProps> = ({ items, lastKey }) => {
  const [feedItems, setFeedItems] = useState(items);
  const [currentLastKey, setCurrentLastKey] = useState(lastKey);

  return (
    <MainLayout>
      <div className="my-3">
        <IndefinitePaginatedList
          items={feedItems}
          setItems={setFeedItems}
          lastKey={currentLastKey}
          setLastKey={setCurrentLastKey}
          pageSize={36}
          header="All Recently Updated Cubes"
          fetchMoreRoute={`/cube/getmorerecents`}
          renderItem={(cube) => <CubePreview cube={cube as Cube} />}
          noneMessage="No feed items found, go follow some cubes!"
          xxl={2}
          lg={3}
          md={4}
          xs={6}
          inCard
        />
      </div>
    </MainLayout>
  );
};

export default RenderToRoot(SearchPage);
