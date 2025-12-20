import React, {
  createContext,
  Dispatch,
  ReactNode,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { cardName, normalizeName } from '@utils/cardutil';
import Card, { BoardType, boardTypes, Changes, CubeCardChange } from '@utils/datatypes/Card';
import { CardDetails } from '@utils/datatypes/Card';
import Cube, { CubeCards, TagColor } from '@utils/datatypes/Cube';
import { getCubeSorts } from '@utils/sorting/Sort';
import { deepCopy } from '@utils/Util';

import { UncontrolledAlertProps } from '../components/base/Alert';
import CardModal from '../components/card/CardModal';
import GroupModal from '../components/GroupModal';
import useLocalStorage from '../hooks/useLocalStorage';
import useMount from '../hooks/UseMount';
import useQueryParam from '../hooks/useQueryParam';
import ChangesContext from './ChangesContext';
import { CSRFContext } from './CSRFContext';
import DisplayContext from './DisplayContext';
import FilterContext from './FilterContext';
import UserContext from './UserContext';

export interface CubeWithCards extends Cube {
  cards: {
    mainboard: Card[];
    maybeboard: Card[];
  };
  isInFeaturedQueue?: boolean;
}

export interface CardVersion {
  scryfall_id: string;
  version: string;
  image_normal?: string;
  prices: {
    usd?: number;
    eur?: number;
    usd_foil?: number;
    usd_etched?: number;
    tix?: number;
  };
}

export interface CubeContextValue {
  cube: CubeWithCards;
  changedCards: Record<string, Card[]>;
  canEdit: boolean;
  hasCustomImages: boolean;
  setCube: Dispatch<SetStateAction<CubeWithCards>>;
  addCard: (card: Card, board: BoardType) => Promise<void>;
  bulkAddCard: (newCards: Card[], board: BoardType) => Promise<void>;
  removeCard: (index: number, board: BoardType) => void;
  swapCard: (index: number, card: Card, board: BoardType) => Promise<void>;
  editCard: (index: number, card: Card, board: BoardType) => void;
  editAddedCard: (addIndex: number, card: Card, board: BoardType) => Promise<void>;
  editSwappedCard: (swapIndex: number, card: Card, board: BoardType) => Promise<void>;
  clearChanges: () => void;
  changes: Changes;
  revertAdd: (index: number, board: BoardType) => void;
  revertRemove: (index: number, board: BoardType) => void;
  revertSwap: (index: number, board: BoardType) => void;
  revertEdit: (index: number, board: BoardType) => void;
  versionDict: Record<string, CardVersion[]>;
  fetchVersionsForCard: (cardId: string) => Promise<boolean>;
  commitChanges: (title: string, blog: string) => Promise<void>;
  setModalSelection: Dispatch<
    SetStateAction<
      | { index: number; board: BoardType }
      | { index: number; board: BoardType; isNewlyAdded: true; addIndex: number }
      | { index: number; board: BoardType; isSwapped: true; swapIndex: number }
      | { index: number; board: BoardType }[]
    >
  >;
  setModalOpen: Dispatch<SetStateAction<boolean>>;
  tagColors: TagColor[];
  showTagColors: boolean;
  setTagColors: Dispatch<SetStateAction<TagColor[]>>;
  updateShowTagColors: (showColors: boolean) => Promise<void>;
  bulkEditCard: (list: { index: number; board: BoardType; [key: string]: unknown }[]) => void;
  bulkRevertEdit: (list: { index: number; board: BoardType }[]) => void;
  bulkRemoveCard: (list: { index: number; board: BoardType }[]) => void;
  bulkRevertRemove: (list: { index: number; board: BoardType }[]) => void;
  bulkEditNewCard: (cards: Card[]) => Promise<void>;
  alerts: UncontrolledAlertProps[];
  setAlerts: Dispatch<SetStateAction<UncontrolledAlertProps[]>>;
  loading: boolean;
  setShowUnsorted: (value: boolean) => Promise<void>;
  setCollapseDuplicateCards: (value: boolean) => Promise<void>;
  saveSorts: () => Promise<void>;
  resetSorts: () => void;
  sortPrimary: string | null;
  sortSecondary: string | null;
  sortTertiary: string | null;
  sortQuaternary: string | null;
  setSortPrimary: Dispatch<SetStateAction<string>>;
  setSortSecondary: Dispatch<SetStateAction<string>>;
  setSortTertiary: Dispatch<SetStateAction<string>>;
  setSortQuaternary: Dispatch<SetStateAction<string>>;
  filterResult: {
    mainboard?: [number, number];
    maybeboard?: [number, number];
  };
  unfilteredChangedCards: Record<string, Card[]>;
  useBlog: boolean;
  setUseBlog: Dispatch<SetStateAction<boolean>>;
  allTags: string[];
}

const defaultFn = () => {
  throw new Error('Error: Attempt to call CubeContext function before initialization.');
};

const CubeContext = createContext<CubeContextValue>({
  cube: {} as CubeWithCards,
  changedCards: {} as Record<string, Card[]>,
  canEdit: false,
  hasCustomImages: false,
  setCube: defaultFn,
  addCard: defaultFn,
  bulkAddCard: defaultFn,
  removeCard: defaultFn,
  swapCard: defaultFn,
  editCard: defaultFn,
  editAddedCard: defaultFn,
  editSwappedCard: defaultFn,
  clearChanges: defaultFn,
  changes: {} as Changes,
  revertAdd: defaultFn,
  revertRemove: defaultFn,
  revertSwap: defaultFn,
  revertEdit: defaultFn,
  versionDict: {} as Record<string, CardVersion[]>,
  fetchVersionsForCard: defaultFn,
  commitChanges: defaultFn,
  setModalSelection: defaultFn,
  setModalOpen: defaultFn,
  tagColors: [],
  showTagColors: false,
  setTagColors: defaultFn,
  updateShowTagColors: defaultFn,
  bulkEditCard: defaultFn,
  bulkRevertEdit: defaultFn,
  bulkRemoveCard: defaultFn,
  bulkRevertRemove: defaultFn,
  bulkEditNewCard: defaultFn,
  alerts: [],
  setAlerts: defaultFn,
  loading: false,
  setShowUnsorted: defaultFn,
  setCollapseDuplicateCards: defaultFn,
  saveSorts: defaultFn,
  resetSorts: defaultFn,
  sortPrimary: null,
  sortSecondary: null,
  sortTertiary: null,
  sortQuaternary: null,
  setSortPrimary: defaultFn,
  setSortSecondary: defaultFn,
  setSortTertiary: defaultFn,
  setSortQuaternary: defaultFn,
  filterResult: {},
  unfilteredChangedCards: {} as Record<string, Card[]>,
  useBlog: false,
  setUseBlog: defaultFn,
  allTags: [],
});

export const TAG_COLORS: [string, string][] = [
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

const getDetails = async (csrfFetch: any, cardId: string): Promise<CardDetails | null> => {
  const response = await csrfFetch(`/cube/api/getcardfromid/${cardId}`, {
    method: 'GET',
  });
  if (!response.ok) {
    return null;
  }
  const json = await response.json();
  if (json.success !== 'true' || !json.card) {
    return null;
  }
  return json.card;
};

export function CubeContextProvider({
  initialCube,
  cards,
  children,
  loadVersionDict = false,
  useChangedCards = false,
}: {
  initialCube: Cube;
  cards: {
    mainboard: Card[];
    maybeboard: Card[];
  };
  children: ReactNode;
  loadVersionDict?: boolean;
  useChangedCards?: boolean;
}) {
  const { csrfFetch } = useContext(CSRFContext);
  const user = useContext(UserContext);
  const { changes, setChanges, clearChanges, version, setVersion } = useContext(ChangesContext);
  const { filterInput, cardFilter } = useContext(FilterContext)!;

  const { setOpenCollapse } = useContext(DisplayContext);
  const [cube, setCube] = useState<CubeWithCards>({
    ...initialCube,
    cards: {
      mainboard: cards.mainboard,
      maybeboard: cards.maybeboard,
    },
  });
  const defaultSorts = useMemo(() => getCubeSorts(cube), [cube]);
  const [versionDict, setVersionDict] = useState<Record<string, CardVersion[]>>({});
  const [versionDictLoaded, setVersionDictLoaded] = useState(false);
  const [versionDictLoading, setVersionDictLoading] = useState(false);
  const fetchStartedRef = useRef(false);

  const fetchCardVersions = useCallback(
    async (ids: string[]): Promise<Record<string, CardVersion[]> | undefined> => {
      //With custom cards and have lots of duplicate ids, so use a set to reduce bandwidth
      const response = await csrfFetch(`/cube/api/getversions`, {
        method: 'POST',
        body: JSON.stringify([...new Set(ids)]),
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

      return json.dict;
    },
    [csrfFetch],
  );

  const fetchVersionDict = useCallback(async () => {
    if (versionDictLoaded || versionDictLoading || !loadVersionDict || fetchStartedRef.current) {
      return;
    }
    fetchStartedRef.current = true;
    setVersionDictLoading(true);

    const ids: string[] = [];
    for (const [board, list] of Object.entries(cube.cards)) {
      if (board !== 'id') {
        for (const card of list) {
          if (!card.cardID) {
            console.error(`Card ${card.details?.name} has no cardID`);
          } else {
            ids.push(card.cardID);
          }
        }
      }
    }
    const dict = await fetchCardVersions(ids);
    if (dict) {
      setVersionDict(dict);
      setVersionDictLoaded(true);
      setVersionDictLoading(false);
    }
  }, [cube.cards, fetchCardVersions, loadVersionDict, versionDictLoaded, versionDictLoading]);

  // Fetch versions for a single card lazily
  const fetchVersionsForCard = useCallback(
    async (cardId: string): Promise<boolean> => {
      if (!loadVersionDict) {
        return false;
      }

      const dict = await fetchCardVersions([cardId]);
      if (dict) {
        setVersionDict((prev) => ({ ...prev, ...dict }));
        return true;
      }
      return false;
    },
    [fetchCardVersions, loadVersionDict],
  );

  // The versionDictProxy is a Proxy around the versionDict state.
  // Its purpose is to lazily load the version dictionary from the server
  // only when it is first accessed by a consumer (such as ListView or CardModal).
  // This avoids fetching all card versions unless they are actually needed.

  const versionDictProxy = useMemo(() => {
    // maybeFetch ensures that the fetch is only triggered once (the fetchStartedRef),
    // and only if the version dictionary is not already loaded or loading.
    const maybeFetch = () => {
      if (loadVersionDict && !versionDictLoaded && !versionDictLoading && !fetchStartedRef.current) {
        fetchVersionDict();
      }
    };
    // The Proxy intercepts property access and other object operations.
    return new Proxy(versionDict, {
      // The get trap is called whenever a property is accessed, e.g. versionDictProxy[someKey].
      get(target, prop, receiver) {
        maybeFetch();
        return Reflect.get(target, prop, receiver);
      },
      // The ownKeys trap is called for operations like Object.keys(versionDictProxy).
      ownKeys(target) {
        maybeFetch();
        return Reflect.ownKeys(target);
      },
      // The getOwnPropertyDescriptor trap is called for operations like Object.getOwnPropertyDescriptor.
      getOwnPropertyDescriptor(target, prop) {
        maybeFetch();
        return Reflect.getOwnPropertyDescriptor(target, prop);
      },
    });
  }, [versionDict, fetchVersionDict, loadVersionDict, versionDictLoaded, versionDictLoading]);

  const [modalSelection, setModalSelection] = useState<
    | { index: number; board: BoardType }
    | { index: number; board: BoardType; isNewlyAdded: true; addIndex: number }
    | { index: number; board: BoardType; isSwapped: true; swapIndex: number }
    | { index: number; board: BoardType }[]
  >([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [addedCardDetails, setAddedCardDetails] = useState<CardDetails | null>(null);

  // Fetch details for newly added cards when modal is opened
  useEffect(() => {
    if (modalOpen && modalSelection && !Array.isArray(modalSelection)) {
      if (
        Object.prototype.hasOwnProperty.call(modalSelection, 'isNewlyAdded') &&
        (modalSelection as any).isNewlyAdded
      ) {
        const card = changes[modalSelection.board]?.adds?.[(modalSelection as any).addIndex];
        if (card) {
          getDetails(csrfFetch, card.cardID).then((details) => {
            setAddedCardDetails(details);
          });
        }
      } else if (
        Object.prototype.hasOwnProperty.call(modalSelection, 'isSwapped') &&
        (modalSelection as any).isSwapped
      ) {
        const card = changes[modalSelection.board]?.swaps?.[(modalSelection as any).swapIndex]?.card;
        if (card) {
          getDetails(csrfFetch, card.cardID).then((details) => {
            setAddedCardDetails(details);
          });
        }
      } else {
        setAddedCardDetails(null);
      }
    } else {
      setAddedCardDetails(null);
    }
  }, [modalOpen, modalSelection, changes, csrfFetch]);
  const [showTagColors, setShowTagColors] = useState(user ? !user.hideTagColors : false);
  const [alerts, setAlerts] = useState<UncontrolledAlertProps[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortPrimary, setSortPrimary] = useQueryParam('s1', defaultSorts[0]);
  const [sortSecondary, setSortSecondary] = useQueryParam('s2', defaultSorts[1]);
  const [sortTertiary, setSortTertiary] = useQueryParam('s3', defaultSorts[2]);
  const [sortQuaternary, setSortQuaternary] = useQueryParam('s4', defaultSorts[3]);
  const [filterResult, setFilterResult] = useState({});
  const [useBlog, setUseBlog] = useLocalStorage<boolean>(
    `${cube.id}-useBlog`,
    typeof user?.autoBlog !== 'undefined' ? user.autoBlog : false,
  );

  const getAllTags = (cubeCards: CubeCards) => {
    const tags = new Set<string>();

    //Use cube.cards instead of cards to get the most up-to-date tags, as "cards" is only the initial state
    const mainboard = cubeCards?.mainboard || [];
    const maybeboard = cubeCards?.maybeboard || [];

    for (const card of [...mainboard, ...maybeboard]) {
      for (const tag of card.tags || []) {
        tags.add(tag);
      }
    }

    return [...tags];
  };

  const allTags = useMemo(() => {
    return getAllTags(cube.cards);
  }, [cube.cards]);

  const computeTagColors = (tagColors: TagColor[], allTags: string[]) => {
    const cubeTagColors = tagColors || [];
    //Filter out tags in cube tag colors that are no longer tags on cards
    const tagColorsWithActiveTags = cubeTagColors.filter((tc) => allTags.includes(tc.tag));
    //If all tags on cards, is not within the cubeTagColors, then add it to the set with no color
    const newTagsWithoutColorsYet = allTags
      .filter((tag) => !cubeTagColors.map((tc) => tc.tag).includes(tag))
      .map((tag) => ({ tag, color: 'no-color' }));
    return [...tagColorsWithActiveTags, ...newTagsWithoutColorsYet];
  };

  const [tagColors, setTagColors] = useState<TagColor[]>(() => computeTagColors(cube.tagColors, allTags));

  /* Modifies the CubeCardChanges in place, if the index is found in its set */
  const removeCardByIndexFromChangeset = <Type extends CubeCardChange>(
    changeSet: Type[] | undefined,
    cardIndex: number,
  ) => {
    if (!changeSet) {
      return;
    }

    //Instead of defaulting findIndex to -1 using `... || -1`, default the removes to an empty array.
    //If the found index was 0, that is falsey so `... || -1` would trigger and the card wouldn't be found
    const changes = changeSet || [];
    const itemIndex = changes.findIndex((e) => e.index === cardIndex);
    if (itemIndex !== -1 && changes) {
      changes.splice(itemIndex, 1);
    }
  };

  useMount(() => {
    // if there are changes
    if (
      Object.values(changes.mainboard || {}).some((c) => c.length > 0) ||
      Object.values(changes.maybeboard || {}).some((c) => c.length > 0)
    ) {
      setOpenCollapse('edit');
    }
  });

  const updateShowTagColors = useCallback(
    async (showColors: boolean) => {
      const response = await csrfFetch('/cube/api/saveshowtagcolors', {
        method: 'POST',
        body: JSON.stringify({
          show_tag_colors: showColors,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        setShowTagColors(showColors);
      } else {
        console.error('Request failed.');
      }
    },
    [csrfFetch, setShowTagColors],
  );

  const addCard = useCallback(
    async (card: Card, board: BoardType) => {
      const newChanges = deepCopy(changes);
      if (!newChanges[board]) {
        newChanges[board] = { adds: [], removes: [], swaps: [], edits: [] };
      }
      if (!newChanges[board].adds) {
        newChanges[board].adds = [];
      }
      newChanges[board].adds.push(card);
      setChanges(newChanges);
    },
    [changes, setChanges],
  );

  const bulkAddCard = useCallback(
    async (newCards: Card[], board: BoardType) => {
      const newChanges = deepCopy(changes);
      if (!newChanges[board]) {
        newChanges[board] = { adds: [], removes: [], swaps: [], edits: [] };
      }
      if (!newChanges[board].adds) {
        newChanges[board].adds = [];
      }
      newChanges[board].adds.push(...newCards);
      setChanges(newChanges);
    },
    [changes, setChanges],
  );

  const revertAdd = useCallback(
    (index: number, board: BoardType) => {
      const newChanges = deepCopy(changes);
      if (!newChanges[board]) {
        newChanges[board] = { adds: [], removes: [], swaps: [], edits: [] };
      }
      if (!newChanges[board].adds) {
        newChanges[board].adds = [];
      }
      newChanges[board].adds.splice(index, 1);
      setChanges(newChanges);
    },
    [changes, setChanges],
  );

  const swapCard = useCallback(
    async (index: number, card: Card, board: BoardType) => {
      const newChanges = deepCopy(changes);

      const oldCard: Card = deepCopy(cube.cards[board][index]);
      delete oldCard.details;
      delete oldCard.index;
      delete oldCard.board;

      if (!newChanges[board]) {
        newChanges[board] = { adds: [], removes: [], swaps: [], edits: [] };
      }
      if (!newChanges[board].swaps) {
        newChanges[board].swaps = [];
      }
      newChanges[board].swaps.push({ index, card: { ...card, index }, oldCard });
      setChanges(newChanges);
    },
    [changes, cube.cards, setChanges],
  );

  const revertSwap = useCallback(
    (index: number, board: BoardType) => {
      const newChanges = deepCopy(changes);

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
    (index: number, card: Card, board: BoardType) => {
      // don't push an edit if this card is marked for delete

      if (changes[board]?.removes?.some((remove) => remove.index === index)) {
        return;
      }

      const newChanges = deepCopy(changes);

      const edits = newChanges[board]?.edits || [];

      const oldCard = deepCopy(cube.cards[board][index]);
      delete oldCard.details;

      const newCardData = deepCopy(card);
      delete newCardData.details;

      // if this card has already been edited, overwrite the edit
      const editIndex = edits.findIndex((e) => e.index === index);
      if (editIndex !== -1) {
        edits[editIndex] = { index, newCard: newCardData, oldCard };
      } else {
        edits.push({ index, newCard: newCardData, oldCard });
      }

      if (!newChanges[board]) {
        newChanges[board] = { adds: [], removes: [], swaps: [], edits: [] };
      }
      newChanges[board].edits = edits;
      setChanges(newChanges);
      setOpenCollapse('edit');
    },
    [changes, cube.cards, setChanges, setOpenCollapse],
  );

  const revertEdit = useCallback(
    (index: number, board: BoardType) => {
      const newChanges = deepCopy(changes);

      if (!newChanges[board]) {
        newChanges[board] = { adds: [], removes: [], swaps: [], edits: [] };
      }
      if (!newChanges[board].edits) {
        newChanges[board].edits = [];
      }
      newChanges[board].edits.splice(index, 1);

      setChanges(newChanges);
    },
    [changes, setChanges],
  );

  const editAddedCard = useCallback(
    async (addIndex: number, card: Card, board: BoardType) => {
      console.log('editAddedCard called:', { addIndex, board, cardTags: card.tags, cardID: card.cardID });
      const newChanges = deepCopy(changes);

      if (!newChanges[board]?.adds) {
        console.log('No adds array found for board:', board);
        return;
      }

      const originalCard = newChanges[board].adds[addIndex];
      console.log('Original card tags:', originalCard.tags);

      const newCardData = deepCopy(card);
      console.log('New card data tags after deepCopy:', newCardData.tags);

      // If the cardID changed, fetch new details
      if (originalCard.cardID !== newCardData.cardID && newCardData.cardID) {
        const newDetails = await getDetails(csrfFetch, newCardData.cardID);
        if (newDetails) {
          newCardData.details = newDetails;
        }
      } else if (originalCard.details && !newCardData.details) {
        // Preserve the details from the original card if they exist and cardID hasn't changed
        newCardData.details = originalCard.details;
      }

      delete newCardData.index;
      delete newCardData.board;

      console.log('About to set new card data with tags:', newCardData.tags);
      newChanges[board].adds[addIndex] = newCardData;
      setChanges(newChanges);
      console.log('Changes set, new adds array:', newChanges[board].adds);
    },
    [changes, setChanges, csrfFetch],
  );

  const editSwappedCard = useCallback(
    async (swapIndex: number, card: Card, board: BoardType) => {
      console.log('editSwappedCard called:', { swapIndex, board, cardTags: card.tags, cardID: card.cardID });
      const newChanges = deepCopy(changes);

      if (!newChanges[board]?.swaps) {
        console.log('No swaps array found for board:', board);
        return;
      }

      const originalCard = newChanges[board].swaps[swapIndex].card;
      console.log('Original swap card tags:', originalCard.tags);

      const newCardData = deepCopy(card);
      console.log('New card data tags after deepCopy:', newCardData.tags);

      // If the cardID changed, fetch new details
      if (originalCard.cardID !== newCardData.cardID && newCardData.cardID) {
        const newDetails = await getDetails(csrfFetch, newCardData.cardID);
        if (newDetails) {
          newCardData.details = newDetails;
        }
      } else if (originalCard.details && !newCardData.details) {
        // Preserve the details from the original card if they exist and cardID hasn't changed
        newCardData.details = originalCard.details;
      }

      delete newCardData.index;
      delete newCardData.board;

      console.log('About to set new swap card data with tags:', newCardData.tags);
      newChanges[board].swaps[swapIndex].card = newCardData;
      setChanges(newChanges);
      console.log('Changes set, new swaps array:', newChanges[board].swaps);
    },
    [changes, setChanges, csrfFetch],
  );

  const moveCard = useCallback(
    (index: number, board: BoardType, newBoard: BoardType) => {
      const newChanges = deepCopy(changes);

      if (!newChanges[board]) {
        newChanges[board] = { adds: [], removes: [], swaps: [], edits: [] };
      }
      if (!newChanges[board].removes) {
        newChanges[board].removes = [];
      }
      // if this card has already been removed, don't remove it again
      if (newChanges[board].removes.some((remove) => remove.index === index)) {
        return;
      }

      const oldCard = deepCopy(cube.cards[board][index]);
      delete oldCard.details;

      newChanges[board].removes.push({ index, oldCard });

      // remove swaps and edits that refer to this card
      const newSwaps = newChanges[board].swaps?.filter((s) => s.index !== index);
      const newEdits = newChanges[board].edits?.filter((e) => e.index !== index);

      newChanges[board].swaps = newSwaps;
      newChanges[board].edits = newEdits;

      if (!newChanges[newBoard]) {
        newChanges[newBoard] = { adds: [], removes: [], swaps: [], edits: [] };
      }
      if (!newChanges[newBoard].adds) {
        newChanges[newBoard].adds = [];
      }
      // now we add
      newChanges[newBoard].adds.push(oldCard);

      setChanges(newChanges);
      setOpenCollapse('edit');
    },
    [changes, cube.cards, setChanges, setOpenCollapse],
  );

  const moveAddedCard = useCallback(
    (addIndex: number, board: BoardType, newBoard: BoardType) => {
      if (board === newBoard) {
        return;
      }

      const newChanges = deepCopy(changes);

      if (!newChanges[board]?.adds || !newChanges[board].adds[addIndex]) {
        console.error('Card not found in adds array:', { addIndex, board });
        return;
      }

      // Get the card from the current board's adds array
      const cardToMove = deepCopy(newChanges[board].adds[addIndex]);

      // Remove it from the current board's adds array
      newChanges[board].adds.splice(addIndex, 1);

      // Ensure the new board has the proper structure
      if (!newChanges[newBoard]) {
        newChanges[newBoard] = { adds: [], removes: [], swaps: [], edits: [] };
      }
      if (!newChanges[newBoard].adds) {
        newChanges[newBoard].adds = [];
      }

      // Add it to the new board's adds array
      newChanges[newBoard].adds.push(cardToMove);

      setChanges(newChanges);
      setOpenCollapse('edit');
    },
    [changes, setChanges, setOpenCollapse],
  );

  const moveSwappedCard = useCallback(
    (swapIndex: number, board: BoardType, newBoard: BoardType) => {
      if (board === newBoard) {
        return;
      }

      const newChanges = deepCopy(changes);

      if (!newChanges[board]?.swaps || !newChanges[board].swaps[swapIndex]) {
        console.error('Card not found in swaps array:', { swapIndex, board });
        return;
      }

      // Get the swap entry from the current board's swaps array
      const swapEntry = deepCopy(newChanges[board].swaps[swapIndex]);
      const cardToMove = swapEntry.card;

      // Remove the swap from the current board since we're moving the card
      newChanges[board].swaps.splice(swapIndex, 1);

      // Ensure the new board has the proper structure
      if (!newChanges[newBoard]) {
        newChanges[newBoard] = { adds: [], removes: [], swaps: [], edits: [] };
      }
      if (!newChanges[newBoard].adds) {
        newChanges[newBoard].adds = [];
      }

      // Add the card to the new board's adds array
      // (it's now being added to a different board, not swapped)
      newChanges[newBoard].adds.push(cardToMove);

      setChanges(newChanges);
      setOpenCollapse('edit');
    },
    [changes, setChanges, setOpenCollapse],
  );

  const bulkMoveCard = useCallback(
    (cardList: { board: BoardType; index: number }[], newBoard: BoardType) => {
      const newChanges = deepCopy(changes);

      for (const card of cardList) {
        if (card.board !== undefined && card.index !== undefined && card.board !== newBoard) {
          if (!newChanges[card.board]) {
            newChanges[card.board] = { adds: [], removes: [], swaps: [], edits: [] };
          }
          // @ts-expect-error ts is incorrectly erroring here
          if (!newChanges[card.board].removes) {
            // @ts-expect-error ts is incorrectly erroring here
            newChanges[card.board].removes = [];
          }

          removeCardByIndexFromChangeset(newChanges[card.board]?.edits, card.index);

          // @ts-expect-error ts is incorrectly erroring here
          newChanges[card.board]?.removes.push({
            index: card.index,
            oldCard: cube.cards[card.board][card.index],
          });
        }
      }

      if (!newChanges[newBoard]) {
        newChanges[newBoard] = { adds: [], removes: [], swaps: [], edits: [] };
      }
      if (!newChanges[newBoard].adds) {
        newChanges[newBoard].adds = [];
      }
      newChanges[newBoard].adds.push(
        ...cardList.filter((card) => card.board !== newBoard).map(({ index, board }) => cube.cards[board][index]),
      );

      setChanges(newChanges);
      setOpenCollapse('edit');
    },
    [changes, cube.cards, setChanges, setOpenCollapse],
  );

  const bulkMoveCards = useCallback(
    (cards: Card[], newBoard: BoardType) => {
      // Check if these are newly added/swapped cards or existing cards
      const hasAddIndex = cards.some((card) => (card as any).addIndex !== undefined);
      const hasSwapIndex = cards.some((card) => (card as any).swapIndex !== undefined);

      if (hasAddIndex || hasSwapIndex) {
        // Handle newly added or swapped cards
        const newChanges = deepCopy(changes);

        // Group cards by their board and type (adds vs swaps)
        const cardsByBoard: Record<BoardType, { adds: Card[]; swaps: Card[] }> = {
          mainboard: { adds: [], swaps: [] },
          maybeboard: { adds: [], swaps: [] },
        };

        for (const card of cards) {
          if (card.board && card.board !== newBoard) {
            if ((card as any).addIndex !== undefined) {
              cardsByBoard[card.board].adds.push(card);
            } else if ((card as any).swapIndex !== undefined) {
              cardsByBoard[card.board].swaps.push(card);
            }
          }
        }

        // Process adds
        for (const board of boardTypes) {
          const addsToMove = cardsByBoard[board].adds;
          if (addsToMove.length > 0) {
            // Sort by addIndex in descending order to avoid index shifting issues
            const sortedAdds = addsToMove.sort((a, b) => (b as any).addIndex - (a as any).addIndex);

            for (const card of sortedAdds) {
              const addIndex = (card as any).addIndex;
              if (newChanges[board]?.adds && newChanges[board].adds[addIndex]) {
                const cardToMove = deepCopy(newChanges[board].adds[addIndex]);
                newChanges[board].adds.splice(addIndex, 1);

                // Ensure the new board has the proper structure
                if (!newChanges[newBoard]) {
                  newChanges[newBoard] = { adds: [], removes: [], swaps: [], edits: [] };
                }
                if (!newChanges[newBoard].adds) {
                  newChanges[newBoard].adds = [];
                }

                newChanges[newBoard].adds.push(cardToMove);
              }
            }
          }

          // Process swaps
          const swapsToMove = cardsByBoard[board].swaps;
          if (swapsToMove.length > 0) {
            // Sort by swapIndex in descending order to avoid index shifting issues
            const sortedSwaps = swapsToMove.sort((a, b) => (b as any).swapIndex - (a as any).swapIndex);

            for (const card of sortedSwaps) {
              const swapIndex = (card as any).swapIndex;
              if (newChanges[board]?.swaps && newChanges[board].swaps[swapIndex]) {
                const swapEntry = deepCopy(newChanges[board].swaps[swapIndex]);
                const cardToMove = swapEntry.card;
                newChanges[board].swaps.splice(swapIndex, 1);

                // Ensure the new board has the proper structure
                if (!newChanges[newBoard]) {
                  newChanges[newBoard] = { adds: [], removes: [], swaps: [], edits: [] };
                }
                if (!newChanges[newBoard].adds) {
                  newChanges[newBoard].adds = [];
                }

                newChanges[newBoard].adds.push(cardToMove);
              }
            }
          }
        }

        setChanges(newChanges);
        setOpenCollapse('edit');
      } else {
        // Handle existing cards - convert to the format expected by the original bulkMoveCard
        const cardList = cards
          .filter((card) => card.board !== undefined && card.index !== undefined)
          .map((card) => ({ board: card.board!, index: card.index! }));
        bulkMoveCard(cardList, newBoard);
      }
    },
    [changes, setChanges, setOpenCollapse, bulkMoveCard],
  );

  const removeCard = useCallback(
    (index: number, board: BoardType) => {
      const newChanges = deepCopy(changes);

      if (!newChanges[board]) {
        newChanges[board] = { adds: [], removes: [], swaps: [], edits: [] };
      }
      // if this card has already been removed, don't remove it again
      if (newChanges[board].removes?.some((remove) => remove.index === index)) {
        return;
      }

      const oldCard = deepCopy(cube.cards[board][index]);
      delete oldCard.details;

      if (!newChanges[board].removes) {
        newChanges[board].removes = [];
      }

      newChanges[board].removes.push({ index, oldCard });

      // remove swaps and edits that refer to this card
      const newSwaps = newChanges[board].swaps?.filter((s) => s.index !== index);
      const newEdits = newChanges[board].edits?.filter((e) => e.index !== index);

      newChanges[board].swaps = newSwaps;
      newChanges[board].edits = newEdits;

      setChanges(newChanges);
      setOpenCollapse('edit');
    },
    [changes, cube.cards, setChanges, setOpenCollapse],
  );

  const revertRemove = useCallback(
    (index: number, board: BoardType) => {
      const newChanges = deepCopy(changes);

      if (!newChanges[board]) {
        newChanges[board] = { adds: [], removes: [], swaps: [], edits: [] };
      }
      newChanges[board].removes?.splice(index, 1);

      setChanges(newChanges);
    },
    [changes, setChanges],
  );

  const [changedCards, unfilteredChangedCards] = useMemo(() => {
    const changed = deepCopy(cube.cards);

    if (useChangedCards) {
      for (const board of boardTypes) {
        if (changes[board]?.edits) {
          for (let i = 0; i < changes[board].edits.length; i++) {
            const edit = changes[board].edits[i];
            let card = changed[board][edit.index];
            changed[board][edit.index] = {
              ...card,
              ...edit.newCard,
              markedForDelete: false,
              editIndex: i,
            };

            if (versionDictProxy[normalizeName(cardName(card))] && edit.newCard.cardID !== card.cardID) {
              card = changed[board][edit.index];
              const newDetails = versionDictProxy[normalizeName(cardName(card))].find(
                (v) => v.scryfall_id === edit.newCard.cardID,
              );
              if (card.details !== undefined && newDetails !== undefined) {
                card.details = {
                  ...card.details,
                  ...newDetails,
                };
              }
            }
          }
        }
        if (changes[board]?.removes) {
          for (let i = changes[board].removes.length - 1; i >= 0; i--) {
            const remove = changes[board].removes[i];
            changed[board][remove.index].markedForDelete = true;
            changed[board][remove.index].removeIndex = i;
            delete changed[board][remove.index].editIndex;
          }
        }
      }
    }

    const result = {
      mainboard: changed.mainboard.filter(cardFilter.filter),
      maybeboard: changed.maybeboard.filter(cardFilter.filter),
    };

    if (filterInput !== '') {
      if (changed.maybeboard.length > 0) {
        setFilterResult({
          mainboard: [result.mainboard.length, changed.mainboard.length],
          maybeboard: [result.maybeboard.length, changed.maybeboard.length],
        });
      } else {
        setFilterResult({
          mainboard: [result.mainboard.length, changed.mainboard.length],
        });
      }
    } else {
      setFilterResult({});
    }

    return [result, changed];
  }, [cube.cards, useChangedCards, cardFilter, filterInput, changes, versionDictProxy]);

  const commitChanges = useCallback(
    async (title: string, blog: string) => {
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
            expectedVersion: changes.version,
          }),
        });

        const json = await result.json();

        if (json.success !== 'true') {
          setAlerts([{ color: 'danger', message: json.message }]);
        } else {
          const newCards = deepCopy(unfilteredChangedCards);

          const newCardsToFetchVersions = [];
          for (const board of boardTypes) {
            // swaps
            if (changes[board]?.swaps) {
              for (const swap of changes[board].swaps) {
                newCards[board][swap.index] = swap.card;
                const newDetails = await getDetails(csrfFetch, swap.card.cardID);
                if (newDetails !== null) {
                  newCards[board][swap.index].details = newDetails;
                }
              }
            }
            // removes
            if (changes[board]?.removes) {
              // sort removals desc
              const sorted = changes[board].removes.sort((a, b) => b.index - a.index);
              for (const remove of sorted) {
                newCards[board].splice(remove.index, 1);
              }
            }
            // adds
            if (changes[board]?.adds) {
              for (const add of changes[board].adds) {
                newCards[board].push({
                  ...add,
                });
                const newDetails = await getDetails(csrfFetch, add.cardID);
                if (newDetails !== null) {
                  newCards[board][newCards[board].length - 1].details = newDetails;
                }
                newCardsToFetchVersions.push(add.cardID);
              }
            }

            for (let i = 0; i < newCards[board].length; i++) {
              newCards[board][i].index = i;
              newCards[board][i].board = board;
            }
          }

          // strip editIndex
          for (const board of boardTypes) {
            for (const card of newCards[board]) {
              delete card.markedForDelete;
              delete card.editIndex;
              delete card.removeIndex;
            }
          }

          setModalSelection([]);
          // Update version BEFORE clearing changes so new changes get the correct version
          const newVersion = json.version || version + 1;
          setVersion(newVersion);
          clearChanges();
          setCube({
            ...cube,
            cards: newCards,
            version: newVersion, // Update cube version too
          });
          const newTags = getAllTags(newCards);
          //Make sure to use tagColors instead of cube.tagColors so any previous edits apply
          setTagColors(computeTagColors(tagColors, newTags));
        }
      } catch {
        setAlerts([{ color: 'danger', message: 'Operation timed out' }]);
      }

      setModalSelection([]);
      setLoading(false);
    },
    [csrfFetch, changes, cube, useBlog, unfilteredChangedCards, clearChanges, setVersion, version, tagColors],
  );

  const bulkEditCard = useCallback(
    (list: { index: number; board: BoardType }[]) => {
      const newChanges = deepCopy(changes);

      for (const edit of list) {
        if (!newChanges[edit.board]) {
          newChanges[edit.board] = { adds: [], removes: [], swaps: [], edits: [] };
        }

        // don't push an edit if this card is marked for delete
        if (!changes[edit.board]?.removes?.some((remove) => remove.index === edit.index)) {
          const card = cube.cards[edit.board][edit.index];

          const oldCard = deepCopy(cube.cards[edit.board][edit.index]);
          delete oldCard.details;

          const newCard = {
            ...card,
            ...edit,
            markedForDelete: false,
            editIndex: newChanges[edit.board]?.edits?.length,
          };
          delete newCard.details;

          const edits = newChanges[edit.board]?.edits || [];

          // if this card has already been edited, overwrite the edit
          const index = edits.findIndex((e) => e.index === edit.index);
          if (index !== -1 && edits) {
            edits[index].newCard = newCard;
          } else {
            newChanges[edit.board]?.edits?.push({ index: edit.index, newCard, oldCard });
          }
        }
      }
      setChanges(newChanges);
      setOpenCollapse('edit');
    },
    [changes, setChanges, setOpenCollapse, cube.cards],
  );

  const bulkRevertEdit = useCallback(
    (list: { index: number; board: BoardType }[]) => {
      const newChanges = deepCopy(changes);

      for (const edit of list) {
        removeCardByIndexFromChangeset(newChanges[edit.board]?.edits, edit.index);
      }

      setChanges(newChanges);
    },
    [changes, setChanges],
  );

  const bulkRemoveCard = useCallback(
    (list: { index: number; board: BoardType }[]) => {
      const newChanges = deepCopy(changes);

      for (const remove of list) {
        // if this card has been edited, remove the edit
        if (newChanges[remove.board]?.edits) {
          removeCardByIndexFromChangeset(newChanges[remove.board]?.edits, remove.index);
        }

        // if this card has been swapped, remove the swap
        if (newChanges[remove.board]?.swaps) {
          removeCardByIndexFromChangeset(newChanges[remove.board]?.swaps, remove.index);
        }

        if (!newChanges[remove.board]) {
          newChanges[remove.board] = { adds: [], removes: [], swaps: [], edits: [] };
        }

        const removes = newChanges[remove.board]?.removes || [];
        const removeIndex = removes.findIndex((e) => e.index === remove.index);
        //Don't add the same card to the removals list
        if (removeIndex === -1 && removes) {
          newChanges[remove.board]?.removes?.push({
            index: remove.index,
            oldCard: cube.cards[remove.board][remove.index],
          });
        }
      }

      setChanges(newChanges);
      setOpenCollapse('edit');
    },
    [changes, setChanges, setOpenCollapse, cube.cards],
  );

  const bulkRevertRemove = useCallback(
    (list: { index: number; board: BoardType }[]) => {
      const newChanges = deepCopy(changes);

      for (const remove of list) {
        removeCardByIndexFromChangeset(newChanges[remove.board]?.removes, remove.index);
      }

      setChanges(newChanges);
    },
    [changes, setChanges],
  );

  const bulkEditNewCard = useCallback(
    async (cards: Card[]) => {
      console.log('bulkEditNewCard called with cards:', cards);

      // Create a single deep copy that we'll modify for all cards
      const newChanges = deepCopy(changes);

      for (const card of cards) {
        // Determine if this is an added card or a swapped card
        const { board, addIndex, swapIndex } = card as Card & {
          addIndex?: number;
          swapIndex?: number;
        };

        console.log('Processing card:', { board, addIndex, swapIndex, cardID: card.cardID });

        if (board && addIndex !== undefined) {
          // Update added card
          console.log('Updating added card at index:', addIndex);
          if (newChanges[board]?.adds?.[addIndex]) {
            const originalCard = newChanges[board].adds[addIndex];
            const newCardData = deepCopy(card);

            // If the cardID changed, fetch new details
            if (originalCard.cardID !== newCardData.cardID && newCardData.cardID) {
              const newDetails = await getDetails(csrfFetch, newCardData.cardID);
              if (newDetails) {
                newCardData.details = newDetails;
              }
            } else if (originalCard.details && !newCardData.details) {
              // Preserve the details from the original card if they exist
              newCardData.details = originalCard.details;
            }

            delete newCardData.index;
            delete newCardData.board;
            delete (newCardData as any).addIndex;
            delete (newCardData as any).swapIndex;

            console.log('Setting added card with tags:', newCardData.tags);
            newChanges[board].adds[addIndex] = newCardData;
          }
        } else if (board && swapIndex !== undefined) {
          // Update swapped card
          console.log('Updating swapped card at index:', swapIndex);
          if (newChanges[board]?.swaps?.[swapIndex]) {
            const originalCard = newChanges[board].swaps[swapIndex].card;
            const newCardData = deepCopy(card);

            // If the cardID changed, fetch new details
            if (originalCard.cardID !== newCardData.cardID && newCardData.cardID) {
              const newDetails = await getDetails(csrfFetch, newCardData.cardID);
              if (newDetails) {
                newCardData.details = newDetails;
              }
            } else if (originalCard.details && !newCardData.details) {
              // Preserve the details from the original card if they exist
              newCardData.details = originalCard.details;
            }

            delete newCardData.index;
            delete newCardData.board;
            delete (newCardData as any).addIndex;
            delete (newCardData as any).swapIndex;

            console.log('Setting swapped card with tags:', newCardData.tags);
            newChanges[board].swaps[swapIndex].card = newCardData;
          }
        } else {
          console.log('Card does not match added or swapped criteria');
        }
      }

      // Set changes once with all updates
      console.log('Setting all changes at once');
      setChanges(newChanges);
    },
    [changes, setChanges, csrfFetch],
  );

  const canEdit = !!user && cube.owner?.id === user.id;

  const hasCustomImages = useMemo(
    () =>
      [changedCards.mainboard, changedCards.maybeboard].some((list) => {
        return list.some(
          (card) => (card.imgUrl && card.imgUrl.length > 0) || (card.imgBackUrl && card.imgBackUrl.length > 0),
        );
      }),
    [changedCards],
  );

  const setShowUnsorted = useCallback(
    async (value: boolean) => {
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
    [csrfFetch, cube, setCube],
  );

  const setCollapseDuplicateCards = useCallback(
    async (value: boolean) => {
      setLoading(true);
      setCube({
        ...cube,
        collapseDuplicateCards: value,
      });

      await csrfFetch(`/cube/api/savesorts/${cube.id}`, {
        method: 'POST',
        body: JSON.stringify({
          sorts: cube.defaultSorts,
          showUnsorted: cube.showUnsorted,
          collapseDuplicateCards: value,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      setLoading(false);
    },
    [csrfFetch, cube, setCube],
  );

  const saveSorts = useCallback(async () => {
    const currentSorts = [
      sortPrimary ?? defaultSorts[0],
      sortSecondary ?? defaultSorts[1],
      sortTertiary ?? defaultSorts[2],
      sortQuaternary ?? defaultSorts[3],
    ];
    setLoading(true);
    setCube({
      ...cube,
      defaultSorts: currentSorts,
    });
    await csrfFetch(`/cube/api/savesorts/${cube.id}`, {
      method: 'POST',
      body: JSON.stringify({
        sorts: currentSorts,
        showUnsorted: cube.showUnsorted,
        collapseDuplicateCards: cube.collapseDuplicateCards,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    setLoading(false);
  }, [sortPrimary, defaultSorts, sortSecondary, sortTertiary, sortQuaternary, cube, csrfFetch]);

  const resetSorts = useCallback(() => {
    const defaultSorts = getCubeSorts(cube);
    setSortPrimary(defaultSorts[0]);
    setSortSecondary(defaultSorts[1]);
    setSortTertiary(defaultSorts[2]);
    setSortQuaternary(defaultSorts[3]);
  }, [cube, setSortPrimary, setSortSecondary, setSortTertiary, setSortQuaternary]);

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
      editAddedCard,
      editSwappedCard,
      clearChanges,
      changes,
      revertAdd,
      revertRemove,
      revertSwap,
      revertEdit,
      versionDict: versionDictProxy,
      fetchVersionsForCard,
      commitChanges,
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
      bulkEditNewCard,
      alerts,
      setAlerts,
      loading,
      setShowUnsorted,
      setCollapseDuplicateCards,
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
      editAddedCard,
      editSwappedCard,
      clearChanges,
      changes,
      revertAdd,
      revertRemove,
      revertSwap,
      revertEdit,
      versionDictProxy,
      fetchVersionsForCard,
      commitChanges,
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
      bulkEditNewCard,
      alerts,
      setAlerts,
      loading,
      setShowUnsorted,
      setCollapseDuplicateCards,
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
          Object.prototype.hasOwnProperty.call(modalSelection, 'isNewlyAdded') &&
          (modalSelection as any).isNewlyAdded &&
          changes[modalSelection.board]?.adds?.[(modalSelection as any).addIndex] && (
            <CardModal
              card={{
                ...changes[modalSelection.board]!.adds![(modalSelection as any).addIndex],
                board: modalSelection.board,
                index: -1, // Use -1 as a sentinel value for newly added cards
                details: addedCardDetails || undefined,
              }}
              isOpen={modalOpen}
              setOpen={setModalOpen}
              canEdit={canEdit}
              versionDict={versionDictProxy}
              fetchVersionsForCard={fetchVersionsForCard}
              editCard={(_, card, board) => editAddedCard((modalSelection as any).addIndex, card, board)}
              revertEdit={() => {}}
              revertRemove={() => {}}
              removeCard={() => {}}
              tagColors={tagColors}
              moveCard={(_, board, newBoard) => moveAddedCard((modalSelection as any).addIndex, board, newBoard)}
              allTags={allTags}
            />
          )}
        {modalSelection &&
          !Array.isArray(modalSelection) &&
          Object.prototype.hasOwnProperty.call(modalSelection, 'isSwapped') &&
          (modalSelection as any).isSwapped &&
          changes[modalSelection.board]?.swaps?.[(modalSelection as any).swapIndex] && (
            <CardModal
              card={{
                ...changes[modalSelection.board]!.swaps![(modalSelection as any).swapIndex].card,
                board: modalSelection.board,
                index: -1, // Use -1 as a sentinel value for swapped cards
                details: addedCardDetails || undefined,
              }}
              isOpen={modalOpen}
              setOpen={setModalOpen}
              canEdit={canEdit}
              versionDict={versionDictProxy}
              fetchVersionsForCard={fetchVersionsForCard}
              editCard={(_, card, board) => editSwappedCard((modalSelection as any).swapIndex, card, board)}
              revertEdit={() => {}}
              revertRemove={() => {}}
              removeCard={() => {}}
              tagColors={tagColors}
              moveCard={(_, board, newBoard) => moveSwappedCard((modalSelection as any).swapIndex, board, newBoard)}
              allTags={allTags}
            />
          )}
        {modalSelection &&
          !Array.isArray(modalSelection) &&
          !Object.prototype.hasOwnProperty.call(modalSelection, 'isNewlyAdded') &&
          !Object.prototype.hasOwnProperty.call(modalSelection, 'isSwapped') &&
          unfilteredChangedCards[modalSelection.board].find((card) => card.index === modalSelection.index) && (
            <CardModal
              card={unfilteredChangedCards[modalSelection.board].find((card) => card.index === modalSelection.index)!}
              isOpen={modalOpen}
              setOpen={setModalOpen}
              canEdit={canEdit}
              versionDict={versionDictProxy}
              fetchVersionsForCard={fetchVersionsForCard}
              editCard={editCard}
              revertEdit={revertEdit}
              revertRemove={revertRemove}
              removeCard={removeCard}
              tagColors={tagColors}
              moveCard={moveCard}
              allTags={allTags}
            />
          )}
        {modalSelection && Array.isArray(modalSelection) && modalSelection.length > 0 && (
          <GroupModal
            cards={
              // Check if this is a list of new cards (with addIndex or swapIndex)
              Object.prototype.hasOwnProperty.call(modalSelection[0], 'addIndex') ||
              Object.prototype.hasOwnProperty.call(modalSelection[0], 'swapIndex')
                ? (modalSelection as Card[])
                : modalSelection.map((s) => unfilteredChangedCards[s.board][s.index])
            }
            isOpen={modalOpen}
            setOpen={setModalOpen}
            canEdit={canEdit}
            bulkEditCard={
              // Use bulkEditNewCard for new cards, bulkEditCard for existing cards
              Object.prototype.hasOwnProperty.call(modalSelection[0], 'addIndex') ||
              Object.prototype.hasOwnProperty.call(modalSelection[0], 'swapIndex')
                ? (cards: Card[]) => bulkEditNewCard(cards)
                : (cards: Card[]) => bulkEditCard(cards as any)
            }
            bulkRevertEdit={bulkRevertEdit}
            bulkRemoveCard={bulkRemoveCard}
            bulkRevertRemove={bulkRevertRemove}
            setModalSelection={(cards: any) => setModalSelection(cards)}
            tagColors={tagColors}
            bulkMoveCard={bulkMoveCard}
            bulkMoveCards={bulkMoveCards}
            allTags={allTags}
          />
        )}
      </>
    </CubeContext.Provider>
  );
}

export default CubeContext;
