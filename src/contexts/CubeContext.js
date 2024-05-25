/* eslint-disable no-await-in-loop */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useContext, useState, useMemo, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';

import UserContext from 'contexts/UserContext';
import DisplayContext from 'contexts/DisplayContext';
import useLocalStorage from 'hooks/useLocalStorage';
import { csrfFetch } from 'utils/CSRF';
import { normalizeName } from 'utils/Card';
import CardModal from 'components/CardModal';
import GroupModal from 'components/GroupModal';
import useQueryParam from 'hooks/useQueryParam';
import useMount from 'hooks/UseMount';

import { xorStrings } from 'utils/Util';

import { makeFilter } from 'filtering/FilterCards';

const CubeContext = React.createContext({
  cube: {},
  canEdit: false,
  cubeID: null,
  hasCustomImages: false,
  updateCubeCard: () => {},
  updateCubeCards: () => {},
});

export const TAG_COLORS = [
  ['None', 'no-color'],
  ['Red', 'red'],
  ['Brown', 'brown'],
  ['Orange', 'orange'],
  ['Yellow', 'yellow'],
  ['Green', 'green'],
  ['Turquoise', 'turquoise'],
  ['Blue', 'blue'],
  ['Purple', 'purple'],
  ['Violet', 'violet'],
  ['Pink', 'pink'],
];

const getDetails = async (cardId) => {
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
  return json.card;
};

export function CubeContextProvider({ initialCube, cards, children, loadVersionDict, useChangedCards }) {
  const user = useContext(UserContext);

  const { setOpenCollapse } = useContext(DisplayContext);
  const [cube, setCube] = useState({
    ...initialCube,
    cards,
  });
  const [versionDict, setVersionDict] = useState({});
  const [changes, setChanges] = useLocalStorage(`cubecobra-changes-${cube.id}`, {});
  const [modalSelection, setModalSelection] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [showTagColors, setShowTagColors] = useState(user ? !user.hideTagColors : false);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sortPrimary, setSortPrimary] = useQueryParam('s1', cube.defaultSorts[0] || 'Color Category');
  const [sortSecondary, setSortSecondary] = useQueryParam('s2', cube.defaultSorts[1] || 'Types-Multicolor');
  const [sortTertiary, setSortTertiary] = useQueryParam('s3', cube.defaultSorts[2] || 'Mana Value');
  const [sortQuaternary, setSortQuaternary] = useQueryParam('s4', cube.defaultSorts[3] || 'Alphabetical');
  const [filterInput, setFilterInput] = useQueryParam('f', '');
  const [filterValid, setFilterValid] = useState(true);
  const [cardFilter, setCardFilter] = useState({ fn: () => true });
  const [filterResult, setFilterResult] = useState('');
  const [useBlog, setUseBlog] = useLocalStorage(`${cube.id}-useBlog`, true);

  const allTags = useMemo(() => {
    const tags = new Set();

    for (const [board, list] of Object.entries(cards)) {
      if (board !== 'id') {
        for (const card of list) {
          for (const tag of card.tags || []) {
            tags.add(tag);
          }
        }
      }
    }

    return [...tags];
  }, [cube.cards]);

  const [tagColors, setTagColors] = useState([
    ...(cube.tagColors || []),
    ...allTags
      .filter((tag) => !(cube.tagColors || []).map((tc) => tc.tag).includes(tag))
      .map((tag) => ({ tag, color: 'no-color' })),
  ]);

  useMount(() => {
    // if there are changes
    if (Object.keys(changes).length > 0 && setOpenCollapse) {
      setOpenCollapse('edit');
    }
  });

  const toggle = useCallback(
    (event) => {
      if (event) {
        event.preventDefault();
      }
      setModalOpen(!modalOpen);
    },
    [modalOpen],
  );

  const updateShowTagColors = useCallback(
    (showColors) =>
      csrfFetch('/cube/api/saveshowtagcolors', {
        method: 'POST',
        body: JSON.stringify({
          show_tag_colors: showColors,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      }).then((response) => {
        if (response.ok) {
          setShowTagColors(showColors);
          window.globalShowTagColors = showTagColors;
        } else {
          console.error('Request failed.');
        }
      }),
    [showTagColors],
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
            if (!card.cardID) {
              console.error(`Card ${card.details.name} has no cardID`);
            } else {
              ids.push(card.cardID);
            }
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

  const addCard = useCallback(
    (card, board) => {
      const newChanges = JSON.parse(JSON.stringify(changes));

      if (!newChanges[board]) {
        newChanges[board] = {};
      }
      const adds = newChanges[board].adds || [];
      adds.push(card);
      newChanges[board].adds = adds;
      setChanges(newChanges);
    },
    [changes, setChanges],
  );

  const bulkAddCard = useCallback(
    (newCards, board) => {
      const newChanges = JSON.parse(JSON.stringify(changes));

      if (!newChanges[board]) {
        newChanges[board] = {};
      }
      const adds = newChanges[board].adds || [];
      adds.push(...newCards);
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

      swaps.push({ index, card: { ...card, index }, oldCard });
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
      // don't push an edit if this card is marked for delete
      if (changes[board] && changes[board].removes && changes[board].removes.some((remove) => remove.index === index)) {
        return;
      }

      const newChanges = JSON.parse(JSON.stringify(changes));

      if (!newChanges[board]) {
        newChanges[board] = {};
      }
      const edits = newChanges[board].edits || [];

      const oldCard = JSON.parse(JSON.stringify(cube.cards[board][index]));
      delete oldCard.details;

      const newCard = JSON.parse(JSON.stringify(card));
      delete newCard.details;

      // if this card has already been edited, overwrite the edit
      const editIndex = edits.findIndex((e) => e.index === index);
      if (editIndex !== -1) {
        edits[editIndex] = { index, newCard, oldCard };
      } else {
        edits.push({ index, newCard, oldCard });
      }

      newChanges[board].edits = edits;
      setChanges(newChanges);
      setOpenCollapse('edit');
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

  const moveCard = useCallback(
    (index, board, newBoard) => {
      const newChanges = JSON.parse(JSON.stringify(changes));

      // if this card has already been removed, don't remove it again
      if (
        newChanges[board] &&
        newChanges[board].removes &&
        newChanges[board].removes.some((remove) => remove.index === index)
      ) {
        return;
      }

      if (!newChanges[board]) {
        newChanges[board] = {};
      }
      const removes = newChanges[board].removes || [];

      const oldCard = JSON.parse(JSON.stringify(cube.cards[board][index]));
      delete oldCard.details;

      removes.push({ index, oldCard });
      newChanges[board].removes = removes;

      const swaps = newChanges[board].swaps || [];
      const edits = newChanges[board].edits || [];

      // remove swaps and edits that refer to this card
      const newSwaps = swaps.filter((s) => s.index !== index);
      const newEdits = edits.filter((e) => e.index !== index);

      newChanges[board].swaps = newSwaps;
      newChanges[board].edits = newEdits;

      // now we add
      if (!newChanges[newBoard]) {
        newChanges[newBoard] = {};
      }
      const adds = newChanges[newBoard].adds || [];
      adds.push(oldCard);
      newChanges[newBoard].adds = adds;

      setChanges(newChanges);
      setOpenCollapse('edit');
    },
    [changes, setChanges],
  );

  const bulkMoveCard = useCallback(
    (cardList, newBoard) => {
      const newChanges = JSON.parse(JSON.stringify(changes));

      for (const card of cardList) {
        if (card.board !== newBoard) {
          if (!newChanges[card.board]) {
            newChanges[card.board] = {};
          }
          if (!newChanges[card.board].removes) {
            newChanges[card.board].removes = [];
          }

          // if this card has been edited, remove the edit
          if (newChanges[card.board].edits) {
            const editIndex = newChanges[card.board].edits.findIndex((e) => e.index === card.index);
            if (editIndex !== -1) {
              newChanges[card.board].edits.splice(editIndex, 1);
            }
          }

          newChanges[card.board].removes.push({
            index: card.index,
            oldCard: cube.cards[card.board][card.index],
          });
        }
      }

      if (!newChanges[newBoard]) {
        newChanges[newBoard] = {};
      }
      const adds = newChanges[newBoard].adds || [];
      adds.push(...cardList.filter((card) => card.board !== newBoard));
      newChanges[newBoard].adds = adds;

      setChanges(newChanges);
      setOpenCollapse('edit');
    },
    [changes, setChanges],
  );

  const removeCard = useCallback(
    (index, board) => {
      const newChanges = JSON.parse(JSON.stringify(changes));

      // if this card has already been removed, don't remove it again
      if (
        newChanges[board] &&
        newChanges[board].removes &&
        newChanges[board].removes.some((remove) => remove.index === index)
      ) {
        return;
      }

      if (!newChanges[board]) {
        newChanges[board] = {};
      }
      const removes = newChanges[board].removes || [];

      const oldCard = JSON.parse(JSON.stringify(cube.cards[board][index]));
      delete oldCard.details;

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
      setOpenCollapse('edit');
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

  const [changedCards, unfilteredChangedCards] = useMemo(() => {
    const changed = JSON.parse(JSON.stringify(cube.cards));

    if (useChangedCards) {
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
              const newDetails = versionDict[normalizeName(card.details.name)].find(
                (v) => v.scryfall_id === edit.newCard.cardID,
              );
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
    }

    const result = Object.fromEntries(
      Object.entries(changed)
        .filter(([boardname]) => boardname !== 'id')
        .map(([boardname, list]) => [boardname, list.filter(cardFilter.fn)]),
    );

    if (filterInput !== '') {
      if (changed.maybeboard && changed.maybeboard.length > 0) {
        setFilterResult(
          `Showing ${result.mainboard.length}/${changed.mainboard.length} in Mainboard, ${result.maybeboard.length}/${changed.maybeboard.length} in Maybeboard`,
        );
      } else {
        setFilterResult(`Showing ${result.mainboard.length}/${changed.mainboard.length}`);
      }
    } else {
      setFilterResult('');
    }

    return [result, changed];
  }, [changes, cube.cards, versionDict, cardFilter]);

  const discardAllChanges = useCallback(() => {
    setChanges({});
  }, [setChanges]);

  const checksum = useMemo(() => {
    // we want to checksum the cube we are applying to, to make sure it hasn't changed since we started editing
    // we want to xorStrings each card's cardID
    const cardIds = [];
    for (const [board] of Object.entries(cube.cards)) {
      if (board !== 'id') {
        for (const card of cube.cards[board]) {
          cardIds.push(card.cardID);
        }
      }
    }
    return xorStrings(cardIds);
  }, [cube.cards]);

  console.log(cube.cards);
  console.log(checksum);

  const commitChanges = useCallback(
    async (title, blog) => {
      setLoading(true);

      try {
        const result = await csrfFetch(`/cube/api/commit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title,
            blog,
            changes,
            id: cube.id,
            useBlog,
            checksum,
          }),
        });

        const json = await result.json();

        if (json.success !== 'true') {
          setAlerts([...alerts, { color: 'danger', message: json.message }]);
        } else {
          const newCards = JSON.parse(JSON.stringify(unfilteredChangedCards));

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

          // strip editIndex
          for (const [board] of Object.entries(newCards)) {
            for (const card of newCards[board]) {
              delete card.editIndex;
              delete card.removeIndex;
            }
          }

          setModalSelection([]);
          setChanges({});
          setCube({
            ...cube,
            cards: newCards,
          });
        }
      } catch (e) {
        setAlerts([{ type: 'error', message: 'Operation timed out' }]);
      }
      setLoading(false);
    },
    [cube, changedCards, setCube, setChanges],
  );

  const bulkEditCard = useCallback(
    (list) => {
      const newChanges = JSON.parse(JSON.stringify(changes));

      for (const edit of list) {
        if (!newChanges[edit.board]) {
          newChanges[edit.board] = {};
        }
        if (!newChanges[edit.board].edits) {
          newChanges[edit.board].edits = [];
        }

        // don't push an edit if this card is marked for delete
        if (
          !changes[edit.board] ||
          !changes[edit.board].removes ||
          !changes[edit.board].removes.some((remove) => remove.index === edit.index)
        ) {
          const card = cube.cards[edit.board][edit.index];

          const oldCard = JSON.parse(JSON.stringify(cube.cards[edit.board][edit.index]));
          delete oldCard.details;

          const newCard = {
            ...card,
            ...edit,
            markedForDelete: false,
            editIndex: newChanges[edit.board].edits.length,
          };
          delete newCard.details;

          // if this card has already been edited, overwrite the edit
          const index = newChanges[edit.board].edits.findIndex((e) => e.index === edit.index);
          if (index !== -1) {
            newChanges[edit.board].edits[index].newCard = newCard;
          } else {
            newChanges[edit.board].edits.push({ index: edit.index, newCard, oldCard });
          }
        }
      }
      setChanges(newChanges);
      setOpenCollapse('edit');
    },
    [cube, changes, setChanges],
  );

  const bulkRevertEdit = useCallback(
    (list) => {
      const newChanges = JSON.parse(JSON.stringify(changes));

      for (const edit of list) {
        if (!newChanges[edit.board]) {
          newChanges[edit.board] = {};
        }
        if (!newChanges[edit.board].edits) {
          newChanges[edit.board].edits = [];
        }

        const editIndex = newChanges[edit.board].edits.findIndex((e) => e.index === edit.index);
        if (editIndex !== -1) {
          newChanges[edit.board].edits.splice(editIndex, 1);
        }
      }

      setChanges(newChanges);
    },
    [cube, changes, setChanges],
  );

  const bulkRemoveCard = useCallback(
    (list) => {
      const newChanges = JSON.parse(JSON.stringify(changes));

      for (const remove of list) {
        if (!newChanges[remove.board]) {
          newChanges[remove.board] = {};
        }
        if (!newChanges[remove.board].removes) {
          newChanges[remove.board].removes = [];
        }

        // if this card has been edited, remove the edit
        if (newChanges[remove.board].edits) {
          const editIndex = newChanges[remove.board].edits.findIndex((e) => e.index === remove.index);
          if (editIndex !== -1) {
            newChanges[remove.board].edits.splice(editIndex, 1);
          }
        }

        newChanges[remove.board].removes.push({ index: remove.index, oldCard: cube.cards[remove.board][remove.index] });
      }

      setChanges(newChanges);
      setOpenCollapse('edit');
    },
    [cube, changes, setChanges],
  );

  const bulkRevertRemove = useCallback(
    (list) => {
      const newChanges = JSON.parse(JSON.stringify(changes));

      for (const remove of list) {
        if (!newChanges[remove.board]) {
          newChanges[remove.board] = {};
        }
        if (!newChanges[remove.board].removes) {
          newChanges[remove.board].removes = [];
        }

        const removeIndex = newChanges[remove.board].removes.findIndex((e) => e.index === remove.index);
        if (removeIndex !== -1) {
          newChanges[remove.board].removes.splice(removeIndex, 1);
        }
      }

      setChanges(newChanges);
    },
    [cube, changes, setChanges],
  );

  const canEdit = user && cube.owner && cube.owner.id === user.id;

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

  const setShowUnsorted = useCallback(
    async (value) => {
      setLoading(true);
      setCube({
        ...cube,
        showUnsorted: value,
      });

      await csrfFetch(`/cube/api/savesorts/${cube.id}`, {
        method: 'POST',
        body: JSON.stringify({
          sorts: cube.defaultSorts,
          showUnsorted: value,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      setLoading(false);
    },
    [cube, setCube],
  );

  const saveSorts = useCallback(async () => {
    setLoading(true);
    setCube({
      ...cube,
      defaultSorts: [sortPrimary, sortSecondary, sortTertiary, sortQuaternary],
    });
    await csrfFetch(`/cube/api/savesorts/${cube.id}`, {
      method: 'POST',
      body: JSON.stringify({
        sorts: [sortPrimary, sortSecondary, sortTertiary, sortQuaternary],
        showUnsorted: cube.showUnsorted,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    setLoading(false);
  }, [cube, setCube, sortPrimary, sortSecondary, sortTertiary, sortQuaternary]);

  const resetSorts = useCallback(() => {
    setSortPrimary(cube.defaultSorts[0] || 'Color Category');
    setSortSecondary(cube.defaultSorts[1] || 'Types-Multicolor');
    setSortTertiary(cube.defaultSorts[2] || 'Mana Value');
    setSortQuaternary(cube.defaultSorts[3] || 'Alphabetical');
  }, [cube, setCube, setSortPrimary, setSortSecondary, setSortTertiary, setSortQuaternary]);

  useEffect(
    (overrideFilter) => {
      const input = overrideFilter ?? filterInput;
      if ((input.trim() ?? '') === '') {
        setCardFilter({ fn: () => true });
        return;
      }

      const { filter, err } = makeFilter(input);
      if (err) {
        setFilterValid(false);
        return;
      }

      setFilterValid(true);
      setCardFilter({ fn: filter });
    },
    [filterInput, setCardFilter],
  );

  const value = useMemo(
    () => ({
      cube,
      changedCards,
      canEdit,
      hasCustomImages,
      setCube,
      addCard,
      bulkAddCard,
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
      tagColors,
      showTagColors,
      setTagColors,
      updateShowTagColors,
      bulkEditCard,
      bulkRevertEdit,
      bulkRemoveCard,
      bulkRevertRemove,
      alerts,
      setAlerts,
      loading,
      setShowUnsorted,
      saveSorts,
      resetSorts,
      sortPrimary,
      sortSecondary,
      sortTertiary,
      sortQuaternary,
      setSortPrimary,
      setSortSecondary,
      setSortTertiary,
      setSortQuaternary,
      filterInput,
      setFilterInput,
      filterValid,
      filterResult,
      unfilteredChangedCards,
      useBlog,
      setUseBlog,
      allTags,
    }),
    [
      cube,
      changedCards,
      canEdit,
      hasCustomImages,
      setCube,
      addCard,
      bulkAddCard,
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
      tagColors,
      showTagColors,
      setTagColors,
      updateShowTagColors,
      bulkEditCard,
      bulkRevertEdit,
      bulkRemoveCard,
      bulkRevertRemove,
      alerts,
      setAlerts,
      loading,
      setShowUnsorted,
      saveSorts,
      resetSorts,
      sortPrimary,
      sortSecondary,
      sortTertiary,
      sortQuaternary,
      setSortPrimary,
      setSortSecondary,
      setSortTertiary,
      setSortQuaternary,
      filterInput,
      setFilterInput,
      filterValid,
      filterResult,
      unfilteredChangedCards,
      useBlog,
      setUseBlog,
      allTags,
    ],
  );

  return (
    <CubeContext.Provider value={value}>
      <>
        {children}
        {modalSelection &&
          !Array.isArray(modalSelection) &&
          unfilteredChangedCards[modalSelection.board].find((card) => card.index === modalSelection.index) && (
            <CardModal
              card={unfilteredChangedCards[modalSelection.board].find((card) => card.index === modalSelection.index)}
              isOpen={modalOpen}
              toggle={toggle}
              canEdit={canEdit}
              versionDict={versionDict}
              editCard={editCard}
              revertEdit={revertEdit}
              revertRemove={revertRemove}
              removeCard={removeCard}
              tagColors={tagColors}
              moveCard={moveCard}
              allTags={allTags}
            />
          )}
        {modalSelection && Array.isArray(modalSelection) && (
          <GroupModal
            cards={modalSelection.map((s) => unfilteredChangedCards[s.board][s.index])}
            isOpen={modalOpen}
            toggle={toggle}
            canEdit={canEdit}
            bulkEditCard={bulkEditCard}
            bulkRevertEdit={bulkRevertEdit}
            bulkRemoveCard={bulkRemoveCard}
            bulkRevertRemove={bulkRevertRemove}
            removeCard={removeCard}
            setModalSelection={setModalSelection}
            tagColors={tagColors}
            bulkMoveCard={bulkMoveCard}
            allTags={allTags}
          />
        )}
      </>
    </CubeContext.Provider>
  );
}

CubeContextProvider.propTypes = {
  initialCube: PropTypes.shape({
    cards: PropTypes.arrayOf(PropTypes.shape({})),
  }),
  cards: PropTypes.shape({}).isRequired,
  children: PropTypes.node.isRequired,
  loadVersionDict: PropTypes.bool,
  useChangedCards: PropTypes.bool,
};

CubeContextProvider.defaultProps = {
  initialCube: {},
  loadVersionDict: false,
  useChangedCards: false,
};

export default CubeContext;
