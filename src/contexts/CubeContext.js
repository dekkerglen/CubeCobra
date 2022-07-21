/* eslint-disable no-await-in-loop */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useContext, useState, useMemo, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';

import UserContext from 'contexts/UserContext';
import useLocalStorage from 'hooks/useLocalStorage';
import { csrfFetch } from 'utils/CSRF';
import { normalizeName } from 'utils/Card';
import CardModal from 'components/CardModal';

const CubeContext = React.createContext({
  cube: {},
  canEdit: false,
  cubeID: null,
  hasCustomImages: false,
  updateCubeCard: () => {},
  updateCubeCards: () => {},
});

const getDetails = async (cardId) => {
  console.log(cardId);
  const response = await csrfFetch(`/cube/api/getcardfromid/${cardId}`, {
    method: 'GET',
  });
  if (!response.ok) {
    return {};
  }
  const json = await response.json();
  if (json.success !== 'true' || !json.card) {
    return {};
  }
  console.log(json.card);
  return json.card;
};

export const CubeContextProvider = ({ initialCube, cards, children, loadVersionDict }) => {
  const [cube, setCube] = useState({
    ...initialCube,
    cards,
  });
  const [versionDict, setVersionDict] = useState({});
  const [changes, setChanges] = useLocalStorage(`cube-changes-${cube.Id}`, {});
  const [modalSelection, setModalSelection] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const toggle = useCallback(
    (event) => {
      if (event) {
        event.preventDefault();
      }
      setModalOpen(!modalOpen);
    },
    [modalOpen],
  );

  useEffect(() => {
    const getData = async () => {
      if (!loadVersionDict) {
        return;
      }

      const ids = [];
      for (const [board, list] of Object.entries(cube.cards)) {
        if (board !== 'id') {
          for (const card of list) {
            ids.push(card.cardID);
          }
        }
      }

      const response = await csrfFetch(`/cube/api/getversions`, {
        method: 'POST',
        body: JSON.stringify(ids),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        const message = `Couldn't get versions: ${response.status}.`;
        console.error(message);
        return;
      }

      const json = await response.json();
      if (json.success !== 'true') {
        const message = `Couldn't get versions: ${json.message}.`;
        console.error(message);
        return;
      }

      setVersionDict(json.dict);
    };
    getData();
  }, [cube.cards, loadVersionDict]);

  const user = useContext(UserContext);

  const addCard = useCallback(
    (cardId, board) => {
      const newChanges = JSON.parse(JSON.stringify(changes));

      if (!newChanges[board]) {
        newChanges[board] = {};
      }
      const adds = newChanges[board].adds || [];
      adds.push(cardId);
      newChanges[board].adds = adds;
      setChanges(newChanges);
    },
    [changes, setChanges],
  );

  const revertAdd = useCallback(
    (index, board) => {
      const newChanges = JSON.parse(JSON.stringify(changes));

      if (!newChanges[board]) {
        return;
      }
      const adds = newChanges[board].adds || [];
      adds.splice(index, 1);
      newChanges[board].adds = adds;

      if (Object.keys(newChanges[board]).length === 0) {
        delete newChanges[board];
      }

      setChanges(newChanges);
    },
    [changes, setChanges],
  );

  const swapCard = useCallback(
    (index, card, board) => {
      const newChanges = JSON.parse(JSON.stringify(changes));

      if (!newChanges[board]) {
        newChanges[board] = {};
      }
      const swaps = newChanges[board].swaps || [];

      const oldCard = JSON.parse(JSON.stringify(cards[board][index]));
      delete oldCard.details;
      delete oldCard.index;
      delete oldCard.board;

      swaps.push({ index, card, oldCard });
      newChanges[board].swaps = swaps;
      setChanges(newChanges);
    },
    [changes, setChanges],
  );

  const revertSwap = useCallback(
    (index, board) => {
      const newChanges = JSON.parse(JSON.stringify(changes));

      if (!newChanges[board]) {
        return;
      }
      const swaps = newChanges[board].swaps || [];
      swaps.splice(index, 1);
      newChanges[board].swaps = swaps;

      if (Object.keys(newChanges[board]).length === 0) {
        delete newChanges[board];
      }

      setChanges(newChanges);
    },
    [changes, setChanges],
  );

  const editCard = useCallback(
    (index, card, board) => {
      const newChanges = JSON.parse(JSON.stringify(changes));

      if (!newChanges[board]) {
        newChanges[board] = {};
      }
      const edits = newChanges[board].edits || [];

      const oldCard = JSON.parse(JSON.stringify(cube.cards[board][index]));
      delete oldCard.details;
      delete oldCard.index;
      delete oldCard.board;

      const newCard = JSON.parse(JSON.stringify(card));
      delete newCard.details;
      delete newCard.index;
      delete newCard.board;

      // if this card has already been edited, overwrite the edit
      const editIndex = edits.findIndex((e) => e.index === index);
      if (editIndex !== -1) {
        edits[editIndex] = { index, newCard, oldCard };
      } else {
        edits.push({ index, newCard, oldCard });
      }

      newChanges[board].edits = edits;
      setChanges(newChanges);
    },
    [changes, setChanges],
  );

  const revertEdit = useCallback(
    (index, board) => {
      const newChanges = JSON.parse(JSON.stringify(changes));

      if (!newChanges[board]) {
        return;
      }

      const edits = newChanges[board].edits || [];
      edits.splice(index, 1);
      newChanges[board].edits = edits;

      if (edits.length === 0) {
        delete newChanges[board].edits;
      }

      if (Object.keys(newChanges[board]).length === 0) {
        delete newChanges[board];
      }

      setChanges(newChanges);
    },
    [changes, setChanges],
  );

  const removeCard = useCallback(
    (index, board) => {
      const newChanges = JSON.parse(JSON.stringify(changes));

      if (!newChanges[board]) {
        newChanges[board] = {};
      }
      const removes = newChanges[board].removes || [];

      const oldCard = JSON.parse(JSON.stringify(cube.cards[board][index]));
      delete oldCard.details;
      delete oldCard.index;
      delete oldCard.board;

      removes.push({ index, oldCard });
      newChanges[board].removes = removes;

      const swaps = newChanges[board].swaps || [];
      const edits = newChanges[board].edits || [];

      // remove swaps and edits that refer to this card
      const newSwaps = swaps.filter((s) => s.index !== index);
      const newEdits = edits.filter((e) => e.index !== index);

      newChanges[board].swaps = newSwaps;
      newChanges[board].edits = newEdits;

      setChanges(newChanges);
    },
    [changes, setChanges],
  );

  const revertRemove = useCallback(
    (index, board) => {
      const newChanges = JSON.parse(JSON.stringify(changes));

      if (!newChanges[board]) {
        return;
      }
      const removes = newChanges[board].removes || [];

      removes.splice(index, 1);
      newChanges[board].removes = removes;

      if (Object.keys(newChanges[board]).length === 0) {
        delete newChanges[board];
      }

      setChanges(newChanges);
    },
    [changes, setChanges],
  );

  useEffect(() => {
    const newChanges = JSON.parse(JSON.stringify(changes));
    let removed = false;
    for (const [board] of Object.entries(changes)) {
      if (changes[board].adds && changes[board].adds.length === 0) {
        delete newChanges[board].adds;
        removed = true;
      }
      if (changes[board].removes && changes[board].removes.length === 0) {
        delete newChanges[board].removes;
        removed = true;
      }
      if (changes[board].swaps && changes[board].swaps.length === 0) {
        delete newChanges[board].swaps;
        removed = true;
      }
      if (changes[board].edits && changes[board].edits.length === 0) {
        delete newChanges[board].edits;
        removed = true;
      }
      if (Object.keys(newChanges[board]).length === 0) {
        delete newChanges[board];
        removed = true;
      }
    }
    if (removed) {
      setChanges(newChanges);
    }
  }, [changes, setChanges]);

  const changedCards = useMemo(() => {
    const changed = JSON.parse(JSON.stringify(cube.cards));
    for (const [board] of Object.entries(changes)) {
      if (changes[board].edits) {
        for (let i = 0; i < changes[board].edits.length; i++) {
          const edit = changes[board].edits[i];
          const card = changed[board][edit.index];
          changed[board][edit.index] = {
            ...card,
            ...edit.newCard,
            markedForDelete: false,
            editIndex: i,
          };

          if (versionDict[normalizeName(card.details.name)] && edit.newCard.cardID !== card.cardID) {
            const newDetails = versionDict[normalizeName(card.details.name)].find((v) => v._id === edit.newCard.cardID);
            changed[board][edit.index].details = {
              ...card.details,
              ...newDetails,
            };
          }
        }
      }
      if (changes[board].removes) {
        for (let i = changes[board].removes.length - 1; i >= 0; i--) {
          const remove = changes[board].removes[i];
          changed[board][remove.index].markedForDelete = true;
          changed[board][remove.index].removeIndex = i;
          delete changed[board][remove.index].editIndex;
        }
      }
    }
    return changed;
  }, [changes, cube.cards, versionDict]);

  const discardAllChanges = useCallback(() => {
    setChanges({});
  }, [setChanges]);

  const commitChanges = useCallback(async () => {
    const newCards = JSON.parse(JSON.stringify(changedCards));

    for (const [board] of Object.entries(changes)) {
      // swaps
      if (changes[board].swaps) {
        for (const swap of changes[board].swaps) {
          newCards[board][swap.index] = swap.card;
          newCards[board][swap.index].details = await getDetails(swap.card.cardID);
        }
      }
      // removes
      if (changes[board].removes) {
        // sort removals desc
        const sorted = changes[board].removes.sort((a, b) => b.index - a.index);
        for (const remove of sorted) {
          newCards[board].splice(remove.index, 1);
        }
      }
      // adds
      if (changes[board].adds) {
        for (const add of changes[board].adds) {
          newCards[board].push({
            ...add,
          });
          newCards[board][newCards[board].length - 1].details = await getDetails(add.cardID);
        }
      }

      for (let i = 0; i < newCards[board].length; i++) {
        newCards[board][i].index = i;
        newCards[board][i].board = board;
      }
    }

    setCube({
      ...cube,
      cards: newCards,
    });
    setChanges({});
  }, [cube, changedCards, setCube, setChanges]);

  const canEdit = user && cube.Owner === user.Id;

  const hasCustomImages = useMemo(
    () =>
      Object.entries(changedCards).some(([boardname, list]) => {
        if (boardname === 'id') {
          return false;
        }
        return list.some(
          (card) => (card.imgUrl && card.imgUrl.length > 0) || (card.imgBackUrl && card.imgBackUrl.length > 0),
        );
      }),
    [cards],
  );
  const value = {
    cube,
    changedCards,
    canEdit,
    hasCustomImages,
    setCube,
    addCard,
    removeCard,
    swapCard,
    editCard,
    discardAllChanges,
    changes,
    revertAdd,
    revertRemove,
    revertSwap,
    revertEdit,
    versionDict,
    commitChanges,
    toggle,
    setModalSelection,
    setModalOpen,
  };

  return (
    <CubeContext.Provider value={value}>
      <>
        {children}
        {modalSelection && !Array.isArray(modalSelection) && (
          <CardModal
            card={changedCards[modalSelection.board][modalSelection.index]}
            isOpen={modalOpen}
            toggle={toggle}
            canEdit={canEdit}
            versionDict={versionDict}
            editCard={editCard}
            revertEdit={revertEdit}
            revertRemove={revertRemove}
            removeCard={removeCard}
          />
        )}
      </>
    </CubeContext.Provider>
  );
};

CubeContextProvider.propTypes = {
  initialCube: PropTypes.shape({
    cards: PropTypes.arrayOf(PropTypes.object),
  }),
  cards: PropTypes.shape({}).isRequired,
  children: PropTypes.node.isRequired,
  loadVersionDict: PropTypes.bool,
};

CubeContextProvider.defaultProps = {
  initialCube: {},
  loadVersionDict: false,
};

export default CubeContext;
