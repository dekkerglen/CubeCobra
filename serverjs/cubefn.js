const NodeCache = require('node-cache');
const Papa = require('papaparse');
const sanitizeHtml = require('sanitize-html');

const fetch = require('node-fetch');
const sharp = require('sharp');
const Cube = require('../dynamo/models/cube');

const util = require('./util');
const { getDraftFormat, createDraft } = require('../dist/drafting/createdraft');

function getCubeId(cube) {
  if (cube.shortId) return cube.shortId;
  return cube.id;
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

function getCubeTypes(cards, carddb) {
  let pauper = true;
  let peasant = false;
  let type = FORMATS.length - 1;
  for (const card of cards) {
    if (pauper && !cardIsLegal(carddb.cardFromId(card.cardID), 'Pauper')) {
      pauper = false;
      peasant = true;
    }
    if (!pauper && peasant) {
      // check rarities of all card versions
      const versions = carddb.allVersions(carddb.cardFromId(card.cardID));
      if (versions) {
        const rarities = versions.map((id) => carddb.cardFromId(id).rarity);
        if (!rarities.includes('common') && !rarities.includes('uncommon')) {
          peasant = false;
        }
      }
    }
    while (type > 0 && !cardIsLegal(carddb.cardFromId(card.cardID), intToLegality(type))) {
      type -= 1;
    }
  }

  return { pauper, peasant, type };
}

function setCubeType(cube, carddb) {
  const { pauper, peasant, type } = getCubeTypes(cube.cards, carddb);

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
  const { tagColors } = cube;
  const tags = tagColors.map((item) => item.tag);
  const notFound = tagColors.map((item) => item.tag);

  for (const card of cards) {
    for (let tag of card.tags) {
      tag = tag.trim();
      if (!tags.includes(tag)) {
        tagColors.push({
          tag,
          color: null,
        });
        tags.push(tag);
      }
      if (notFound.includes(tag)) notFound.splice(notFound.indexOf(tag), 1);
    }
  }

  const tmp = [];
  for (const color of tagColors) {
    if (!notFound.includes(color.tag)) tmp.push(color);
  }

  return tmp;
}

function cubeCardTags(cubeCards) {
  const tags = [];
  for (const card of cubeCards) {
    if (card.tags) {
      for (let tag of card.tags) {
        tag = tag.trim();
        if (!tags.includes(tag)) {
          tags.push(tag);
        }
      }
    }
  }
  return tags;
}

function maybeCards(cube, carddb) {
  const maybe = (cube.maybe || []).filter((card) => card.cardID);
  return maybe.map((card) => ({ ...card, details: carddb.cardFromId(card.cardID) }));
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
  const onlyA = cardsA.mainboard.slice(0);
  const onlyB = cardsB.mainboard.slice(0);
  const aOracles = onlyA.map((card) => card.details.oracle_id);
  const bOracles = onlyB.map((card) => card.details.oracle_id);
  for (const card of cardsA.mainboard) {
    if (bOracles.includes(card.details.oracle_id)) {
      inBoth.push(card);

      onlyA.splice(aOracles.indexOf(card.details.oracle_id), 1);
      onlyB.splice(bOracles.indexOf(card.details.oracle_id), 1);

      aOracles.splice(aOracles.indexOf(card.details.oracle_id), 1);
      bOracles.splice(bOracles.indexOf(card.details.oracle_id), 1);
    }
  }

  const allCards = inBoth.concat(onlyA).concat(onlyB);
  return {
    inBoth,
    onlyA,
    onlyB,
    aOracles,
    bOracles,
    allCards,
  };
}

const generateSamplepackImage = async (sources = [], width, height) => {
  const images = await Promise.all(
    sources.map(async (source) => {
      const res = await fetch(source.src);

      return {
        input: await sharp(Buffer.from(await res.arrayBuffer()))
          .resize({ width: source.width, height: source.height })
          .toBuffer(),
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

async function isBlogEditable(blog, user) {
  if (!user || !blog || !blog.owner) {
    return false;
  }

  // handle hydrated blogs, can just check the id directly, no need to fetch.
  const owner = typeof blog.owner === "string" ? blog.owner : blog.owner.id;
  if (user.id === owner) {
    return true;
  }

  if (!blog.cube) {
    return false;
  }

  const cube = typeof blog.cube === "string" ? await Cube.getById(blog.cube) : blog.cube;

  return cube.owner && user.id === cube.owner.id;
}

function isCubeCollaborator(cube, user) {
  if (!user || !cube || !cube.collaborators) {
    return false;
  }

  return cube.collaborators.some((c) => c && c.id === user.id);
}

function isCubeViewable(cube, user) {
  if (!cube) {
    return false;
  }

  if (cube.visibility === Cube.VISIBILITY.PUBLIC || cube.visibility === Cube.VISIBILITY.UNLISTED) {
    return true;
  }

  return user && (cube.owner.id === user.id || isCubeCollaborator(cube, user) || util.isAdmin(user));
}

function isCubeListed(cube, user) {
  if (!cube) {
    return false;
  }

  if (cube.visibility === Cube.VISIBILITY.PUBLIC) {
    return true;
  }

  return user && (cube.owner.id === user.id || isCubeCollaborator(cube, user) || util.isAdmin(user));
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
    if (!seed) {
      seed = Date.now().toString();
    }
    const formatId = cube.defaultFormat === undefined ? -1 : cube.defaultFormat;
    const format = getDraftFormat({ id: formatId, packs: 1, cards: 15 }, cube);
    const draft = createDraft(format, cards.mainboard, 1, { username: 'Anonymous' }, false, seed);
    return {
      seed,
      pack: draft.initial_state[0][0].cards.map((cardIndex) => ({
        ...draft.cards[cardIndex],
        details: carddb.cardFromId(draft.cards[cardIndex].cardID),
      })),
    };
  },
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
  CSVtoCards,
  compareCubes,
  generateSamplepackImage,
  cachePromise,
  isBlogEditable,
  isCubeCollaborator,
  isCubeViewable,
  isCubeListed,
  getCubeTypes,
};

module.exports = methods;
