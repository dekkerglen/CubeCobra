import * as cardutil from '@utils/cardutil';
import Card, { BoardChanges, Changes } from '@utils/datatypes/Card';
import { boardNameToKey, CubeCards } from '@utils/datatypes/Cube';
import { CUBE_VISIBILITY } from '@utils/datatypes/Cube';
import { FeedTypes } from '@utils/datatypes/Feed';
import { blogDao, changelogDao, cubeDao, feedDao, userDao } from 'dynamo/daos';

import { Request, Response } from '../types/express';
import { cardFromId, getIdsFromName, getMostReasonable } from './carddb';
import cloudwatch from './cloudwatch';
import { csvRow } from './csv';
import { CSVtoCards } from './cubefn';
import { IMPORT_TOO_LARGE_MESSAGE, MAX_IMPORT_CARDS, parseNonCSVLine } from './importParsing';
import { handleRouteError, redirect, render } from './render';

const CARD_HEIGHT = 680;
const CARD_WIDTH = 488;
const CSV_HEADER =
  'name,CMC,Type,Color,Set,Collector Number,Rarity,Color Category,status,Finish,board,maybeboard,image URL,image Back URL,tags,Notes,MTGO ID,Custom,Voucher,Artist';

interface Cube {
  id: string;
  shortId?: string;
  defaultPrinting?: string;
  defaultStatus?: string;
  likeCount?: number;
  visibility: string;
}

async function updateCubeAndBlog(
  req: Request,
  res: Response,
  cube: Cube,
  cards: CubeCards,
  cardsToWrite: CubeCards,
  changelog: Changes,
  added: Card[],
  missing: string[],
) {
  try {
    if (missing.length > 0) {
      return render(req, res, 'BulkUploadPage', {
        cube,
        cards,
        canEdit: true,
        cubeID: req.params.id,
        missing,
        added: added.map((add) => add.cardID || (add as any).scryfall_id),
        addedByBoard: {
          mainboard: added.map((add) => add.cardID || (add as any).scryfall_id),
        },
      });
    }

    if (changelog.mainboard) {
      const mainboard = changelog.mainboard as BoardChanges;
      if (mainboard.adds && mainboard.adds.length === 0) {
        delete mainboard.adds;
      }
      if (mainboard.removes && mainboard.removes.length === 0) {
        delete mainboard.removes;
      }
      if (mainboard.swaps && mainboard.swaps.length === 0) {
        delete mainboard.swaps;
      }
      if (mainboard.edits && mainboard.edits.length === 0) {
        delete mainboard.edits;
      }
      if (Object.keys(mainboard).length === 0) {
        delete changelog.mainboard;
      }
    }

    // Clean up empty changelog entries for all boards
    for (const boardKey of Object.keys(changelog)) {
      if (boardKey === 'mainboard' || boardKey === 'version') continue;
      const boardChanges = changelog[boardKey] as BoardChanges;
      if (!boardChanges || typeof boardChanges !== 'object') continue;
      if (boardChanges.adds && boardChanges.adds.length === 0) {
        delete boardChanges.adds;
      }
      if (boardChanges.removes && boardChanges.removes.length === 0) {
        delete boardChanges.removes;
      }
      if (boardChanges.swaps && boardChanges.swaps.length === 0) {
        delete boardChanges.swaps;
      }
      if (boardChanges.edits && boardChanges.edits.length === 0) {
        delete boardChanges.edits;
      }
      if (Object.keys(boardChanges).length === 0) {
        delete changelog[boardKey];
      }
    }

    if (Object.keys(changelog).length > 0) {
      await cubeDao.updateCards(cube.id, cardsToWrite);

      const changelist = await changelogDao.createChangelog(changelog, cube.id);

      try {
        const id = await blogDao.createBlog({
          owner: req.user!.id,
          cube: cube.id,
          title: 'Cube Bulk Import - Automatic Post',
          changelist,
        });

        // Only publish to follower feeds if the cube is public
        if (cube.visibility === CUBE_VISIBILITY.PUBLIC) {
          const [cubeLikers, userFollowers] = await Promise.all([
            cubeDao.getAllLikers(cube.id),
            userDao.getAllFollowers(req.user!.id),
          ]);
          const followers = [...new Set([...userFollowers, ...cubeLikers])];

          const feedItems = followers.map((user) => ({
            id,
            to: user,
            date: new Date().valueOf(),
            type: FeedTypes.BLOG,
          }));

          await feedDao.batchPutUnhydrated(feedItems);
        }
      } catch (blogErr) {
        // Log the error but don't fail the entire operation
        // The cube update and changelog were successful
        cloudwatch.error('Failed to create blog post after bulk replace', blogErr);
        req.flash(
          'warning',
          'Cards updated successfully, but failed to create blog post. You can create one manually.',
        );
      }

      req.flash('success', 'All cards successfully added.');
    } else {
      req.flash('danger', 'No changes made.');
    }

    return redirect(req, res, `/cube/list/${encodeURIComponent(req.params.id!)}`);
  } catch (err) {
    return handleRouteError(req, res, err, `/cube/list/${encodeURIComponent(req.params.id!)}`);
  }
}

async function bulkUpload(req: Request, res: Response, list: string, cube: Cube) {
  const cards = await cubeDao.getCards(cube.id);

  // The default board for plain text imports comes from the request body
  const defaultBoard = req.body.board || 'mainboard';

  const lines = list.match(/[^\r\n]+/g);
  let missing: string[] = [];
  const added: (Card | any)[] = [];
  const addedByBoard: Record<string, any[]> = {};

  if (lines) {
    // Detect CSV by looking for the required `name` header column on the first line, rather than
    // counting commas. Comma-counting mis-classifies a single-column (name-only) CSV export as
    // plain text, which then fails to parse quoted names containing commas.
    const isCSV = /(^|,)\s*"?name"?\s*(,|$)/i.test(lines[0]);
    if (isCSV) {
      // upload is in CSV format - CSVtoCards handles board assignment via "board" / "maybeboard" columns
      const { cardsByBoard, missing: csvMissing } = CSVtoCards(list);
      missing = csvMissing;

      for (const [boardName, boardCards] of Object.entries(cardsByBoard)) {
        if (!addedByBoard[boardName]) {
          addedByBoard[boardName] = [];
        }
        for (const card of boardCards) {
          added.push(card);
          // Push full card objects so metadata (tags, notes, finish, etc.) is preserved
          addedByBoard[boardName].push(card);
        }
      }
    } else {
      // upload is in TXT format - all cards go to the selected default board
      for (const itemUntrimmed of lines) {
        const item = itemUntrimmed.trim();
        // Separate the count, name, edition (set) and collector number from the line. Handles the
        // "quantity name set number" shapes emitted by tools like Delver Lens and ManaPools, with
        // the edition wrapped in either [] or () and the collector number optional.
        const parsed = parseNonCSVLine(item);
        if (!parsed) continue;

        const { name, set, collectorNumber, count } = parsed;

        let selectedId: string | null = null;
        if (set && name) {
          const potentialIds = getIdsFromName(name);
          if (potentialIds && potentialIds.length > 0) {
            const lowerSet = set.toLowerCase();
            // Prefer an exact set + collector number match, then any printing in the set, and only
            // then fall back to the first printing so the edition is respected as far as possible.
            const matchingSetAndNumber = collectorNumber
              ? potentialIds.find((id) => {
                  const card = cardFromId(id);
                  return (
                    card.set.toLowerCase() === lowerSet &&
                    (card.collector_number || '').toLowerCase() === collectorNumber.toLowerCase()
                  );
                })
              : undefined;
            const matchingSet = potentialIds.find((id) => cardFromId(id).set.toLowerCase() === lowerSet);
            selectedId = matchingSetAndNumber || matchingSet || potentialIds[0] || null;
          }
        } else if (name) {
          const selectedCard = getMostReasonable(name, cube.defaultPrinting as any);
          selectedId = selectedCard ? selectedCard.scryfall_id : null;
        }

        if (selectedId) {
          const details = cardFromId(selectedId);
          if (!details.error) {
            if (!addedByBoard[defaultBoard]) {
              addedByBoard[defaultBoard] = [];
            }
            if (added.length + count > MAX_IMPORT_CARDS) {
              throw new Error(IMPORT_TOO_LARGE_MESSAGE);
            }
            for (let i = 0; i < count; i++) {
              added.push(details);
              addedByBoard[defaultBoard].push(selectedId);
            }
          }
        } else {
          missing.push(item);
        }
      }
    }
  }

  // Always go to the confirmation page so the user can review before committing
  return render(req, res, 'BulkUploadPage', {
    cube,
    cards,
    canEdit: true,
    cubeID: req.params.id,
    missing,
    added: added.map((add) => add.cardID || (add as any).scryfall_id),
    addedByBoard,
  });
}

function writeCard(res: Response, card: Card, boardName: string) {
  if (!card.type_line) {
    card.type_line = cardFromId(card.cardID).type;
  }
  //Explicitly not using cardutil functions here so that we get override images or nothing.
  //Using cardutil would default to the Scryfall image URLs
  const { imgUrl, imgBackUrl } = card;

  const colorColors = cardutil.cardColors(card);
  const colorCategory = cardutil.convertFromLegacyCardColorCategory(card.colorCategory || '');

  // Every cell goes through csvCell: most of these are user-editable (custom names, tags, notes,
  // image URLs), and spreadsheets would otherwise run a cell starting with = + - @ as a formula.
  res.write(
    csvRow([
      cardutil.cardName(card),
      cardutil.cardCmc(card),
      cardutil.cardType(card).replace('—', '-'),
      colorColors.join(''),
      cardutil.cardSet(card),
      cardutil.cardCollectorNumber(card),
      cardutil.cardRarity(card),
      colorCategory,
      cardutil.cardStatus(card) || '',
      cardutil.cardFinish(card),
      boardName,
      boardName === 'maybeboard',
      imgUrl || '',
      imgBackUrl || '',
      cardutil.cardTags(card).join(';'),
      cardutil.cardNotes(card),
      cardutil.cardMtgoId(card),
      cardutil.isCustomCard(card) ? 'true' : 'false',
      cardutil.isVoucher(card) ? 'true' : 'false',
      cardutil.cardArtist(card),
    ]),
  );
  res.write('\r\n');
}

const exportToMtgo = (
  res: Response,
  fileName: string,
  mainCards: Card[] | any[][],
  sideCards: Card[] | any[][],
  cards?: Card[],
) => {
  res.setHeader('Content-disposition', `attachment; filename=${fileName.replace(/\W/g, '')}.txt`);
  res.setHeader('Content-type', 'text/plain');
  res.charset = 'UTF-8';

  exportBoardToMtgo(res, mainCards, cards);
  res.write('\r\n\r\n');
  exportBoardToMtgo(res, sideCards, cards);
  return res.end();
};

const exportBoardToMtgo = (res: Response, boardCards: Card[] | any[][], allCards?: Card[]) => {
  const cardSet: Record<string, number> = {};
  const flatCards = Array.isArray(boardCards[0]) ? boardCards.flat() : boardCards;

  for (const cardIndex of flatCards) {
    const cardID = cardIndex.cardID || allCards?.[cardIndex]?.cardID;
    if (!cardID) continue;
    const { name } = cardFromId(cardID);
    if (cardSet[name]) {
      cardSet[name] += 1;
    } else {
      cardSet[name] = 1;
    }
  }
  for (const [key, value] of Object.entries(cardSet)) {
    const name = key.replace(' // ', '/');
    res.write(`${value} ${name}\r\n`);
  }
};

const shuffle = <T>(a: T[]): T[] => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = a[i];
    a[i] = a[j]!;
    a[j] = temp!;
  }
  return a;
};

interface DraftDocument {
  cards?: Array<{ cardID: string; index: number; isUnlimited?: boolean; type_line: string }>;
  basics?: number[];
}

/**
 * Get basics from a cube - either from a specific board or from the legacy cube.basics array
 * @param cubeCards - The cube's card data (all boards)
 * @param basicsBoard - Optional board name to pull basics from (e.g., "Basics")
 * @param legacyBasics - Legacy basics array (card IDs) as fallback
 * @returns Array of basic land card IDs
 */
type BasicCard = Partial<Card> & { cardID: string };

/**
 * Like getBasicsFromCube, but returns the cube's card objects so per-card customizations
 * (custom images, finish) survive. Legacy basics are bare IDs and are wrapped as `{ cardID }`.
 */
const getBasicCardsFromCube = (
  cubeCards: Record<string, any>,
  basicsBoard?: string,
  legacyBasics?: string[],
): BasicCard[] => {
  // 'None' is the explicit opt-out: the cube chose to add no basics at all. Treat
  // it as no basics rather than falling through to the legacy cube.basics array —
  // otherwise a cube with "None" selected still has basics injected.
  if (basicsBoard === 'None') {
    return [];
  }

  // If a basicsBoard is specified and exists in the cube, use cards from that board
  // basicsBoard may be a display name (e.g. "Basics") - normalize via boardNameToKey
  if (basicsBoard) {
    const boardKey = boardNameToKey(basicsBoard);
    if (Array.isArray(cubeCards[boardKey])) {
      return cubeCards[boardKey];
    }
  }

  // Fall back to legacy basics array for backwards compatibility
  return (legacyBasics || []).map((cardID) => ({ cardID }));
};

const getBasicsFromCube = (
  cubeCards: Record<string, Array<{ cardID: string }>>,
  basicsBoard?: string,
  legacyBasics?: string[],
): string[] => getBasicCardsFromCube(cubeCards, basicsBoard, legacyBasics).map((card) => card.cardID);

/**
 * The board a cube keeps its basics on.
 *
 * A cube that never set `basicsBoard` explicitly — the common case — still keeps its basics
 * on the conventional "Basics" board, so passing the raw field through would fall to the
 * legacy `cube.basics` array, which modern cubes leave empty. The explicit 'None' opt-out is
 * preserved so getBasicCardsFromCube can honor it.
 */
const basicsBoardFor = (cube: { basicsBoard?: string }): string => cube.basicsBoard || 'Basics';

const addBasics = (document: DraftDocument, basics: BasicCard[]) => {
  if (!document.cards) {
    throw new Error('Document must contains cards to add basics');
  }

  const populatedBasics = basics.map((basic) => {
    const details = cardFromId(basic.cardID);
    const populatedCard = {
      // Carry the cube card over (as createDraft does for pack cards) so custom
      // images and finish on the Basics board reach the deck.
      ...basic,
      cardID: details.scryfall_id,
      index: document.cards!.length,
      isUnlimited: true,
      type_line: details.type,
    };
    document.cards!.push(populatedCard);
    return populatedCard;
  });
  document.basics = populatedBasics.map(({ index }) => index);
};

const createPool = (): any[][][] => {
  const pool: any[][][] = [];
  for (let i = 0; i < 2; i++) {
    pool.push([]);
    for (let j = 0; j < 8; j++) {
      pool[i]!.push([]);
    }
  }
  return pool;
};

const reverseArray = <T>(arr: T[], start: number, end: number): void => {
  while (start < end) {
    const temp = arr[start];
    arr[start] = arr[end]!;
    arr[end] = temp!;
    start += 1;
    end -= 1;
  }
};

const rotateArrayRight = <T>(arr: T[], k: number): T[] => {
  k %= arr.length;
  reverseArray(arr, 0, arr.length - 1);
  reverseArray(arr, 0, k - 1);
  reverseArray(arr, k, arr.length - 1);

  return arr;
};

const rotateArrayLeft = <T>(arr: T[], k: number): T[] => rotateArrayRight(arr, arr.length - (k % arr.length));

export {
  addBasics,
  basicsBoardFor,
  bulkUpload,
  CARD_HEIGHT,
  CARD_WIDTH,
  createPool,
  CSV_HEADER,
  exportToMtgo,
  getBasicCardsFromCube,
  getBasicsFromCube,
  reverseArray,
  rotateArrayLeft,
  rotateArrayRight,
  shuffle,
  updateCubeAndBlog,
  writeCard,
};
