import React from 'react';

import Cube from '@utils/datatypes/Cube';

import DynamicFlash from 'components/DynamicFlash';
import HeroSearch from 'components/HeroSearch';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';

interface LandingPageProps {
  featured: Cube[];
}

const LandingPage: React.FC<LandingPageProps> = ({ featured }) => {
  return (
    <MainLayout useContainer={false} transparentNav>
      {/* Surfaces flash messages from redirects that land here (e.g. failed cube-create
          bot checks), which would otherwise be set in session but never displayed. */}
      <DynamicFlash />
      <HeroSearch featured={featured} showExploreMore={false} />
    </MainLayout>
  );
};

export default RenderToRoot(LandingPage);
