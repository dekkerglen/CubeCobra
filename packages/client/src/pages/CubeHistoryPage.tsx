import React from 'react';

import CubeHistory from 'components/cube/CubeHistory';
import RenderToRoot from 'components/RenderToRoot';
import { DisplayContextProvider } from 'contexts/DisplayContext';
import Cube from '@utils/datatypes/Cube';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';

interface CubeHistoryPageProps {
  cube: Cube;
  changes: Record<string, any>[];
  lastKey?: string;
}

const CubeHistoryPage: React.FC<CubeHistoryPageProps> = ({ cube, changes, lastKey }) => (
  <MainLayout>
    <DisplayContextProvider cubeID={cube.id}>
      <CubeLayout cube={cube} activeLink="history">
        <CubeHistory changes={changes} lastKey={lastKey} />
      </CubeLayout>
    </DisplayContextProvider>
  </MainLayout>
);

export default RenderToRoot(CubeHistoryPage);
