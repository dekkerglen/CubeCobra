import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';

import Filter from '../util/Filter';
import Hash from '../util/Hash';

import CardModalForm from '../components/CardModalForm';
import { ChangelistContextProvider } from '../components/ChangelistContext';
import { CubeContextProvider } from '../components/CubeContext';
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

const CubeListPage = ({ cards, cubeID, canEdit, defaultTagColors, defaultShowTagColors, defaultSorts }) => {
  let initialOpenCollapse = null;
  const savedChanges = typeof localStorage !== 'undefined' && localStorage.getItem(`changelist-${cubeID}`);
  if (cubeID && savedChanges && savedChanges.length > 2) {
    initialOpenCollapse = 'edit';
  } else if (Hash.get('f', false)) {
    initialOpenCollapse = 'filter';
  }

  const [cubeView, setCubeView] = useState(Hash.get('view', 'table'));
  const [openCollapse, setOpenCollapse] = useState(initialOpenCollapse);
  const [filter, setFilter] = useState([]);

  const cardsIndex = useMemo(() => cards.map((card, index) => ({ ...card, index })), [cards]);

  useEffect(() => {
    if (cubeView === 'table') {
      Hash.del('view');
    } else {
      Hash.set('view', cubeView);
    }
  }, [cubeView]);

  const defaultTagSet = new Set([].concat.apply([], cardsIndex.map((card) => card.tags)));
  const defaultTags = [...defaultTagSet].map((tag) => ({
    id: tag,
    text: tag,
  }));
  const filteredCards = filter.length > 0 ? cardsIndex.filter((card) => Filter.filterCard(card, filter)) : cardsIndex;
  return (
    <CubeContextProvider initialCube={cardsIndex} cubeID={cubeID} canEdit={canEdit}>
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
    </CubeContextProvider>
  );
};

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
