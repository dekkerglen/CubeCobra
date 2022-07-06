const NodeCache = require('node-cache');
const Papa = require('papaparse');
const sanitizeHtml = require('sanitize-html');

const fetch = require('node-fetch');
const sharp = require('sharp');
const { winston } = require('./cloudwatch');
const CardRating = require('../models/cardrating');
const CubeAnalytic = require('../models/cubeAnalytic');

const util = require('./util');
const { getDraftFormat, createDraft } = require('../dist/drafting/createdraft');
const { getDrafterState } = require('../dist/drafting/draftutil');

const ELO_BASE = 1200;
const ELO_SPEED = 1 / 128;
const CUBE_ELO_SPEED = 4;

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

  if (cube.overrideCategory) {
    cube.categories = [cube.categoryOverride.toLowerCase(), ...cube.categoryPrefixes.map((c) => c.toLowerCase())];
  } else {
    cube.categories = Array.from(new Set(`${cube.type}`.toLowerCase().split(' ')));
  }

  cube.cardOracles = Array.from(new Set(cube.cards.map((card) => carddb.cardFromId(card.cardID).oracle_id)));
  cube.keywords = `${cube.type} ${cube.name} ${cube.owner_name}`
    .replace(/[^\w\s]/gi, '')
    .toLowerCase()
    .split(' ')
    .filter((keyword) => keyword.length > 0);
  cube.keywords.push(
    ...(cube.tags || [])
      .filter((tag) => tag && tag.length > 0)
      .map((tag) => tag.replace(/[^\w\s]/gi, '').toLowerCase()),
  );
  cube.keywords.push(...cube.categories);
  cube.keywords = Array.from(new Set(cube.keywords));

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

function buildTagColors(cube, cards) {
  const { TagColors } = cube;
  const tags = TagColors.map((item) => item.tag);
  const notFound = TagColors.map((item) => item.tag);

  for (const card of cards) {
    for (let tag of card.tags) {
      tag = tag.trim();
      if (!tags.includes(tag)) {
        TagColors.push({
          tag,
          color: null,
        });
        tags.push(tag);
      }
      if (notFound.includes(tag)) notFound.splice(notFound.indexOf(tag), 1);
    }
  }

  const tmp = [];
  for (const color of TagColors) {
    if (!notFound.includes(color.tag)) tmp.push(color);
  }

  return tmp;
}

function cubeCardTags(cubeCards) {
  const tags = [];
  for (const card of cubeCards) {
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
  const missing = [];
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
        if (typeof maybeboard === 'string' && maybeboard.toLowerCase() === 'true') {
          newMaybe.push(card);
        } else {
          newCards.push(card);
        }
      } else {
        missing.push(card.name);
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

const getEloAdjustment = (winner, loser, speed) => {
  const diff = loser - winner;
  // Expected performance for pick.
  const expectedA = 1 / (1 + 10 ** (diff / 400));
  const expectedB = 1 - expectedA;
  const adjustmentA = (1 - expectedA) * speed;
  const adjustmentB = (0 - expectedB) * speed;
  return [adjustmentA, adjustmentB];
};

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
    let analytic = await CubeAnalytic.findOne({ cube: cube.Id });

    if (!analytic) {
      analytic = new CubeAnalytic();
      analytic.cube = cube.Id;
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
    let analytic = await CubeAnalytic.findOne({ cube: cube.Id });

    if (!analytic) {
      analytic = new CubeAnalytic();
      analytic.cube = cube.Id;
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

const saveDraftAnalytics = async (draft, seatNumber, carddb) => {
  try {
    // first get all the card rating objects we need
    const cards = await CardRating.find(
      {
        name: {
          $in: draft.cards.map(({ cardID }) => carddb.cardFromId(cardID).name),
        },
      },
      'elo picks name',
    );

    const nameToCardAnalytic = {};
    for (const analytic of cards) {
      nameToCardAnalytic[analytic.name] = analytic;
    }

    // fetch the cube analytic
    let analytic = await CubeAnalytic.findOne({ cube: draft.cube });

    if (!analytic) {
      analytic = new CubeAnalytic();
      analytic.cube = draft.cube;
    }

    const { pickorder, trashorder } = draft.seats[seatNumber];
    const numToTake = pickorder.length + trashorder.length;
    let prevPickedNum = 0;
    for (let pickNumber = 0; pickNumber <= numToTake; pickNumber++) {
      const { cardsInPack, pickedNum } = getDrafterState({ draft, seatNumber, pickNumber }, true);
      let pickedIndex = -1;

      if (pickedNum > prevPickedNum) {
        pickedIndex = pickorder[prevPickedNum];
      }
      prevPickedNum = pickedNum;

      if (pickedIndex !== -1) {
        const pickedCard = carddb.cardFromId(draft.cards[pickedIndex].cardID);
        const packCards = cardsInPack.map((index) => carddb.cardFromId(draft.cards[index].cardID));

        // update the local values of the cubeAnalytic
        let pickIndex = analytic.cards.findIndex((card) => card.cardName === pickedCard.name_lower);
        if (pickIndex === -1) {
          pickIndex = analytic.cards.push(newCardAnalytics(pickedCard.name_lower, ELO_BASE)) - 1;
        }

        analytic.cards[pickIndex].picks += 1;

        for (const packCard of packCards) {
          let index = analytic.cards.findIndex((card) => card.cardName === packCard.name_lower);
          if (index === -1) {
            index = analytic.cards.push(newCardAnalytics(packCard.name_lower, ELO_BASE)) - 1;
          }

          const adjustments = getEloAdjustment(
            analytic.cards[pickIndex].elo,
            analytic.cards[index].elo,
            CUBE_ELO_SPEED,
          );
          analytic.cards[pickIndex].elo += adjustments[0];
          analytic.cards[index].elo += adjustments[1];

          analytic.cards[index].passes += 1;
        }

        // update the local values of the cardAnalytics.

        // ensure we have valid analytics for all these cards
        if (!nameToCardAnalytic[pickedCard.name]) {
          nameToCardAnalytic[pickedCard.name] = new CardRating();
        }
        if (!nameToCardAnalytic[pickedCard.name].elo) {
          nameToCardAnalytic[pickedCard.name].name = pickedCard.name;
          nameToCardAnalytic[pickedCard.name].elo = ELO_BASE;
        } else if (!Number.isFinite(nameToCardAnalytic[pickedCard.name].elo)) {
          nameToCardAnalytic[pickedCard.name].elo = ELO_BASE;
        }
        if (!nameToCardAnalytic[pickedCard.name].picks) {
          nameToCardAnalytic[pickedCard.name].picks = 0;
        }
        nameToCardAnalytic[pickedCard.name].picks += 1;

        for (const packCard of packCards) {
          if (!nameToCardAnalytic[packCard.name]) {
            nameToCardAnalytic[packCard.name] = new CardRating();
          }
          if (!nameToCardAnalytic[packCard.name].elo) {
            nameToCardAnalytic[packCard.name].name = packCard.name;
            nameToCardAnalytic[packCard.name].elo = ELO_BASE;
          }
          if (!nameToCardAnalytic[packCard.name].picks) {
            nameToCardAnalytic[packCard.name].picks = 0;
          }

          if (!Number.isFinite(nameToCardAnalytic[packCard.name].elo)) {
            nameToCardAnalytic[packCard.name].elo = ELO_BASE;
          }

          // update the elos
          const adjustments = getEloAdjustment(
            nameToCardAnalytic[pickedCard.name].elo,
            nameToCardAnalytic[packCard.name].elo,
            ELO_SPEED,
          );

          nameToCardAnalytic[pickedCard.name].elo += adjustments[0];
          nameToCardAnalytic[packCard.name].elo += adjustments[1];
        }
      }
    }
    // save our docs
    await analytic.save();
    await Promise.all(cards.map((card) => card.save()));
  } catch (err) {
    winston.error(err);
  }
};

const generateSamplepackImage = async (sources = [], width, height) => {
  const images = await Promise.all(
    sources.map(async (source) => {
      const res = await fetch(source.src);

      return {
        input: Buffer.from(await res.arrayBuffer()),
        top: source.y,
        left: source.x,
      };
    }),
  );

  const options = {
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  };

  return sharp(options).composite(images).webp({ reductionEffort: 6, alphaQuality: 0 }).toBuffer();
};

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

function isCubeViewable(cube, user) {
  if (!cube) return false;
  if (cube.Visibility !== 'pu') return true;
  return user && (cube.Owner === user.Id || util.isAdmin(user));
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
  generatePack: async (cube, cards, carddb, seed) => {
    const main = cards.boards.filter((board) => board.name === 'Mainboard')[0];

    if (!seed) {
      seed = Date.now().toString();
    }
    main.cards = main.cards.map((card) => ({ ...card, details: { ...carddb.getCardDetails(card) } }));
    const formatId = cube.DefaultDraftFormat === undefined ? -1 : cube.DefaultDraftFormat;
    const format = getDraftFormat({ id: formatId, packs: 1, cards: 15 }, cube);
    const draft = createDraft(format, main.cards, 1, { username: 'Anonymous' }, false, seed);
    return {
      seed,
      pack: draft.initial_state[0][0].cards.map((cardIndex) => ({
        ...draft.cards[cardIndex],
        details: carddb.cardFromId(draft.cards[cardIndex].cardID),
      })),
    };
  },
  newCardAnalytics,
  getEloAdjustment,
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
  saveDraftAnalytics,
  isCubeViewable,
  ELO_BASE,
  ELO_SPEED,
  CUBE_ELO_SPEED,
};

module.exports = methods;
