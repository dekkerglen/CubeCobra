import React, { useContext, useState } from 'react';

import Query from 'utils/Query';

import Card from '@utils/datatypes/Card';
import Cube from '@utils/datatypes/Cube';
import CompareView from '../components/CompareView';
import CubeCompareNavbar from '../components/cube/CubeCompareNavbar';
import DynamicFlash from '../components/DynamicFlash';
import ErrorBoundary from '../components/ErrorBoundary';
import RenderToRoot from '../components/RenderToRoot';
import { ChangesContextProvider } from '../contexts/ChangesContext';
import { CubeContextProvider } from '../contexts/CubeContext';
import { DisplayContextProvider } from '../contexts/DisplayContext';
import FilterContext, { FilterContextProvider } from '../contexts/FilterContext';
import MainLayout from '../layouts/MainLayout';

interface CubeComparePageProps {
  cards: Card[];
  cube: Cube;
  cubeB: Cube;
  onlyA: string[];
  onlyB: string[];
  both: string[];
}

const CubeComparePageInner: React.FC<CubeComparePageProps> = ({ cards, cube, cubeB, onlyA, onlyB, both }) => {
  const [openCollapse, setOpenCollapse] = useState<string | null>(Query.get('f') ? 'filter' : null);
  const { cardFilter } = useContext(FilterContext);

  const filteredCards = cardFilter ? cards.filter(cardFilter.filter) : cards;

  return (
    <>
      <CubeCompareNavbar
        cubeA={cube}
        cubeAID={cube.id}
        cubeB={cubeB}
        cubeBID={cubeB.id}
        openCollapse={openCollapse}
        setOpenCollapse={setOpenCollapse}
      />
      <DynamicFlash />
      <ErrorBoundary>
        <CompareView cards={filteredCards} onlyA={onlyA} onlyB={onlyB} both={both} />
      </ErrorBoundary>
    </>
  );
};

const CubeComparePage: React.FC<CubeComparePageProps> = ({ cards, cube, cubeB, onlyA, onlyB, both }) => {
  return (
    <FilterContextProvider>
      <MainLayout>
        <DisplayContextProvider cubeID={cube.id}>
          <ChangesContextProvider cube={cube}>
            <CubeContextProvider initialCube={cube} cards={{ mainboard: cards, maybeboard: [] }}>
              <CubeComparePageInner cards={cards} cube={cube} cubeB={cubeB} onlyA={onlyA} onlyB={onlyB} both={both} />
            </CubeContextProvider>
          </ChangesContextProvider>
        </DisplayContextProvider>
      </MainLayout>
    </FilterContextProvider>
  );
};

export default RenderToRoot(CubeComparePage);
