import React, { useState } from 'react';

import RenderToRoot from 'components/RenderToRoot';
import Cube from 'datatypes/Cube';
import MainLayout from 'layouts/MainLayout';
import IndefinitePaginatedList from 'components/IndefinitePaginatedList';
import CubePreview from 'components/cube/CubePreview';

interface SearchPageProps {
  items: Cube[];
  loginCallback?: string;
  lastKey?: string;
  parsedQuery?: string[];
  query?: string;
}

const SearchPage: React.FC<SearchPageProps> = ({ items, loginCallback, lastKey }) => {
  const [feedItems, setFeedItems] = useState(items);
  const [currentLastKey, setCurrentLastKey] = useState(lastKey);

  return (
    <MainLayout loginCallback={loginCallback}>
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
