import React from 'react';

import VideoType from '@utils/datatypes/Video';

import { Card } from 'components/base/Card';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';

import Video from '../components/content/Video';
interface VideoPageProps {
  video: VideoType;
}

const VideoPage: React.FC<VideoPageProps> = ({ video }) => (
  <MainLayout>
    <DynamicFlash />
    <Card className="my-3">
      <Video video={video} />
    </Card>
  </MainLayout>
);

export default RenderToRoot(VideoPage);
