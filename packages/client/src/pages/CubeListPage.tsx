import React, { useContext, useEffect, useMemo, useRef } from 'react';

import Card from '@utils/datatypes/Card';
import Cube, { getViewByName, getViewDefinitions } from '@utils/datatypes/Cube';
import { UserRoles } from '@utils/datatypes/User';

import Container from 'components/base/Container';
import { Flexbox } from 'components/base/Layout';
import Text from 'components/base/Text';
import CardStacksView from 'components/cube/CardStacksView';
import CubeEmptyState from 'components/cube/CubeEmptyState';
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
import UserContext from 'contexts/UserContext';
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
  const { changedCards, unfilteredChangedCards, filterResult, canEdit, cube } = useContext(CubeContext);
  const { showAllBoards, activeView } = useContext(DisplayContext);
  const { filterInput, setFilterInput } = useContext(FilterContext);
  const user = useContext(UserContext);

  // Get the current view definition
  const currentView = useMemo(() => getViewByName(cube, activeView), [cube, activeView]);
  const viewBoards = useMemo(() => currentView?.boards.map((b) => b.toLowerCase()) || ['mainboard'], [currentView]);

  // Determine the display view (table, spoiler, etc.) from the view settings or URL param
  const defaultDisplayView = currentView?.displayView || 'table';
  const [cubeView, setCubeView] = useQueryParam('display', defaultDisplayView);

  // Refs to track current values and previous view for conditional view switching.
  // Only apply new view defaults if current settings match the previous view's defaults.
  // This preserves user customizations (e.g. a filter or display change) when switching views.
  const prevActiveViewRef = useRef(activeView);
  const cubeViewRef = useRef(cubeView);
  cubeViewRef.current = cubeView;
  const filterInputRef = useRef(filterInput);
  filterInputRef.current = filterInput;
  const isInitialMountRef = useRef(true);

  useEffect(() => {
    // Skip on initial mount so URL query params (from bookmarks) are respected.
    // useQueryParam handles reading URL params on mount; this effect should only
    // apply view defaults when the user actively switches between views.
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      prevActiveViewRef.current = activeView;
      return;
    }

    if (currentView) {
      const prevView = getViewByName(cube, prevActiveViewRef.current);
      const prevDefaultDisplay = prevView?.displayView || 'table';
      const prevDefaultFilter = prevView?.defaultFilter || '';

      // Only switch display if current display matches the previous view's default
      if (cubeViewRef.current === prevDefaultDisplay) {
        setCubeView(currentView.displayView);
      }

      // Only switch filter if current filter matches the previous view's default
      const currentFilter = filterInputRef.current || '';
      if (currentFilter === prevDefaultFilter) {
        if (currentView.defaultFilter) {
          setFilterInput(currentView.defaultFilter);
        } else {
          setFilterInput('');
        }
      }
    }

    prevActiveViewRef.current = activeView;
    // Only depend on activeView - when the VIEW changes, conditionally apply its defaults
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

  // Owners viewing a brand-new (zero-card) cube get a welcome card with
  // onboarding paths instead of an empty board view. Use the *unfiltered*
  // boards so an active filter that returns no matches doesn't trip the
  // empty state. Basics get auto-populated by the backend on cube creation,
  // so they don't count as "started" — only treat the cube as empty if
  // every non-basics board is empty.
  const isCubeOwner = !!user && !!cube?.owner && cube.owner.id === user.id;
  const realBoardsEmpty = Object.entries(unfilteredChangedCards).every(([boardname, list]) => {
    if (boardname.toLowerCase() === 'basics') return true;
    return !list || list.length === 0;
  });
  const showEmptyState = isCubeOwner && realBoardsEmpty;

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
      {showEmptyState && <CubeEmptyState />}
      {!showEmptyState &&
        (() => {
          // Calculate how many boards are active
          const activeBoards = Object.entries(changedCards).filter(([boardname, boardcards]) => {
            const boardKey = boardname.toLowerCase();
            const isActive = showAllBoards || viewBoards.includes(boardKey);
            return isActive && boardcards.length > 0;
          });
          const showBoardHeaders = activeBoards.length > 1;

          if (currentView?.mixBoards) {
            const boardname = activeBoards.flatMap((b) => b[0]).join('');
            const boardcards = activeBoards.flatMap((b) => b[1]);
            const displayBoardName = activeBoards
              .flatMap((b) => b[0].charAt(0).toUpperCase() + b[0].slice(1))
              .join(' & ');
            return (
              <ErrorBoundary key={boardname}>
                <Flexbox direction="col" gap="2">
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
                      list: <ListView cards={boardcards} />,
                      stacks: (
                        <CardStacksView cards={boardcards} formatLabel={(label, count) => `${label} (${count})`} />
                      ),
                    }[cubeView]
                  }
                </Flexbox>
              </ErrorBoundary>
            );
          }

          return Object.entries(changedCards)
            .sort(([a], [b]) => {
              const aIndex = viewBoards.indexOf(a.toLowerCase());
              const bIndex = viewBoards.indexOf(b.toLowerCase());
              // Boards in the view come first in their defined order; others go to the end
              if (aIndex === -1 && bIndex === -1) return 0;
              if (aIndex === -1) return 1;
              if (bIndex === -1) return -1;
              return aIndex - bIndex;
            })
            .map(([boardname, boardcards]) => {
              // Convert boardname to lowercase key for comparison with view's boards
              const boardKey = boardname.toLowerCase();
              const isActive = showAllBoards || viewBoards.includes(boardKey);
              // Capitalize board name for display
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
                            list: <ListView cards={boardcards} />,
                            stacks: (
                              <CardStacksView
                                cards={boardcards}
                                formatLabel={(label, count) => `${label} (${count})`}
                              />
                            ),
                          }[cubeView]
                        }
                      </>
                    )}
                  </Flexbox>
                </ErrorBoundary>
              );
            });
        })()}
    </>
  );
};

const CubeListPage: React.FC<CubeListPageProps> = ({ cube, cards }) => {
  const defaultView = getViewDefinitions(cube)[0]?.name || 'Mainboard';
  const user = useContext(UserContext);
  const isAdmin = !!user && Array.isArray(user.roles) && user.roles.includes(UserRoles.ADMIN);
  const isOwner = (!!user && cube.owner?.id === user.id) || isAdmin;

  return (
    <MainLayout useContainer={false}>
      <DisplayContextProvider cubeID={cube.id} defaultView={defaultView} defaultEditSidebarOpen={isOwner}>
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
