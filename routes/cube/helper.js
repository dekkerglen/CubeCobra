const { Canvas, Image } = require('canvas');

Canvas.Image = Image;

const carddb = require('../../serverjs/cards.js');
const { render } = require('../../serverjs/render');
const util = require('../../serverjs/util.js');
const { setCubeType, addCardHtml, CSVtoCards } = require('../../serverjs/cubefn.js');

// Bring in models
const Cube = require('../../models/cube');
const Blog = require('../../models/blog');

const DEFAULT_BASICS = [
  '1d7dba1c-a702-43c0-8fca-e47bbad4a00f',
  '42232ea6-e31d-46a6-9f94-b2ad2416d79b',
  '19e71532-3f79-4fec-974f-b0e85c7fe701',
  '8365ab45-6d78-47ad-a6ed-282069b0fabc',
  '0c4eaecf-dd4c-45ab-9b50-2abe987d35d4',
];

const ELO_BASE = 1200;
const ELO_SPEED = 1 / 8;
const CUBE_ELO_SPEED = 4;

const CARD_HEIGHT = 680;
const CARD_WIDTH = 488;
const CSV_HEADER =
  'Name,CMC,Type,Color,Set,Collector Number,Rarity,Color Category,Status,Finish,Maybeboard,Image URL,Image Back URL,Tags,Notes,MTGO ID';

async function updateCubeAndBlog(req, res, cube, changelog, added, missing) {
  try {
    const blogpost = new Blog();
    blogpost.title = 'Cube Bulk Import - Automatic Post';
    blogpost.changelist = changelog;
    blogpost.owner = cube.owner;
    blogpost.date = Date.now();
    blogpost.cube = cube._id;
    blogpost.dev = 'false';
    blogpost.date_formatted = blogpost.date.toLocaleString('en-US');
    blogpost.username = cube.owner_name;
    blogpost.cubename = cube.name;

    if (missing.length > 0) {
      return render(req, res, 'BulkUploadPage', {
        cube,
        canEdit: true,
        cubeID: req.params.id,
        missing,
        added: added.map(({ _id, name, image_normal, image_flip }) => ({
          _id,
          name,
          image_normal,
          image_flip,
        })),
        blogpost: blogpost.toObject(),
      });
    }
    await blogpost.save();
    cube = setCubeType(cube, carddb);
    try {
      await Cube.updateOne(
        {
          _id: cube._id,
        },
        cube,
      );
    } catch (err) {
      req.logger.error(err);
      req.flash('danger', 'Error adding cards. Please try again.');
      return res.redirect(`/cube/list/${encodeURIComponent(req.params.id)}`);
    }
    req.flash('success', 'All cards successfully added.');
    return res.redirect(`/cube/list/${encodeURIComponent(req.params.id)}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/list/${encodeURIComponent(req.params.id)}`);
  }
}

async function bulkUpload(req, res, list, cube) {
  const cards = list.match(/[^\r\n]+/g);
  let missing = '';
  const added = [];
  let changelog = '';
  if (cards) {
    if ((cards[0].match(/,/g) || []).length > 3) {
      let newCards = [];
      let newMaybe = [];
      ({ newCards, newMaybe, missing } = CSVtoCards(list, carddb));
      changelog = newCards.reduce((changes, card) => changes + addCardHtml(carddb.cardFromId(card.cardID)), changelog);
      cube.cards.push(...newCards);
      cube.maybe.push(...newMaybe);
      added.concat(newCards, newMaybe);
    } else {
      for (const itemUntrimmed of cards) {
        const item = itemUntrimmed.trim();
        const numericMatch = item.match(/([0-9]+)x? (.*)/);
        if (numericMatch) {
          let count = parseInt(numericMatch[1], 10);
          if (!Number.isInteger(count)) {
            count = 1;
          }
          for (let j = 0; j < count; j += 1) {
            cards.push(numericMatch[2]);
          }
        } else {
          let selected = null;
          if (/(.*)( \((.*)\))/.test(item)) {
            // has set info
            const name = item.substring(0, item.indexOf('('));
            const potentialIds = carddb.getIdsFromName(name);
            if (potentialIds && potentialIds.length > 0) {
              const set = item.toLowerCase().substring(item.indexOf('(') + 1, item.indexOf(')'));
              // if we've found a match, and it DOES need to be parsed with cubecobra syntax
              const matching = potentialIds.find((id) => carddb.cardFromId(id).set.toUpperCase() === set);
              selected = matching || potentialIds[0];
            }
          } else {
            // does not have set info
            const selectedCard = carddb.getMostReasonable(item, cube.defaultPrinting);
            selected = selectedCard ? selectedCard._id : null;
          }
          if (selected) {
            const details = carddb.cardFromId(selected);
            if (!details.error) {
              util.addCardToCube(cube, details);
              added.push(details);
              changelog += addCardHtml(details);
            }
          } else {
            missing += `${item}\n`;
          }
        }
      }
    }
  }
  await updateCubeAndBlog(req, res, cube, changelog, added, missing);
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
  for (const cardIndex of mainCards) {
    const { name } = carddb.cardFromId(cards[cardIndex].cardID);
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
  for (const cardIndex of sideCards) {
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

const addBasics = (cardsArray, basics, collection = null) => {
  const populatedBasics = basics.map((cardID) => {
    const details = carddb.cardFromId(cardID);
    const populatedCard = {
      cardID: details._id,
      index: cardsArray.length,
      isUnlimited: true,
      type_line: details.type,
    };
    cardsArray.push(populatedCard);
    return populatedCard;
  });
  if (collection) collection.basics = populatedBasics.map(({ index }) => index);
};

const createPool = () => {
  const pool = [];
  const row = [];
  for (let j = 0; j < 8; j++) {
    row.push([]);
  }
  for (let i = 0; i < 2; i++) {
    pool.push(row);
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
  CUBE_ELO_SPEED,
  DEFAULT_BASICS,
  ELO_BASE,
  ELO_SPEED,
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
