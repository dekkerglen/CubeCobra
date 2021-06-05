const NodeCache = require('node-cache');
const Papa = require('papaparse');
const sanitizeHtml = require('sanitize-html');

const CardRating = require('../models/cardrating');
const Cube = require('../models/cube');
const CubeAnalytic = require('../models/cubeAnalytic');

const util = require('./util');
const { getDraftFormat, createDraft } = require('../dist/drafting/createdraft');

function getCubeId(cube) {
  if (cube.shortID) return cube.shortID;
  return cube._id;
}

function buildIdQuery(id) {
  if (!id || id.match(/^[0-9a-fA-F]{24}$/)) {
    return { _id: id };
  }
  return { shortID: id.toLowerCase() };
}

async function generateShortId() {
  const cubes = await Cube.find({}, ['shortID']);
  const shortIds = cubes.map((cube) => cube.shortID);
  const space = shortIds.length * 2;

  let newId = '';
  let isGoodId = false;
  while (!isGoodId) {
    const rand = Math.floor(Math.random() * space);
    newId = util.toBase36(rand);
    isGoodId = !util.hasProfanity(newId) && !shortIds.includes(newId);
  }

  return newId;
}

const FORMATS = ['Vintage', 'Legacy', 'Modern', 'Pioneer', 'Standard'];

function intToLegality(val) {
  return FORMATS[val];
}

function legalityToInt(legality) {
  let res;
  FORMATS.forEach((format, index) => {
    if (legality === format) res = index;
  });

  return res;
}

function cardsAreEquivalent(card, details) {
  if (card.cardID !== details.cardID) {
    return false;
  }
  if (card.status !== details.status) {
    return false;
  }
  if (card.cmc !== details.cmc) {
    return false;
  }
  if (card.type_line && details.type_line && card.type_line !== details.type_line) {
    return false;
  }
  if (!util.arraysEqual(card.tags, details.tags)) {
    return false;
  }
  if (!util.arraysEqual(card.colors, details.colors)) {
    return false;
  }
  if (card.finish && details.finish && card.finish !== details.finish) {
    return false;
  }

  return true;
}

function cardIsLegal(card, legality) {
  return card.legalities[legality] === 'legal' || card.legalities[legality] === 'banned';
}

function setCubeType(cube, carddb) {
  let pauper = true;
  let peasant = false;
  let type = FORMATS.length - 1;
  for (const card of cube.cards) {
    if (pauper && !cardIsLegal(carddb.cardFromId(card.cardID), 'Pauper')) {
      pauper = false;
      peasant = true;
    }
    if (!pauper && peasant) {
      // check rarities of all card versions
      const rarities = carddb.allVersions(carddb.cardFromId(card.cardID)).map((id) => carddb.cardFromId(id).rarity);
      if (!rarities.includes('common') && !rarities.includes('uncommon')) {
        peasant = false;
      }
    }
    while (type > 0 && !cardIsLegal(carddb.cardFromId(card.cardID), intToLegality(type))) {
      type -= 1;
    }
  }

  cube.type = intToLegality(type);
  if (pauper) {
    cube.type += ' Pauper';
  }
  if (peasant) {
    cube.type += ' Peasant';
  }
  cube.card_count = cube.cards.length;
  return cube;
}

function cardHtml(card) {
  if (card.image_flip) {
    return `<a class="dynamic-autocard" card="${card.image_normal}" card_flip="${card.image_flip}">${card.name}</a>`;
  }
  return `<a class="dynamic-autocard" card="${card.image_normal}">${card.name}</a>`;
}

function addCardHtml(card) {
  return `<span style="font-family: &quot;Lucida Console&quot;, Monaco, monospace;" class="badge badge-success">+</span> ${cardHtml(
    card,
  )}<br/>`;
}

function removeCardHtml(card) {
  return `<span style="font-family: &quot;Lucida Console&quot;, Monaco, monospace;" class="badge badge-danger">-</span> ${cardHtml(
    card,
  )}<br/>`;
}

function replaceCardHtml(oldCard, newCard) {
  return `<span style="font-family: &quot;Lucida Console&quot;, Monaco, monospace;" class="badge badge-primary">→</span> ${cardHtml(
    oldCard,
  )} &gt; ${cardHtml(newCard)}<br/>`;
}

function abbreviate(name) {
  return name.length < 20 ? name : `${name.slice(0, 20)}…`;
}

function buildTagColors(cube) {
  let { tag_colors: tagColor } = cube;
  const tags = tagColor.map((item) => item.tag);
  const notFound = tagColor.map((item) => item.tag);

  for (const card of cube.cards) {
    for (let tag of card.tags) {
      tag = tag.trim();
      if (!tags.includes(tag)) {
        tagColor.push({
          tag,
          color: null,
        });
        tags.push(tag);
      }
      if (notFound.includes(tag)) notFound.splice(notFound.indexOf(tag), 1);
    }
  }

  const tmp = [];
  for (const color of tagColor) {
    if (!notFound.includes(color.tag)) tmp.push(color);
  }
  tagColor = tmp;

  return tagColor;
}

function cubeCardTags(cube) {
  const tags = [];
  for (const card of cube.cards) {
    for (let tag of card.tags) {
      tag = tag.trim();
      if (!tags.includes(tag)) {
        tags.push(tag);
      }
    }
  }
  return tags;
}

function maybeCards(cube, carddb) {
  const maybe = (cube.maybe || []).filter((card) => card.cardID);
  return maybe.map((card) => ({ ...card, details: carddb.cardFromId(card.cardID) }));
}

async function getCardElo(cardname, round) {
  const rating = await CardRating.findOne({ name: { $regex: new RegExp(cardname, 'i') } }).lean();

  if (!rating || Number.isNaN(rating.elo)) {
    return 1200;
  }

  return round ? Math.round(rating.elo) : rating.elo;
}

function CSVtoCards(csvString, carddb) {
  let { data } = Papa.parse(csvString.trim(), { header: true });
  data = data.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key.toLowerCase(), value])));
  let missing = '';
  const newCards = [];
  const newMaybe = [];
  for (const {
    name,
    cmc,
    type,
    color,
    set,
    'collector number': collectorNumber,
    status,
    finish,
    maybeboard,
    'image url': imageUrl,
    'image back url': imageBackUrl,
    tags,
    notes,
    'Color Category': colorCategory,
    rarity,
  } of data) {
    if (name) {
      const upperSet = (set || '').toUpperCase();
      const card = {
        name,
        cmc: cmc || null,
        type_line: (type || null) && type.replace('-', '—'),
        colors: (color || null) && color.split('').filter((c) => [...'WUBRG'].includes(c)),
        addedTmsp: new Date(),
        collector_number: collectorNumber && collectorNumber.toUpperCase(),
        status: status || 'Not Owned',
        finish: finish || 'Non-foil',
        imgUrl: (imageUrl || null) && imageUrl !== 'undefined' ? imageUrl : null,
        imgBackUrl: (imageBackUrl || null) && imageBackUrl !== 'undefined' ? imageBackUrl : null,
        tags: tags && tags.length > 0 ? tags.split(';').map((t) => t.trim()) : [],
        notes: notes || '',
        rarity: rarity || null,
        colorCategory: colorCategory || null,
      };

      const potentialIds = carddb.allVersions(card);
      if (potentialIds && potentialIds.length > 0) {
        // First, try to find the correct set.
        const matchingSetAndNumber = potentialIds.find((id) => {
          const dbCard = carddb.cardFromId(id);
          return (
            upperSet === dbCard.set.toUpperCase() && card.collector_number === dbCard.collector_number.toUpperCase()
          );
        });
        const matchingSet = potentialIds.find((id) => carddb.cardFromId(id).set.toUpperCase() === upperSet);
        const nonPromo = potentialIds.find(carddb.reasonableId);
        const first = potentialIds[0];
        card.cardID = matchingSetAndNumber || matchingSet || nonPromo || first;
        if (maybeboard === 'true') {
          newMaybe.push(card);
        } else {
          newCards.push(card);
        }
      } else {
        missing += `${card.name}\n`;
      }
    }
  }
  return { newCards, newMaybe, missing };
}

async function compareCubes(cardsA, cardsB) {
  const inBoth = [];
  const onlyA = cardsA.slice(0);
  const onlyB = cardsB.slice(0);
  const aNames = onlyA.map((card) => card.details.name);
  const bNames = onlyB.map((card) => card.details.name);
  for (const card of cardsA) {
    if (bNames.includes(card.details.name)) {
      inBoth.push(card);

      onlyA.splice(aNames.indexOf(card.details.name), 1);
      onlyB.splice(bNames.indexOf(card.details.name), 1);

      aNames.splice(aNames.indexOf(card.details.name), 1);
      bNames.splice(bNames.indexOf(card.details.name), 1);
    }
  }

  const allCards = inBoth.concat(onlyA).concat(onlyB);
  return {
    inBoth,
    onlyA,
    onlyB,
    aNames,
    bNames,
    allCards,
  };
}

const newCardAnalytics = (cardName, elo) => {
  return {
    cardName,
    picks: 0,
    passes: 0,
    elo,
    mainboards: 0,
    sideboards: 0,
  };
};

const removeDeckCardAnalytics = async (cube, deck, carddb) => {
  // we don't want to save deck analytics for decks have not been built
  if (deck.seats[0].sideboard.flat().length > 0) {
    let analytic = await CubeAnalytic.findOne({ cube: cube._id });

    if (!analytic) {
      analytic = new CubeAnalytic();
      analytic.cube = cube._id;
    }

    for (const row of deck.seats[0].deck) {
      for (const col of row) {
        for (const ci of col) {
          let pickIndex = analytic.cards.findIndex(
            (card) => card.cardName === carddb.cardFromId(deck.cards[ci].cardID).name.toLowerCase(),
          );
          if (pickIndex === -1) {
            pickIndex =
              analytic.cards.push(newCardAnalytics(carddb.cardFromId(deck.cards[ci].cardID).name.toLowerCase(), 1200)) -
              1;
          }
          analytic.cards[pickIndex].mainboards = Math.max(0, analytic.cards[pickIndex].mainboards - 1);
        }
      }
    }
    for (const row of deck.seats[0].sideboard) {
      for (const col of row) {
        for (const ci of col) {
          let pickIndex = analytic.cards.findIndex(
            (card) => card.cardName === carddb.cardFromId(deck.cards[ci].cardID).name.toLowerCase(),
          );
          if (pickIndex === -1) {
            pickIndex =
              analytic.cards.push(newCardAnalytics(carddb.cardFromId(deck.cards[ci].cardID).name.toLowerCase(), 1200)) -
              1;
          }
          analytic.cards[pickIndex].sideboards = Math.max(0, analytic.cards[pickIndex].sideboards - 1);
        }
      }
    }

    await analytic.save();
  }
};

const addDeckCardAnalytics = async (cube, deck, carddb) => {
  // we don't want to save deck analytics for decks have not been built
  if (deck.seats[0].sideboard.flat().length > 0) {
    let analytic = await CubeAnalytic.findOne({ cube: cube._id });

    if (!analytic) {
      analytic = new CubeAnalytic();
      analytic.cube = cube._id;
    }

    for (const row of deck.seats[0].deck) {
      for (const col of row) {
        for (const ci of col) {
          let pickIndex = analytic.cards.findIndex(
            (card) => card.cardName === carddb.cardFromId(deck.cards[ci].cardID).name.toLowerCase(),
          );
          if (pickIndex === -1) {
            pickIndex =
              analytic.cards.push(newCardAnalytics(carddb.cardFromId(deck.cards[ci].cardID).name.toLowerCase(), 1200)) -
              1;
          }
          analytic.cards[pickIndex].mainboards += 1;
        }
      }
    }
    for (const row of deck.seats[0].sideboard) {
      for (const col of row) {
        for (const ci of col) {
          let pickIndex = analytic.cards.findIndex(
            (card) => card.cardName === carddb.cardFromId(deck.cards[ci].cardID).name.toLowerCase(),
          );
          if (pickIndex === -1) {
            pickIndex =
              analytic.cards.push(newCardAnalytics(carddb.cardFromId(deck.cards[ci].cardID).name.toLowerCase(), 1200)) -
              1;
          }
          analytic.cards[pickIndex].sideboards += 1;
        }
      }
    }
    await analytic.save();
  }
};

/*
Forked from https://github.com/lukechilds/merge-images
to support border radius for cards and width/height for custom card images.
*/
const generateSamplepackImage = (sources = [], options = {}) =>
  new Promise((resolve) => {
    const defaultOptions = {
      format: 'image/png',
      quality: 0.92,
      width: undefined,
      height: undefined,
      Canvas: undefined,
      crossOrigin: undefined,
    };

    options = { ...defaultOptions, ...options };

    // Setup browser/Node.js specific variables
    const canvas = options.Canvas ? new options.Canvas() : window.document.createElement('canvas');
    const { Image } = options.Canvas;

    // Load sources
    const images = sources.map(
      (source) =>
        // eslint-disable-next-line no-shadow
        new Promise((resolve, reject) => {
          // Convert sources to objects
          if (source.constructor.name !== 'Object') {
            source = { src: source };
          }

          // Resolve source and img when loaded
          const img = new Image();
          img.crossOrigin = options.crossOrigin;
          img.onerror = () => reject(new Error("Couldn't load image"));
          img.onload = () => resolve({ ...source, img });
          img.src = source.src;
        }),
    );

    // Get canvas context
    const ctx = canvas.getContext('2d');

    // When sources have loaded
    resolve(
      // eslint-disable-next-line no-shadow
      Promise.all(images).then((images) => {
        // Set canvas dimensions
        const getSize = (dim) => options[dim] || Math.max(...images.map((image) => image.img[dim]));
        canvas.width = getSize('width');
        canvas.height = getSize('height');

        // Draw images to canvas
        images.forEach((image) => {
          const scratchCanvas = options.Canvas ? new options.Canvas() : window.document.createElement('canvas');
          scratchCanvas.width = image.w || image.img.width;
          scratchCanvas.height = image.h || image.img.height;
          const scratchCtx = scratchCanvas.getContext('2d');
          scratchCtx.clearRect(0, 0, scratchCanvas.width, scratchCanvas.height);
          scratchCtx.globalCompositeOperation = 'source-over';

          const radiusX = image.rX || 0;
          const radiusY = image.rY || 0;
          const aspectRatio = image.img.width / image.img.height;

          let { width } = scratchCanvas;
          let height = width / aspectRatio;

          if (height > scratchCanvas.height) {
            height = scratchCanvas.height;
            width = height * aspectRatio;
          }

          const x = scratchCanvas.width / 2 - width / 2;
          const y = scratchCanvas.height / 2 - height / 2;

          scratchCtx.drawImage(image.img, x, y, width, height);

          scratchCtx.fillStyle = '#fff';
          scratchCtx.globalCompositeOperation = 'destination-in';
          scratchCtx.beginPath();
          scratchCtx.moveTo(x + radiusX, y);
          scratchCtx.lineTo(x + width - radiusX, y);
          scratchCtx.quadraticCurveTo(x + width, y, x + width, y + radiusY);
          scratchCtx.lineTo(x + width, y + height - radiusY);
          scratchCtx.quadraticCurveTo(x + width, y + height, x + width - radiusX, y + height);
          scratchCtx.lineTo(x + radiusX, y + height);
          scratchCtx.quadraticCurveTo(x, y + height, x, y + height - radiusY);
          scratchCtx.lineTo(x, y + radiusY);
          scratchCtx.quadraticCurveTo(x, y, x + radiusX, y);
          scratchCtx.closePath();
          scratchCtx.fill();

          ctx.globalAlpha = image.opacity ? image.opacity : 1;
          return ctx.drawImage(scratchCanvas, image.x || 0, image.y || 0);
        });

        if (options.Canvas && options.format === 'image/jpeg') {
          // Resolve data URI for node-canvas jpeg async
          // eslint-disable-next-line no-shadow
          return new Promise((resolve, reject) => {
            canvas.toDataURL(
              options.format,
              {
                quality: options.quality,
                progressive: false,
              },
              (err, jpeg) => {
                if (err) {
                  reject(err);
                  return;
                }
                resolve(jpeg);
              },
            );
          });
        }

        // Resolve all other data URIs sync
        return canvas.toDataURL(options.format, options.quality);
      }),
    );
  });

// A cache for promises that are expensive to compute and will always produce
// the same value, such as pack images. If a promise produces an error, it's
// removed from the cache. Each promise lives five minutes by default.
const promiseCache = new NodeCache({ stdTTL: 60 * 5, useClones: false });

// / Caches the result of the given callback in `promiseCache` with the given
// / key.
function cachePromise(key, callback) {
  const existingPromise = promiseCache.get(key);
  if (existingPromise) return existingPromise;

  const newPromise = callback().catch((error) => {
    promiseCache.del(key);
    throw error;
  });
  promiseCache.set(key, newPromise);
  return newPromise;
}

const methods = {
  setCubeType,
  cardsAreEquivalent,
  sanitize(html) {
    return sanitizeHtml(html, {
      allowedTags: [
        'div',
        'p',
        'strike',
        'strong',
        'b',
        'i',
        'em',
        'u',
        'a',
        'h5',
        'h6',
        'ul',
        'ol',
        'li',
        'span',
        'br',
      ],
      selfClosing: ['br'],
    });
  },
  generatePack: async (cubeId, carddb, seed) => {
    const cube = await Cube.findOne(buildIdQuery(cubeId)).lean();
    if (!seed) {
      seed = Date.now().toString();
    }
    cube.cards = cube.cards.map((card) => ({ ...card, details: { ...carddb.getCardDetails(card) } }));
    const formatId = cube.defaultDraftFormat === undefined ? -1 : cube.defaultDraftFormat;
    const format = getDraftFormat({ id: formatId, packs: 1, cards: 15 }, cube);
    const draft = createDraft(format, cube.cards, 1, { username: 'Anonymous' }, false, seed);
    return {
      seed,
      pack: draft.initial_state[0][0].cards.map((cardIndex) => ({
        ...draft.cards[cardIndex],
        details: carddb.cardFromId(draft.cards[cardIndex].cardID),
      })),
    };
  },
  newCardAnalytics,
  getEloAdjustment: (winner, loser, speed) => {
    const diff = loser - winner;
    // Expected performance for pick.
    const expectedA = 1 / (1 + 10 ** (diff / 400));
    const expectedB = 1 - expectedA;
    const adjustmentA = (1 - expectedA) * speed;
    const adjustmentB = (0 - expectedB) * speed;
    return [adjustmentA, adjustmentB];
  },
  generateShortId,
  buildIdQuery,
  getCubeId,
  intToLegality,
  legalityToInt,
  addCardHtml,
  removeCardHtml,
  replaceCardHtml,
  abbreviate,
  buildTagColors,
  cubeCardTags,
  maybeCards,
  getCardElo,
  CSVtoCards,
  compareCubes,
  generateSamplepackImage,
  removeDeckCardAnalytics,
  addDeckCardAnalytics,
  cachePromise,
};

module.exports = methods;
