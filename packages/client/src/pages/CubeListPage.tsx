import React, { useContext } from 'react';

import { TableIcon, ImageIcon, GraphIcon, ListUnorderedIcon } from '@primer/octicons-react';
import Card, { BoardType } from '@utils/datatypes/Card';
import Cube from '@utils/datatypes/Cube';

import { Flexbox, NumCols } from 'components/base/Layout';
import Text from 'components/base/Text';
import Tooltip from 'components/base/Tooltip';
import Select from 'components/base/Select';
import CubeListNavbar from 'components/cube/CubeListNavbar';
import CurveView from 'components/cube/CurveView';
import ListView from 'components/cube/ListView';
import RotisserieDraftPanel from 'components/cube/RotisserieDraftPanel';
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

const boardToName: Record<BoardType, string> = {
  mainboard: 'Mainboard',
  maybeboard: 'Maybeboard',
};

const CubeListPageRaw: React.FC = () => {
  const { versionMismatch } = useContext(ChangesContext);
  const { changedCards, canEdit } = useContext(CubeContext);
  const { showMaybeboard, cardsPerRow, setCardsPerRow } = useContext(DisplayContext);
  const { cardFilter } = useContext(FilterContext);

  const [cubeView, setCubeView] = useQueryParam('view', 'table');

  if (versionMismatch) {
    return (
      <>
        <CubeListNavbar cubeView={cubeView} setCubeView={setCubeView} />
        <Flexbox direction="row" gap="2" alignItems="center" className="px-4 py-3">
          <Tooltip text="Table View">
            <button
              onClick={() => setCubeView('table')}
              className={`p-2 rounded transition-colors ${cubeView === 'table' ? 'bg-bg-active text-text' : 'hover:bg-bg-active text-text'}`}
              aria-label="Table View"
            >
              <TableIcon size={20} />
            </button>
          </Tooltip>
          <Tooltip text="Visual Spoiler">
            <button
              onClick={() => setCubeView('spoiler')}
              className={`p-2 rounded transition-colors ${cubeView === 'spoiler' ? 'bg-bg-active text-text' : 'hover:bg-bg-active text-text'}`}
              aria-label="Visual Spoiler"
            >
              <ImageIcon size={20} />
            </button>
          </Tooltip>
          <Tooltip text="Curve View">
            <button
              onClick={() => setCubeView('curve')}
              className={`p-2 rounded transition-colors ${cubeView === 'curve' ? 'bg-bg-active text-text' : 'hover:bg-bg-active text-text'}`}
              aria-label="Curve View"
            >
              <GraphIcon size={20} />
            </button>
          </Tooltip>
          {canEdit && (
            <Tooltip text="List View">
              <button
                onClick={() => setCubeView('list')}
                className={`p-2 rounded transition-colors ${cubeView === 'list' ? 'bg-bg-active text-text' : 'hover:bg-bg-active text-text'}`}
                aria-label="List View"
              >
                <ListUnorderedIcon size={20} />
              </button>
            </Tooltip>
          )}
          {cubeView === 'spoiler' && (
            <div className="w-48">
              <Select
                value={`${cardsPerRow}`}
                setValue={(value) => setCardsPerRow(parseInt(value, 10) as NumCols)}
                className="bg-bg-active"
                options={[
                  { value: '2', label: '2 Cards Per Row' },
                  { value: '3', label: '3 Cards Per Row' },
                  { value: '4', label: '4 Cards Per Row' },
                  { value: '5', label: '5 Cards Per Row' },
                  { value: '6', label: '6 Cards Per Row' },
                  { value: '7', label: '7 Cards Per Row' },
                  { value: '8', label: '8 Cards Per Row' },
                  { value: '9', label: '9 Cards Per Row' },
                  { value: '10', label: '10 Cards Per Row' },
                  { value: '11', label: '11 Cards Per Row' },
                  { value: '12', label: '12 Cards Per Row' },
                ]}
              />
            </div>
          )}
        </Flexbox>
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
    <RotoDraftContextProvider>
      <CubeListNavbar cubeView={cubeView} setCubeView={setCubeView} />
      <Flexbox direction="row" gap="2" alignItems="center" className="px-4 py-3">
        <Tooltip text="Table View">
          <button
            onClick={() => setCubeView('table')}
            className={`p-2 rounded transition-colors ${cubeView === 'table' ? 'bg-bg-active text-text' : 'hover:bg-bg-active text-text'}`}
            aria-label="Table View"
          >
            <TableIcon size={20} />
          </button>
        </Tooltip>
        <Tooltip text="Visual Spoiler">
          <button
            onClick={() => setCubeView('spoiler')}
            className={`p-2 rounded transition-colors ${cubeView === 'spoiler' ? 'bg-bg-active text-text' : 'hover:bg-bg-active text-text'}`}
            aria-label="Visual Spoiler"
          >
            <ImageIcon size={20} />
          </button>
        </Tooltip>
        <Tooltip text="Curve View">
          <button
            onClick={() => setCubeView('curve')}
            className={`p-2 rounded transition-colors ${cubeView === 'curve' ? 'bg-bg-active text-text' : 'hover:bg-bg-active text-text'}`}
            aria-label="Curve View"
          >
            <GraphIcon size={20} />
          </button>
        </Tooltip>
        {canEdit && (
          <Tooltip text="List View">
            <button
              onClick={() => setCubeView('list')}
              className={`p-2 rounded transition-colors ${cubeView === 'list' ? 'bg-bg-active text-text' : 'hover:bg-bg-active text-text'}`}
              aria-label="List View"
            >
              <ListUnorderedIcon size={20} />
            </button>
          </Tooltip>
        )}
        {cubeView === 'spoiler' && (
          <div className="w-48">
            <Select
              value={`${cardsPerRow}`}
              setValue={(value) => setCardsPerRow(parseInt(value, 10) as NumCols)}
              className="bg-bg-active"
              options={[
                { value: '2', label: '2 Cards Per Row' },
                { value: '3', label: '3 Cards Per Row' },
                { value: '4', label: '4 Cards Per Row' },
                { value: '5', label: '5 Cards Per Row' },
                { value: '6', label: '6 Cards Per Row' },
                { value: '7', label: '7 Cards Per Row' },
                { value: '8', label: '8 Cards Per Row' },
                { value: '9', label: '9 Cards Per Row' },
                { value: '10', label: '10 Cards Per Row' },
                { value: '11', label: '11 Cards Per Row' },
                { value: '12', label: '12 Cards Per Row' },
              ]}
            />
          </div>
        )}
      </Flexbox>
      <DynamicFlash />
      <RotisserieDraftPanel />
      {Object.entries(changedCards)
        .map(([boardname, boardcards]) => (
          <ErrorBoundary key={boardname}>
            <Flexbox direction="col" gap="2">
              {(showMaybeboard || boardname !== 'maybeboard') && (
                <>
                  {boardname !== 'mainboard' && (
                    <Text semibold md>
                      {boardToName[boardname as BoardType]}
                    </Text>
                  )}
                  {boardcards.length === 0 &&
                    (cardFilter ? (
                      <Text semibold md>
                        No {boardname === 'mainboard' ? 'Mainboard' : 'Maybeboard'} cards match filter.
                      </Text>
                    ) : (
                      <Text semibold md>
                        This board is empty.
                      </Text>
                    ))}
                  {
                    {
                      table: <TableView cards={boardcards} />,
                      spoiler: <VisualSpoiler cards={boardcards} />,
                      curve: <CurveView cards={boardcards} />,
                      list: <ListView cards={boardcards} />,
                    }[cubeView]
                  }
                  {boardname !== 'mainboard' && <hr />}
                </>
              )}
            </Flexbox>
          </ErrorBoundary>
        ))
        .reverse()}
    </RotoDraftContextProvider>
  );
};

const CubeListPage: React.FC<CubeListPageProps> = ({ cube, cards }) => (
  <MainLayout useContainer={false}>
    <DisplayContextProvider cubeID={cube.id}>
      <CubeLayout cube={cube} cards={cards} activeLink="list" loadVersionDict useChangedCards>
        <CubeListPageRaw />
      </CubeLayout>
    </DisplayContextProvider>
  </MainLayout>
);

export default RenderToRoot(CubeListPage);
