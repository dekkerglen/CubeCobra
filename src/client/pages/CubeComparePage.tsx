import React, { useContext, useState } from 'react';

import CompareView from '../components/CompareView';
import CubeCompareNavbar from '../components/cube/CubeCompareNavbar';
import DynamicFlash from '../components/DynamicFlash';
import ErrorBoundary from '../components/ErrorBoundary';
import RenderToRoot from '../components/RenderToRoot';
import { CubeContextProvider } from '../contexts/CubeContext';
import { DisplayContextProvider } from '../contexts/DisplayContext';
import Card from '../../datatypes/Card';
import Cube from '../../datatypes/Cube';
import MainLayout from '../layouts/MainLayout';
import Query from 'utils/Query';
import FilterContext, { FilterContextProvider } from '../contexts/FilterContext';
import { ChangesContextProvider } from '../contexts/ChangesContext';

interface CubeComparePageProps {
  cards: Card[];
  cube: Cube;
  cubeB: Cube;
  loginCallback?: string;
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

const CubeComparePage: React.FC<CubeComparePageProps> = ({
  cards,
  cube,
  cubeB,
  loginCallback = '/',
  onlyA,
  onlyB,
  both,
}) => {
  return (
    <FilterContextProvider>
      <MainLayout loginCallback={loginCallback}>
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
