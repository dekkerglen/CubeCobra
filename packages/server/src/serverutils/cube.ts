import * as cardutil from '@utils/cardutil';
import Card, { BoardChanges, Changes } from '@utils/datatypes/Card';
import { boardNameToKey, CubeCards } from '@utils/datatypes/Cube';
import { CUBE_VISIBILITY } from '@utils/datatypes/Cube';
import { FeedTypes } from '@utils/datatypes/Feed';
import { blogDao, changelogDao, cubeDao, feedDao, userDao } from 'dynamo/daos';

import { Request, Response } from '../types/express';
import { cardFromId, getIdsFromName, getMostReasonable } from './carddb';
import cloudwatch from './cloudwatch';
import { CSVtoCards } from './cubefn';
import { handleRouteError, redirect, render } from './render';

const CARD_HEIGHT = 680;
const CARD_WIDTH = 488;
const CSV_HEADER =
  'name,CMC,Type,Color,Set,Collector Number,Rarity,Color Category,status,Finish,board,maybeboard,image URL,image Back URL,tags,Notes,MTGO ID,Custom,Voucher';

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
    if ((lines[0].match(/,/g) || []).length > 3) {
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
        // separate counts and sets from the name
        //                              |    count?   |name|     (set)?         c.num? |
        const splitLine = item.match(/^(?:([0-9]+)x? )?(.*?)(?: \(([^)(]+)\)(?: (\S+))?)?$/);
        if (!splitLine) continue;

        const name = splitLine[2];
        const set = splitLine[3];
        const collectorNum = splitLine[4];
        let count = parseInt(splitLine[1] || '1', 10);
        if (!Number.isInteger(count)) {
          count = 1;
        }

        let selectedId: string | null = null;
        if (set && name) {
          const potentialIds = getIdsFromName(name);
          if (potentialIds && potentialIds.length > 0) {
            const matchingItem = potentialIds.find((id) => {
              const card = cardFromId(id);
              return (
                card.set.toLowerCase() === set.toLowerCase() &&
                (!collectorNum || card.collector_number === collectorNum)
              );
            });
            // if no sets match, just take the first ID ¯\_(ツ)_/¯
            selectedId = matchingItem || potentialIds[0] || null;
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
  let { imgUrl, imgBackUrl } = card;
  if (imgUrl) {
    imgUrl = `"${imgUrl}"`;
  } else {
    imgUrl = '';
  }
  if (imgBackUrl) {
    imgBackUrl = `"${imgBackUrl}"`;
  } else {
    imgBackUrl = '';
  }

  const colorColors = cardutil.cardColors(card);
  const colorCategory = cardutil.convertFromLegacyCardColorCategory(card.colorCategory || '');

  res.write(`"${cardutil.cardName(card).replace(/"/g, '""')}",`);
  res.write(`${cardutil.cardCmc(card)},`);
  res.write(`"${cardutil.cardType(card).replace('—', '-')}",`);
  res.write(`${colorColors.join('')},`);
  res.write(`"${cardutil.cardSet(card)}",`);
  res.write(`"${cardutil.cardCollectorNumber(card)}",`);
  res.write(`${cardutil.cardRarity(card)},`);
  res.write(`${colorCategory},`);
  res.write(`${cardutil.cardStatus(card) || ''},`);
  res.write(`${cardutil.cardFinish(card)},`);
  res.write(`${boardName},`);
  res.write(`${boardName === 'maybeboard'},`);
  res.write(`${imgUrl},`);
  res.write(`${imgBackUrl},"`);
  cardutil.cardTags(card).forEach((tag, tagIndex) => {
    if (tagIndex !== 0) {
      res.write(';');
    }
    res.write(tag);
  });
  res.write(`","${cardutil.cardNotes(card)}",`);
  res.write(`${cardutil.cardMtgoId(card)},`);
  res.write(`${cardutil.isCustomCard(card) ? 'true' : 'false'},`);
  res.write(`${cardutil.isVoucher(card) ? 'true' : 'false'}`);
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
const getBasicsFromCube = (
  cubeCards: Record<string, Array<{ cardID: string }>>,
  basicsBoard?: string,
  legacyBasics?: string[],
): string[] => {
  // If a basicsBoard is specified and exists in the cube, use cards from that board
  // basicsBoard may be a display name (e.g. "Basics") - normalize via boardNameToKey
  if (basicsBoard) {
    const boardKey = boardNameToKey(basicsBoard);
    if (cubeCards[boardKey]) {
      return cubeCards[boardKey].map((card) => card.cardID);
    }
  }

  // Fall back to legacy basics array for backwards compatibility
  return legacyBasics || [];
};

const addBasics = (document: DraftDocument, basics: string[]) => {
  if (!document.cards) {
    throw new Error('Document must contains cards to add basics');
  }

  const populatedBasics = basics.map((cardID) => {
    const details = cardFromId(cardID);
    const populatedCard = {
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
  bulkUpload,
  CARD_HEIGHT,
  CARD_WIDTH,
  createPool,
  CSV_HEADER,
  exportToMtgo,
  getBasicsFromCube,
  reverseArray,
  rotateArrayLeft,
  rotateArrayRight,
  shuffle,
  updateCubeAndBlog,
  writeCard,
};
