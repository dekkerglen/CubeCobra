import React from 'react';

import CreatorArticles from 'components/CreatorArticles';
import CreatorPodcasts from 'components/CreatorPodcasts';
import CreatorVideos from 'components/CreatorVideos';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import useQueryParam from 'hooks/useQueryParam';
import MainLayout from 'layouts/MainLayout';
import { TabContent, Tabs } from 'components/base/Tabs';
import Text from 'components/base/Text';
import Controls from 'components/base/Controls';
import Banner from 'components/Banner';
import { Flexbox } from 'components/base/Layout';

interface ContentItems {
  items: any[];
  lastKey: any;
}

interface CreatorsPageProps {
  loginCallback?: string;
  articles: ContentItems;
  videos: ContentItems;
  podcasts: ContentItems;
}

const CreatorsPage: React.FC<CreatorsPageProps> = ({ loginCallback = '/', articles, videos, podcasts }) => {
  const [tab, setTab] = useQueryParam('tab', '0');

  return (
    <MainLayout loginCallback={loginCallback}>
      <Controls>
        <Flexbox direction="col" gap="2" className="mx-2">
          <Banner />
          <Text semibold xl>
            Content Creator Dashboard
          </Text>
          <DynamicFlash />
          <Tabs
            tabs={[
              {
                label: 'Articles',
                onClick: () => setTab('0'),
              },
              {
                label: 'Podcasts',
                onClick: () => setTab('1'),
              },
              {
                label: 'Videos',
                onClick: () => setTab('2'),
              },
            ]}
            activeTab={parseInt(tab || '0', 10)}
          />
        </Flexbox>
      </Controls>
      <TabContent
        activeTab={parseInt(tab || '0', 10)}
        contents={[
          <CreatorArticles articles={articles.items} lastKey={articles.lastKey} />,
          <CreatorPodcasts podcasts={podcasts.items} lastKey={podcasts.lastKey} />,
          <CreatorVideos videos={videos.items} lastKey={videos.lastKey} />,
        ]}
        className="mt-2"
      />
    </MainLayout>
  );
};

export default RenderToRoot(CreatorsPage);
