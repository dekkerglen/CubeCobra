import React, { useContext, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';

import Filter from '../util/Filter';
import Hash from '../util/Hash';
import Query from '../util/Query';

import CardModalForm from './CardModalForm';
import { ChangelistContextProvider } from './ChangelistContext';
import CubeContext, { CubeContextProvider } from './CubeContext';
import CubeListNavbar from './CubeListNavbar';
import CurveView from './CurveView';
import DisplayContext, { DisplayContextProvider } from './DisplayContext';
import DynamicFlash from './DynamicFlash';
import ErrorBoundary from './ErrorBoundary';
import GroupModal from './GroupModal';
import ListView from './ListView';
import Maybeboard from './Maybeboard';
import { MaybeboardContextProvider } from './MaybeboardContext';
import { SortContextProvider } from './SortContext';
import TableView from './TableView';
import { tagColors, TagContextProvider } from './TagContext';
import VisualSpoiler from './VisualSpoiler';

const CubeListPageRaw = ({ maybe, defaultTagColors, defaultShowTagColors, defaultSorts }) => {
  const { cube, cubeID, canEdit } = useContext(CubeContext);

  let initialOpenCollapse = null;
  const savedChanges = cubeID && typeof localStorage !== 'undefined' && localStorage.getItem(`changelist-${cubeID}`);
  if (savedChanges && savedChanges.length > 2 && Query.get('updated', false) !== 'true') {
    initialOpenCollapse = 'edit';
  } else if (Hash.get('f', false)) {
    initialOpenCollapse = 'filter';
  }

  const [cubeView, setCubeView] = useState(Hash.get('view', 'table'));
  const [openCollapse, setOpenCollapse] = useState(initialOpenCollapse);
  const [filter, setFilter] = useState([]);

  useEffect(() => {
    if (cubeView === 'table') {
      Hash.del('view');
    } else {
      Hash.set('view', cubeView);
    }
  }, [cubeView]);

  const defaultTagSet = new Set([].concat.apply([], cube.map((card) => card.tags)));
  const defaultTags = [...defaultTagSet].map((tag) => ({
    id: tag,
    text: tag,
  }));

  const filteredCards = useMemo(() => {
    return filter.length > 0 ? cube.filter((card) => Filter.filterCard(card, filter)) : cube;
  }, [filter, cube]);

  return (
    <SortContextProvider defaultSorts={defaultSorts}>
      <DisplayContextProvider cubeID={cubeID}>
        <TagContextProvider
          cubeID={cubeID}
          defaultTagColors={defaultTagColors}
          defaultShowTagColors={defaultShowTagColors}
          defaultTags={defaultTags}
        >
          <ChangelistContextProvider cubeID={cubeID} setOpenCollapse={setOpenCollapse}>
            <CardModalForm>
              <GroupModal cubeID={cubeID} canEdit={canEdit}>
                <CubeListNavbar
                  cubeView={cubeView}
                  setCubeView={setCubeView}
                  openCollapse={openCollapse}
                  setOpenCollapse={setOpenCollapse}
                  filter={filter}
                  setFilter={setFilter}
                  cards={filteredCards}
                  className="mb-3"
                />
                <DynamicFlash />
                <ErrorBoundary>
                  <DisplayContext.Consumer>
                    {({ showMaybeboard }) => (
                      <MaybeboardContextProvider initialCards={maybe}>
                        {showMaybeboard && <Maybeboard filter={filter} />}
                      </MaybeboardContextProvider>
                    )}
                  </DisplayContext.Consumer>
                </ErrorBoundary>
                <ErrorBoundary>
                  {filteredCards.length === 0 ? <h5 className="mt-1 mb-3">No cards match filter.</h5> : ''}
                  {
                    {
                      table: <TableView cards={filteredCards} />,
                      spoiler: <VisualSpoiler cards={filteredCards} />,
                      curve: <CurveView cards={filteredCards} />,
                      list: <ListView cards={filteredCards} />,
                    }[cubeView]
                  }
                </ErrorBoundary>
              </GroupModal>
            </CardModalForm>
          </ChangelistContextProvider>
        </TagContextProvider>
      </DisplayContextProvider>
    </SortContextProvider>
  );
};

const CubeListPage = ({ cards, cubeID, canEdit, ...props }) => (
  <CubeContextProvider initialCube={cards} cubeID={cubeID} canEdit={canEdit}>
    <CubeListPageRaw {...props} />
  </CubeContextProvider>
);

CubeListPage.propTypes = {
  cards: PropTypes.arrayOf(PropTypes.object).isRequired,
  cubeID: PropTypes.string.isRequired,
  defaultTagColors: PropTypes.arrayOf(
    PropTypes.shape({
      tag: PropTypes.string.isRequired,
      color: PropTypes.oneOf(tagColors.map(([t, c]) => c)),
    }),
  ).isRequired,
  defaultShowTagColors: PropTypes.bool.isRequired,
  defaultSorts: PropTypes.arrayOf(PropTypes.string).isRequired,
};

export default CubeListPage;
