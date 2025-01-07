import React from 'react';
import { Card } from 'components/base/Card';
import Banner from 'components/Banner';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';
import Podcast from 'components/content/Podcast';
import Episode from 'datatypes/Episode';
import PodcastType from 'datatypes/Podcast';

interface PodcastPageProps {
  loginCallback?: string;
  podcast: PodcastType;
  episodes: Episode[];
}

const PodcastPage: React.FC<PodcastPageProps> = ({ loginCallback = '/', podcast, episodes }) => {
  return (
    <MainLayout loginCallback={loginCallback}>
      <Banner />
      <DynamicFlash />
      <Card className="my-3">
        <Podcast podcast={podcast} episodes={episodes} />
      </Card>
    </MainLayout>
  );
};

export default RenderToRoot(PodcastPage);
