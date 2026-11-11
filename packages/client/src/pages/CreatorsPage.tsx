import React from 'react';

import { Flexbox } from 'components/base/Layout';
import { TabContent, Tabs } from 'components/base/Tabs';
import Text from 'components/base/Text';
import CreatorArticles from 'components/content/CreatorArticles';
import CreatorPodcasts from 'components/content/CreatorPodcasts';
import CreatorVideos from 'components/content/CreatorVideos';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import useQueryParam from 'hooks/useQueryParam';
import MainLayout from 'layouts/MainLayout';

interface ContentItems {
  items: any[];
  lastKey: any;
}

interface CreatorsPageProps {
  articles: ContentItems;
  videos: ContentItems;
  podcasts: ContentItems;
}

const TABS = ['Articles', 'Podcasts', 'Videos'];

const CreatorsPage: React.FC<CreatorsPageProps> = ({ articles, videos, podcasts }) => {
  const [tab, setTab] = useQueryParam('tab', '0');
  const activeTab = parseInt(tab || '0', 10);

  return (
    <MainLayout>
      <Flexbox direction="col" gap="2" className="my-3">
        <DynamicFlash />
        <Text xl semibold>
          Content Creator Dashboard
        </Text>
        <Tabs
          className="border-b border-border"
          tabs={TABS.map((label, index) => ({ label, onClick: () => setTab(`${index}`) }))}
          activeTab={activeTab}
        />
        <TabContent
          activeTab={activeTab}
          contents={[
            <CreatorArticles articles={articles.items} lastKey={articles.lastKey} key="articles" />,
            <CreatorPodcasts podcasts={podcasts.items} lastKey={podcasts.lastKey} key="podcasts" />,
            <CreatorVideos videos={videos.items} lastKey={videos.lastKey} key="videos" />,
          ]}
          className="mt-1"
        />
      </Flexbox>
    </MainLayout>
  );
};

export default RenderToRoot(CreatorsPage);
