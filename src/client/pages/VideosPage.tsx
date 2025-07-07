import React, { useState } from 'react';

import Banner from 'components/Banner';
import { Flexbox } from 'components/base/Layout';
import VideoPreview from 'components/content/VideoPreview';
import DynamicFlash from 'components/DynamicFlash';
import IndefinitePaginatedList from 'components/IndefinitePaginatedList';
import RenderToRoot from 'components/RenderToRoot';
import Video from 'datatypes/Video';
import MainLayout from 'layouts/MainLayout';

interface VideosPageProps {
  videos: Video[];
  lastKey?: string;
}

const VideosPage: React.FC<VideosPageProps> = ({ videos, lastKey }) => {
  const [items, setItems] = useState(videos);
  const [currentLastKey, setLastKey] = useState(lastKey);

  return (
    <MainLayout>
      <Flexbox direction="col" gap="2" className="my-2">
        <Banner />
        <DynamicFlash />
        <IndefinitePaginatedList
          items={items}
          setItems={setItems}
          lastKey={currentLastKey}
          setLastKey={setLastKey}
          pageSize={24}
          header="Videos"
          fetchMoreRoute={`/content/getmorevideos`}
          renderItem={(item) => <VideoPreview video={item} />}
          noneMessage="No videos found."
          xs={6}
          lg={4}
          xl={3}
          xxl={2}
          inCard
        />
      </Flexbox>
    </MainLayout>
  );
};

export default RenderToRoot(VideosPage);
