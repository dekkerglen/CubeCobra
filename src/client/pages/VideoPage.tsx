import React from 'react';

import { Card } from 'components/base/Card';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';

import VideoType from '../../datatypes/Video';
import Video from '../components/content/Video';
interface VideoPageProps {
  loginCallback?: string;
  video: VideoType;
}

const VideoPage: React.FC<VideoPageProps> = ({ loginCallback = '/', video }) => (
  <MainLayout loginCallback={loginCallback}>
    <DynamicFlash />
    <Card className="my-3">
      <Video video={video} />
    </Card>
  </MainLayout>
);

export default RenderToRoot(VideoPage);
