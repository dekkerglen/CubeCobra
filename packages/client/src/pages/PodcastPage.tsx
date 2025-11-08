import React from 'react';

import Banner from 'components/Banner';
import { Card } from 'components/base/Card';
import Podcast from 'components/content/Podcast';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import Episode from '@utils/datatypes/Episode';
import PodcastType from '@utils/datatypes/Podcast';
import MainLayout from 'layouts/MainLayout';

interface PodcastPageProps {
  podcast: PodcastType;
  episodes: Episode[];
}

const PodcastPage: React.FC<PodcastPageProps> = ({ podcast, episodes }) => {
  return (
    <MainLayout>
      <Banner />
      <DynamicFlash />
      <Card className="my-3">
        <Podcast podcast={podcast} episodes={episodes} />
      </Card>
    </MainLayout>
  );
};

export default RenderToRoot(PodcastPage);
