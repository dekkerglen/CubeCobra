import React, { useContext, useEffect, useMemo } from 'react';

import Card from '@utils/datatypes/Card';
import Cube, { getViewByName } from '@utils/datatypes/Cube';

import Container from 'components/base/Container';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import CardStacksView from 'components/cube/CardStacksView';
import CubeListNavbar from 'components/cube/CubeListNavbar';
import CubeListRightSidebar, { CubeListBottomCard } from 'components/cube/CubeListRightSidebar';
import CurveView from 'components/cube/CurveView';
import ListView from 'components/cube/ListView';
import RotisserieDraftPanel from 'components/cube/RotisserieDraftPanel';
import ScryfallDragDropOverlay from 'components/cube/ScryfallDragDropOverlay';
import TableView from 'components/cube/TableView';
import VersionMismatch from 'components/cube/VersionMismatch';
import VisualSpoiler from 'components/cube/VisualSpoiler';
import DynamicFlash from 'components/DynamicFlash';
import ErrorBoundary from 'components/ErrorBoundary';
import RenderToRoot from 'components/RenderToRoot';
import ChangesContext from 'contexts/ChangesContext';
import CubeContext from 'contexts/CubeContext';
import DisplayContext, { DisplayContextProvider } from 'contexts/DisplayContext';
import FilterContext from 'contexts/FilterContext';
import { RotoDraftContextProvider } from 'contexts/RotoDraftContext';
import useQueryParam from 'hooks/useQueryParam';
import CubeLayout from 'layouts/CubeLayout';
import MainLayout from 'layouts/MainLayout';

interface CubeListPageProps {
  cube: Cube;
  cards: {
    mainboard: Card[];
    maybeboard: Card[];
  };
}

const CubeListPageRaw: React.FC = () => {
  const { versionMismatch } = useContext(ChangesContext);
  const { changedCards, filterResult, canEdit, cube } = useContext(CubeContext);
  const { showAllBoards, activeView } = useContext(DisplayContext);
  const { filterInput, setFilterInput } = useContext(FilterContext);

  // Get the current view definition
  const currentView = useMemo(() => getViewByName(cube, activeView), [cube, activeView]);
  const viewBoards = useMemo(() => currentView?.boards.map((b) => b.toLowerCase()) || ['mainboard'], [currentView]);

  // Determine the display view (table, spoiler, etc.) from the view settings or URL param
  const defaultDisplayView = currentView?.displayView || 'table';
  const [cubeView, setCubeView] = useQueryParam('display', defaultDisplayView);

  // Apply view defaults when view changes (but not when user manually changes display)
  useEffect(() => {
    if (currentView) {
      // Update display view to match the view's displayView ONLY on initial load or view switch
      // Don't override user's manual display changes
      setCubeView(currentView.displayView);

      // Apply filter (views don't have default filters yet, but structure is ready)
      if (currentView.defaultFilter) {
        setFilterInput(currentView.defaultFilter);
      } else {
        // Clear filter if view has no default filter
        setFilterInput('');
      }
    }
    // Only depend on activeView - when the VIEW changes, apply its defaults
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView]);

  if (versionMismatch) {
    return (
      <>
        <Container xl>
          <CubeListNavbar cubeView={cubeView} setCubeView={setCubeView} />
        </Container>
        <DynamicFlash />
        <VersionMismatch />
      </>
    );
  }

  const tagList = [];
  for (const [boardname, list] of Object.entries(changedCards)) {
    if (boardname !== 'id') {
      tagList.push(...new Set([...list.map((card) => card.tags || [])]));
    }
  }

  return (
    <>
      {canEdit && <ScryfallDragDropOverlay />}
      <Container xl>
        <CubeListBottomCard canEdit={canEdit} />
        <CubeListNavbar cubeView={cubeView} setCubeView={setCubeView} />
      </Container>
      {filterResult && filterInput && filterInput.length > 0 && (
        <div className="text-center py-1">
          <Text italic sm>
            {Object.entries(filterResult)
              .filter(([boardname]) => {
                // Only show relevant board filter results based on view mode
                if (showAllBoards) {
                  return true; // showAllBoards shows all
                }
                // Check if this board is included in the current view's boards
                return viewBoards.includes(boardname.toLowerCase());
              })
              .map(([boardname, counts]) => `Showing ${counts[0]} / ${counts[1]} cards in ${boardname}`)
              .join('. ') || 'No cards found.'}
          </Text>
        </div>
      )}
      <DynamicFlash />
      <RotisserieDraftPanel />
      {Object.entries(changedCards)
        .map(([boardname, boardcards]) => {
          // Convert boardname to lowercase key for comparison with view's boards
          const boardKey = boardname.toLowerCase();
          const isActive = showAllBoards || viewBoards.includes(boardKey);
          console.log(
            `[DEBUG] Board: ${boardname}, boardKey: ${boardKey}, isActive: ${isActive}, cardCount: ${boardcards.length}`,
          );

          return (
            <ErrorBoundary key={boardname}>
              <Flexbox direction="col" gap="2">
                {isActive && (
                  <>
                    {showAllBoards && boardcards.length > 0 && (
                      <Text semibold lg className="mt-4 text-center">
                        {boardname}
                      </Text>
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
                        list: <ListView cards={boardcards} />,
                        stacks: (
                          <CardStacksView cards={boardcards} formatLabel={(label, count) => `${label} (${count})`} />
                        ),
                      }[cubeView]
                    }
                  </>
                )}
              </Flexbox>
            </ErrorBoundary>
          );
        })
        .reverse()}
    </>
  );
};

const CubeListPage: React.FC<CubeListPageProps> = ({ cube, cards }) => {
  return (
    <MainLayout useContainer={false}>
      <DisplayContextProvider cubeID={cube.id}>
        <RotoDraftContextProvider>
          <CubeLayout
            cube={cube}
            cards={cards}
            activeLink="list"
            loadVersionDict
            useChangedCards
            rightSidebar={<CubeListPageRightSidebarWrapper />}
          >
            <CubeListPageRaw />
          </CubeLayout>
        </RotoDraftContextProvider>
      </DisplayContextProvider>
    </MainLayout>
  );
};

const CubeListPageRightSidebarWrapper: React.FC = () => {
  const { canEdit } = useContext(CubeContext);
  return <CubeListRightSidebar canEdit={canEdit} />;
};

export default RenderToRoot(CubeListPage);
