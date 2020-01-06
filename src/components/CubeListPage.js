import React, { useContext, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';

import Filter from '../util/Filter';
import Hash from '../util/Hash';
import Query from '../util/Query';

import CardModalForm from '../components/CardModalForm';
import { ChangelistContextProvider } from '../components/ChangelistContext';
import CubeContext, { CubeContextProvider } from '../components/CubeContext';
import CubeListNavbar from '../components/CubeListNavbar';
import CurveView from '../components/CurveView';
import { DisplayContextProvider } from '../components/DisplayContext';
import DynamicFlash from '../components/DynamicFlash';
import ErrorBoundary from '../components/ErrorBoundary';
import GroupModal from '../components/GroupModal';
import ListView from '../components/ListView';
import { SortContextProvider } from '../components/SortContext';
import TableView from '../components/TableView';
import { TagContextProvider } from '../components/TagContext';
import VisualSpoiler from '../components/VisualSpoiler';

const CubeListPageRaw = ({ defaultTagColors, defaultShowTagColors, defaultSorts }) => {
  let initialOpenCollapse = null;
  const savedChanges = cubeID && typeof localStorage !== 'undefined' && localStorage.getItem(`changelist-${cubeID}`);
  if (
    savedChanges &&
    savedChanges.length > 2 &&
    Query.get('updated', false) !== 'true'
  ) {
    initialOpenCollapse = 'edit';
  } else if (Hash.get('f', false)) {
    initialOpenCollapse = 'filter';
  }

  const [cubeView, setCubeView] = useState(Hash.get('view', 'table'));
  const [openCollapse, setOpenCollapse] = useState(initialOpenCollapse);
  const [filter, setFilter] = useState([]);

  const { cube, cubeID, canEdit } = useContext(CubeContext);

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
  const filteredCards = filter.length > 0 ? cube.filter((card) => Filter.filterCard(card, filter)) : cube;
  return (
    <SortContextProvider defaultSorts={defaultSorts}>
      <DisplayContextProvider>
        <TagContextProvider
          cubeID={cubeID}
          defaultTagColors={defaultTagColors}
          defaultShowTagColors={defaultShowTagColors}
          defaultTags={defaultTags}
        >
          <ChangelistContextProvider cubeID={cubeID}>
            <CardModalForm canEdit={canEdit} setOpenCollapse={setOpenCollapse}>
              <GroupModal cubeID={cubeID} canEdit={canEdit} setOpenCollapse={setOpenCollapse}>
                <CubeListNavbar
                  cubeView={cubeView}
                  setCubeView={setCubeView}
                  openCollapse={openCollapse}
                  setOpenCollapse={setOpenCollapse}
                  filter={filter}
                  setFilter={setFilter}
                  cards={filteredCards}
                />
                <DynamicFlash />
                <ErrorBoundary className="mt-3">
                  {filteredCards.length === 0 ? <h5 className="mt-4">No cards match filter.</h5> : ''}
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

const CubeListPage = ({ cards, cubeID, canEdit, ...props }) =>
  <CubeContextProvider initialCube={cards} cubeID={cubeID} canEdit={canEdit}>
    <CubeListPageRaw {...props} />
  </CubeContextProvider>;

CubeListPage.propTypes = {
  cards: PropTypes.arrayOf(PropTypes.object).isRequired,
  cubeID: PropTypes.string.isRequired,
  defaultTagColors: PropTypes.arrayOf(
    PropTypes.shape({
      tag: PropTypes.string.isRequired,
      color: PropTypes.string.isRequired,
    }),
  ).isRequired,
  defaultShowTagColors: PropTypes.bool.isRequired,
  defaultSorts: PropTypes.arrayOf(PropTypes.string).isRequired,
};

export default CubeListPage;
