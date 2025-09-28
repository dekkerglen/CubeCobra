import React, { useState } from 'react';

import Banner from 'components/Banner';
import { Flexbox } from 'components/base/Layout';
import ArticlePreview from 'components/content/ArticlePreview';
import PodcastEpisodePreview from 'components/content/PodcastEpisodePreview';
import VideoPreview from 'components/content/VideoPreview';
import DynamicFlash from 'components/DynamicFlash';
import IndefinitePaginatedList from 'components/IndefinitePaginatedList';
import RenderToRoot from 'components/RenderToRoot';
import Article from 'datatypes/Article';
import Content, { ContentType } from 'datatypes/Content';
import Episode from 'datatypes/Episode';
import Video from 'datatypes/Video';
import MainLayout from 'layouts/MainLayout';

interface BrowseContentPageProps {
  content: Content[];
  lastKey: any; // Define a more specific type if possible
}

const BrowseContentPage: React.FC<BrowseContentPageProps> = ({ content, lastKey }) => {
  const [items, setItems] = useState<Content[]>(content);
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
          header="Browse Content"
          fetchMoreRoute={`/content/getmore`}
          renderItem={(item) => (
            <>
              {item.type === ContentType.ARTICLE && <ArticlePreview article={item as Article} />}
              {item.type === ContentType.VIDEO && <VideoPreview video={item as Video} />}
              {item.type === ContentType.EPISODE && <PodcastEpisodePreview episode={item as Episode} />}
            </>
          )}
          noneMessage="No content found."
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

export default RenderToRoot(BrowseContentPage);
