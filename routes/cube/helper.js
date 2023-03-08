const carddb = require('../../serverjs/carddb');
const { render } = require('../../serverjs/render');
const util = require('../../serverjs/util');
const { CSVtoCards } = require('../../serverjs/cubefn');

// Bring in models
const Cube = require('../../dynamo/models/cube');
const Blog = require('../../dynamo/models/blog');
const Feed = require('../../dynamo/models/feed');
const Changelog = require('../../dynamo/models/changelog');

const CARD_HEIGHT = 680;
const CARD_WIDTH = 488;
const CSV_HEADER =
  'name,CMC,Type,Color,Set,Collector Number,Rarity,Color Category,status,Finish,maybeboard,image URL,image Back URL,tags,Notes,MTGO ID';

async function updateCubeAndBlog(req, res, cube, cards, changelog, added, missing) {
  try {
    if (missing.length > 0) {
      return render(req, res, 'BulkUploadPage', {
        cube,
        cards,
        canEdit: true,
        cubeID: req.params.id,
        missing,
        added: added.map((add) => add._id),
      });
    }

    if (changelog.mainboard) {
      if (changelog.mainboard.adds && changelog.mainboard.adds.length === 0) {
        delete changelog.mainboard.adds;
      }
      if (changelog.mainboard.removes && changelog.mainboard.removes.length === 0) {
        delete changelog.mainboard.removes;
      }
      if (changelog.mainboard.swaps && changelog.mainboard.swaps.length === 0) {
        delete changelog.mainboard.swaps;
      }
      if (changelog.mainboard.edits && changelog.mainboard.edits.length === 0) {
        delete changelog.mainboard.edits;
      }
      if (Object.keys(changelog.mainboard).length === 0) {
        delete changelog.mainboard;
      }
    }

    if (changelog.maybeboard) {
      if (changelog.maybeboard.adds && changelog.maybeboard.adds.length === 0) {
        delete changelog.maybeboard.adds;
      }
      if (changelog.maybeboard.removes && changelog.maybeboard.removes.length === 0) {
        delete changelog.maybeboard.removes;
      }
      if (changelog.maybeboard.swaps && changelog.maybeboard.swaps.length === 0) {
        delete changelog.maybeboard.swaps;
      }
      if (changelog.maybeboard.edits && changelog.maybeboard.edits.length === 0) {
        delete changelog.maybeboard.edits;
      }
      if (Object.keys(changelog.maybeboard).length === 0) {
        delete changelog.maybeboard;
      }
    }

    if (Object.keys(changelog).length > 0) {
      const changelist = await Changelog.put(changelog, cube.id);

      const id = await Blog.put({
        owner: req.user.id,
        date: new Date().valueOf(),
        cube: cube.id,
        title: 'Cube Bulk Import - Automatic Post',
        changelist,
      });

      const followers = [...new Set([...(req.user.following || []), ...cube.following])];

      const feedItems = followers.map((user) => ({
        id,
        to: user,
        date: new Date().valueOf(),
        type: Feed.TYPES.BLOG,
      }));

      await Feed.batchPut(feedItems);

      await Cube.updateCards(cube.id, cards);
      req.flash('success', 'All cards successfully added.');
    } else {
      req.flash('danger', 'No changes made.');
    }

    return res.redirect(`/cube/list/${encodeURIComponent(req.params.id)}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/list/${encodeURIComponent(req.params.id)}`);
  }
}

async function bulkUpload(req, res, list, cube) {
  const cards = await Cube.getCards(cube.id);
  const { mainboard } = cards;
  const { maybeboard } = cards;

  const lines = list.match(/[^\r\n]+/g);
  let missing = [];
  const added = [];
  const changelog = [];
  if (lines) {
    if ((lines[0].match(/,/g) || []).length > 3) {
      // upload is in CSV format
      let newCards;
      let newMaybe;
      ({ newCards, newMaybe, missing } = CSVtoCards(list, carddb));
      changelog.push(
        ...newCards.map((card) => {
          return { addedID: card.cardID, removedID: null };
        }),
      );

      mainboard.push(...newCards);
      maybeboard.push(...newMaybe);

      added.concat(newCards, newMaybe);
    } else {
      // upload is in TXT format
      for (const itemUntrimmed of lines) {
        const item = itemUntrimmed.trim();
        // separate counts and sets from the name
        //                              |    count?   |name|     (set)?         c.num? |
        const splitLine = item.match(/^(?:([0-9]+)x? )?(.*?)(?: \(([^)(]+)\)(?: (\S+))?)?$/);
        const name = splitLine[2];
        const set = splitLine[3];
        const collectorNum = splitLine[4];
        let count = parseInt(splitLine[1], 10);
        if (!Number.isInteger(count)) {
          count = 1;
        }

        let selectedId;
        if (set) {
          const potentialIds = carddb.getIdsFromName(name);
          if (potentialIds && potentialIds.length > 0) {
            const matchingItem = potentialIds.find((id) => {
              const card = carddb.cardFromId(id);
              return (
                card.set.toLowerCase() === set.toLowerCase() &&
                (!collectorNum || card.collector_number === collectorNum)
              );
            });
            // if no sets match, just take the first ID ¯\_(ツ)_/¯
            selectedId = matchingItem || potentialIds[0];
          }
        } else {
          const selectedCard = carddb.getMostReasonable(name, cube.defaultPrinting);
          selectedId = selectedCard ? selectedCard._id : null;
        }

        if (selectedId) {
          const details = carddb.cardFromId(selectedId);
          if (!details.error) {
            for (let i = 0; i < count; i++) {
              util.addCardToCube(mainboard, cube, details);
              added.push(details);
              changelog.push({ addedID: selectedId, removedID: null });
            }
          }
        } else {
          missing.push(item);
        }
      }
    }
  }

  const changelist = {
    mainboard: {
      adds: changelog.map((change) => ({ cardID: change.addedID })),
    },
  };

  await updateCubeAndBlog(req, res, cube, cards, changelist, added, missing);
}

function writeCard(res, card, maybe) {
  if (!card.type_line) {
    card.type_line = carddb.cardFromId(card.cardID).type;
  }
  const { name, rarity, colorcategory } = carddb.cardFromId(card.cardID);
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
  res.write(`"${name.replace(/"/, '""')}",`);
  res.write(`${card.cmc},`);
  res.write(`"${card.type_line.replace('—', '-')}",`);
  res.write(`${(card.colors || []).join('')},`);
  res.write(`"${carddb.cardFromId(card.cardID).set}",`);
  res.write(`"${carddb.cardFromId(card.cardID).collector_number}",`);
  res.write(`${card.rarity && card.rarity !== 'undefined' ? card.rarity : rarity},`);
  res.write(`${card.colorCategory || colorcategory},`);
  res.write(`${card.status},`);
  res.write(`${card.finish},`);
  res.write(`${maybe},`);
  res.write(`${imgUrl},`);
  res.write(`${imgBackUrl},"`);
  card.tags.forEach((tag, tagIndex) => {
    if (tagIndex !== 0) {
      res.write(';');
    }
    res.write(tag);
  });
  res.write(`","${card.notes || ''}",`);
  res.write(`${carddb.cardFromId(card.cardID).mtgo_id || ''}`);
  res.write('\r\n');
}

const exportToMtgo = (res, fileName, mainCards, sideCards, cards) => {
  res.setHeader('Content-disposition', `attachment; filename=${fileName.replace(/\W/g, '')}.txt`);
  res.setHeader('Content-type', 'text/plain');
  res.charset = 'UTF-8';
  const main = {};
  for (const cardIndex of mainCards.flat()) {
    const cardID = cardIndex.cardID || cards[cardIndex].cardID;
    const { name } = carddb.cardFromId(cardID);
    if (main[name]) {
      main[name] += 1;
    } else {
      main[name] = 1;
    }
  }
  for (const [key, value] of Object.entries(main)) {
    const name = key.replace(' // ', '/');
    res.write(`${value} ${name}\r\n`);
  }
  res.write('\r\n\r\n');

  const side = {};
  for (const cardIndex of sideCards.flat()) {
    const { name } = carddb.cardFromId(cards[cardIndex].cardID);
    if (side[name]) {
      side[name] += 1;
    } else {
      side[name] = 1;
    }
  }
  for (const [key, value] of Object.entries(side)) {
    const name = key.replace(' // ', '/');
    res.write(`${value} ${name}\r\n`);
  }
  return res.end();
};

const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const addBasics = (document, basics) => {
  const populatedBasics = basics.map((cardID) => {
    const details = carddb.cardFromId(cardID);
    if (document.cards) {
      const populatedCard = {
        cardID: details._id,
        index: document.cards.length,
        isUnlimited: true,
        type_line: details.type,
      };
      document.cards.push(populatedCard);
      return populatedCard;
    }
    if (document.cards) {
      const populatedCard = {
        cardID: details._id,
        index: document.cards.length,
        isUnlimited: true,
        type_line: details.type,
      };
      document.cards.push(populatedCard);
      return populatedCard;
    }
    throw new Error('Document must contains cards to add basics');
  });
  document.basics = populatedBasics.map(({ index }) => index);
};

const createPool = () => {
  const pool = [];
  for (let i = 0; i < 2; i++) {
    pool.push([]);
    for (let j = 0; j < 8; j++) {
      pool[i].push([]);
    }
  }
  return pool;
};

const reverseArray = (arr, start, end) => {
  while (start < end) {
    [arr[start], arr[end]] = [arr[end], arr[start]];
    start += 1;
    end -= 1;
  }
};

const rotateArrayRight = (arr, k) => {
  k %= arr.length;
  reverseArray(arr, 0, arr.length - 1);
  reverseArray(arr, 0, k - 1);
  reverseArray(arr, k, arr.length - 1);

  return arr;
};

const rotateArrayLeft = (arr, k) => rotateArrayRight(arr, arr.length - (k % arr.length));

module.exports = {
  CARD_HEIGHT,
  CARD_WIDTH,
  CSV_HEADER,
  addBasics,
  bulkUpload,
  createPool,
  exportToMtgo,
  reverseArray,
  rotateArrayLeft,
  rotateArrayRight,
  shuffle,
  updateCubeAndBlog,
  writeCard,
};
