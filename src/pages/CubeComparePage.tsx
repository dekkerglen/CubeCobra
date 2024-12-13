import React, { useState } from 'react';

import CompareView from 'components/CompareView';
import CubeCompareNavbar from 'components/cube/CubeCompareNavbar';
import DynamicFlash from 'components/DynamicFlash';
import ErrorBoundary from 'components/ErrorBoundary';
import RenderToRoot from 'components/RenderToRoot';
import { CubeContextProvider } from 'contexts/CubeContext';
import { DisplayContextProvider } from 'contexts/DisplayContext';
import Card from 'datatypes/Card';
import Cube from 'datatypes/Cube';
import MainLayout from 'layouts/MainLayout';
import Query from 'utils/Query';

interface CubeComparePageProps {
  cards: Card[];
  cube: Cube;
  cubeB: Cube;
  loginCallback?: string;
  onlyA: string[];
  onlyB: string[];
  both: string[];
}

const CubeComparePage: React.FC<CubeComparePageProps> = ({
  cards,
  cube,
  cubeB,
  loginCallback = '/',
  onlyA,
  onlyB,
  both,
}) => {
  const [openCollapse, setOpenCollapse] = useState<string | null>(Query.get('f') ? 'filter' : null);
  const [filter, setFilter] = useState<((card: Card) => boolean) | null>(null);

  const filteredCards = filter ? cards.filter(filter) : cards;

  return (
    <MainLayout loginCallback={loginCallback}>
      <DisplayContextProvider cubeID={cube.id}>
        <CubeContextProvider initialCube={cube} cards={{ mainboard: cards, maybeboard: [] }}>
          <CubeCompareNavbar
            cubeA={cube}
            cubeAID={cube.id}
            cubeB={cubeB}
            cubeBID={cubeB.id}
            cards={filteredCards}
            openCollapse={openCollapse}
            setOpenCollapse={setOpenCollapse}
            filter={filter}
            setFilter={setFilter}
          />
          <DynamicFlash />
          <ErrorBoundary>
            <CompareView cards={filteredCards} onlyA={onlyA} onlyB={onlyB} both={both} />
          </ErrorBoundary>
        </CubeContextProvider>
      </DisplayContextProvider>
    </MainLayout>
  );
};

export default RenderToRoot(CubeComparePage);
