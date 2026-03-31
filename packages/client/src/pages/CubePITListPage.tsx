import React, { useContext, useMemo } from 'react';

import Card from '@utils/datatypes/Card';
import Cube from '@utils/datatypes/Cube';

import Container from 'components/base/Container';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import CardStacksView from 'components/cube/CardStacksView';
import CubeListNavbar from 'components/cube/CubeListNavbar';
import CubeListRightSidebar, { CubeListBottomCard } from 'components/cube/CubeListRightSidebar';
import CurveView from 'components/cube/CurveView';
import TableView from 'components/cube/TableView';
import VisualSpoiler from 'components/cube/VisualSpoiler';
import DynamicFlash from 'components/DynamicFlash';
import ErrorBoundary from 'components/ErrorBoundary';
import RenderToRoot from 'components/RenderToRoot';
import CubeContext from 'contexts/CubeContext';
import DisplayContext, { DisplayContextProvider } from 'contexts/DisplayContext';
import FilterContext from 'contexts/FilterContext';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';
import useQueryParam from 'hooks/useQueryParam';

interface CubePITListPageProps {
  cube: Cube;
  cards: {
    mainboard: Card[];
    maybeboard: Card[];
  };
  date: string;
  changelogId: string;
}

const CubePITListInner: React.FC<{ date: string; changelogId: string }> = ({ date, changelogId }) => {
  const cubeContext = useContext(CubeContext);
  const { changedCards, filterResult, cube } = cubeContext;
  const { showAllBoards } = useContext(DisplayContext);
  const { filterInput } = useContext(FilterContext);

  const [cubeView, setCubeView] = useQueryParam('display', 'table');

  // Override canEdit to false — this is a read-only point-in-time view
  const readOnlyContext = useMemo(() => ({ ...cubeContext, canEdit: false }), [cubeContext]);

  return (
    <CubeContext.Provider value={readOnlyContext}>
      <div className="bg-bg-accent border-y border-border py-3 px-4 text-center" style={{ marginLeft: '-0.5rem', marginRight: '-0.5rem', width: 'calc(100% + 1rem)' }}>
        <Flexbox direction="row" alignItems="center" justify="center" gap="2" className="flex-wrap">
          <Text semibold md className="text-text">
            You are viewing a point-in-time snapshot of {cube.name} ({date})
          </Text>
          <Link href={`/cube/changelog/${cube.id}/${changelogId}`}>
            <Text sm className="text-link underline">Back to changelog entry &rarr;</Text>
          </Link>
        </Flexbox>
      </div>
      <Container xl>
        <CubeListBottomCard canEdit={false} />
        <CubeListNavbar cubeView={cubeView} setCubeView={setCubeView} />
      </Container>
      {filterResult && filterInput && filterInput.length > 0 && (
        <div className="text-center py-1">
          <Text italic sm>
            {Object.entries(filterResult)
              .filter(([boardname]) => {
                if (showAllBoards) return true;
                return boardname.toLowerCase() === 'mainboard';
              })
              .map(([boardname, counts]) => `Showing ${counts[0]} / ${counts[1]} cards in ${boardname}`)
              .join('. ') || 'No cards found.'}
          </Text>
        </div>
      )}
      <DynamicFlash />
      {(() => {
        const activeBoards = Object.entries(changedCards).filter(([boardname, boardcards]) => {
          const isActive = showAllBoards || boardname.toLowerCase() === 'mainboard';
          return isActive && boardcards.length > 0;
        });
        const showBoardHeaders = activeBoards.length > 1;

        return Object.entries(changedCards)
          .map(([boardname, boardcards]) => {
            const isActive = showAllBoards || boardname.toLowerCase() === 'mainboard';
            const displayBoardName = boardname.charAt(0).toUpperCase() + boardname.slice(1);

            return (
              <ErrorBoundary key={boardname}>
                <Flexbox direction="col" gap="2">
                  {isActive && (
                    <>
                      {showBoardHeaders && boardcards.length > 0 && (
                        <div className="mt-6 mb-4">
                          <h2 className="text-3xl font-bold text-center mb-3">{displayBoardName}</h2>
                          <hr className="border-t border-border w-full" />
                        </div>
                      )}
                      {boardcards.length === 0 && !showAllBoards && (
                        <Text semibold md className="text-center mt-4">
                          This board appears to be empty!
                        </Text>
                      )}
                      {
                        {
                          table: <TableView cards={boardcards} />,
                          spoiler: <VisualSpoiler cards={boardcards} />,
                          curve: <CurveView cards={boardcards} />,
                          stacks: (
                            <CardStacksView cards={boardcards} formatLabel={(label, count) => `${label} (${count})`} />
                          ),
                        }[cubeView] || <TableView cards={boardcards} />
                      }
                    </>
                  )}
                </Flexbox>
              </ErrorBoundary>
            );
          })
          .reverse();
      })()}
    </CubeContext.Provider>
  );
};

const CubePITListPage: React.FC<CubePITListPageProps> = ({ cube, cards, date, changelogId }) => {
  return (
    <MainLayout useContainer={false}>
      <DisplayContextProvider cubeID={cube.id}>
        <CubeLayout
          cube={cube}
          cards={cards}
          activeLink="changelog"
          useChangedCards
          rightSidebar={<CubeListRightSidebar canEdit={false} />}
        >
          <CubePITListInner date={date} changelogId={changelogId} />
        </CubeLayout>
      </DisplayContextProvider>
    </MainLayout>
  );
};

export default RenderToRoot(CubePITListPage);
