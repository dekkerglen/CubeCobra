import React, { useContext, useMemo, useState } from 'react';

import Card from '@utils/datatypes/Card';
import Cube from '@utils/datatypes/Cube';

import { useCardDetails } from 'hooks/useCardDetails';
import { getPlaceholderCardDetails } from 'utils/placeholderCardDetails';
import Query from 'utils/Query';

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
  onlyA: number[];
  onlyB: number[];
  both: number[];
  pitDate?: string;
  changelogId?: string;
}

const CubeComparePageInner: React.FC<CubeComparePageProps> = ({ cards, cube, cubeB, onlyA, onlyB, both, pitDate }) => {
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
        cards={filteredCards}
        both={both}
        onlyA={onlyA}
        onlyB={onlyB}
        pitDate={pitDate}
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
  onlyA,
  onlyB,
  both,
  pitDate,
  changelogId: _changelogId,
}) => {
  // Server strips card.details to keep response size down; rehydrate from the
  // shared IndexedDB cache and fall back to a placeholder while a card's real
  // details are still loading.
  const cardIDs = useMemo(() => cards.map((c) => c?.cardID).filter(Boolean) as string[], [cards]);
  const { details: detailsById } = useCardDetails(cardIDs);
  const hydratedCards = useMemo<Card[]>(
    () =>
      cards.map((c) => ({
        ...c,
        details: (c?.cardID && detailsById[c.cardID]) || c.details || getPlaceholderCardDetails(c?.cardID || ''),
      })),
    [cards, detailsById],
  );

  return (
    <FilterContextProvider>
      <MainLayout>
        <DisplayContextProvider cubeID={cube.id}>
          <ChangesContextProvider cube={cube}>
            <CubeContextProvider initialCube={cube} cards={{ mainboard: hydratedCards, maybeboard: [] }}>
              <CubeComparePageInner
                cards={hydratedCards}
                cube={cube}
                cubeB={cubeB}
                onlyA={onlyA}
                onlyB={onlyB}
                both={both}
                pitDate={pitDate}
              />
            </CubeContextProvider>
          </ChangesContextProvider>
        </DisplayContextProvider>
      </MainLayout>
    </FilterContextProvider>
  );
};

export default RenderToRoot(CubeComparePage);
