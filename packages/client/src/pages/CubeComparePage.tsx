import React, { useContext, useMemo, useState } from 'react';

import Card from '@utils/datatypes/Card';
import Cube, { getCubeDisplayOptions } from '@utils/datatypes/Cube';

import { useCardDetails } from 'hooks/useCardDetails';
import { applyIndexMap } from 'utils/applyIndexMap';
import { getPlaceholderCardDetails } from 'utils/placeholderCardDetails';

import { CompareSet, CompareSides } from '../components/compare/CompareArt';
import CompareHeader from '../components/compare/CompareHeader';
import CompareView from '../components/compare/CompareView';
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
  pitTimestamp?: number;
  pitCardCount?: number;
  changelogId?: string;
}

const CubeComparePageInner: React.FC<CubeComparePageProps> = ({
  cards,
  cube,
  cubeB,
  onlyA,
  onlyB,
  both,
  pitDate,
  pitTimestamp,
  pitCardCount,
  changelogId,
}) => {
  const [focus, setFocus] = useState<CompareSet | null>(null);
  const { cardFilter } = useContext(FilterContext);

  // A changelog compare is the same cube then and now; otherwise two cubes, base and comparison.
  const sides = useMemo<CompareSides>(
    () =>
      pitDate
        ? {
            a: {
              kicker: 'Then',
              title: pitDate,
              titleHint: pitTimestamp ? new Date(pitTimestamp).toLocaleString() : undefined,
              href: changelogId ? `/cube/changelog/${cube.id}/${changelogId}/list` : undefined,
              image: cube.image,
              cardCount: pitCardCount ?? onlyA.length + both.length,
              past: true,
            },
            b: {
              kicker: 'Now',
              title: cube.name,
              href: `/cube/list/${cube.id}`,
              image: cube.image,
              cardCount: cubeB.cardCount,
              owner: cube.owner,
            },
            captions: { onlyA: 'Removed', both: 'In Both', onlyB: 'Added' },
          }
        : {
            a: {
              kicker: 'Base',
              title: cube.name,
              href: `/cube/list/${cube.id}`,
              image: cube.image,
              cardCount: cube.cardCount,
              owner: cube.owner,
            },
            b: {
              kicker: 'Comparison',
              title: cubeB.name,
              href: `/cube/list/${cubeB.id}`,
              image: cubeB.image,
              cardCount: cubeB.cardCount,
              owner: cubeB.owner,
            },
            captions: { onlyA: 'Only in Base', both: 'In Both', onlyB: 'Only in Comparison' },
          },
    [cube, cubeB, pitDate, pitTimestamp, pitCardCount, changelogId, onlyA.length, both.length],
  );

  const filteredCards = cardFilter ? cards.filter(cardFilter.filter) : cards;

  // Map original indices to filtered indices. Memoise the map itself rather than a function
  // that closes over it: React Compiler cannot prove a returned closure stays memoized, so the
  // whole component was being skipped for optimisation.
  const filteredIndexMap = useMemo(() => {
    const cardFilterFn = cardFilter?.filter;
    if (!cardFilterFn) return null;

    const indexMap = new Map<number, number>();
    let filteredIndex = 0;

    for (let i = 0; i < cards.length; i++) {
      if (cardFilterFn(cards[i])) {
        indexMap.set(i, filteredIndex);
        filteredIndex += 1;
      }
    }

    return indexMap;
  }, [cards, cardFilter]);

  const filteredBoth = useMemo(() => applyIndexMap(both, filteredIndexMap), [both, filteredIndexMap]);
  const filteredOnlyA = useMemo(() => applyIndexMap(onlyA, filteredIndexMap), [onlyA, filteredIndexMap]);
  const filteredOnlyB = useMemo(() => applyIndexMap(onlyB, filteredIndexMap), [onlyB, filteredIndexMap]);

  return (
    <>
      <DynamicFlash />
      <CompareHeader
        sides={sides}
        shared={both.length}
        focus={focus}
        setFocus={setFocus}
        cubeA={cube}
        cubeB={cubeB}
        cards={filteredCards}
        both={filteredBoth}
        onlyA={filteredOnlyA}
        onlyB={filteredOnlyB}
        pitDate={pitDate}
      />
      <ErrorBoundary>
        <CompareView cards={filteredCards} onlyA={onlyA} onlyB={onlyB} both={both} sides={sides} focus={focus} />
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
  pitTimestamp,
  pitCardCount,
  changelogId,
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
        <DisplayContextProvider cubeID={cube.id} savedDisplayOptions={getCubeDisplayOptions(cube)}>
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
                pitTimestamp={pitTimestamp}
                pitCardCount={pitCardCount}
                changelogId={changelogId}
              />
            </CubeContextProvider>
          </ChangesContextProvider>
        </DisplayContextProvider>
      </MainLayout>
    </FilterContextProvider>
  );
};

export default RenderToRoot(CubeComparePage);
