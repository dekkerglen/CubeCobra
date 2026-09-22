import React from 'react';

import Cube from '@utils/datatypes/Cube';

import CubeHistory from 'components/cube/CubeHistory';
import RenderToRoot from 'components/RenderToRoot';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';

interface CubeHistoryPageProps {
  cube: Cube;
  changes: Record<string, any>[];
  lastKey?: string;
}

const CubeHistoryPage: React.FC<CubeHistoryPageProps> = ({ cube, changes, lastKey }) => (
  <MainLayout useContainer={false}>
    <CubeLayout cube={cube} activeLink="changelog">
      <CubeHistory changes={changes} lastKey={lastKey} />
    </CubeLayout>
  </MainLayout>
);

export default RenderToRoot(CubeHistoryPage);
