import fs from 'fs';

function createMockFiles() {
  // Ensure directories exist
  fs.mkdirSync('../server/private/', { recursive: true });
  fs.mkdirSync('../server/model/', { recursive: true });

  const mockCard1 = {
    scryfall_id: 'test-card-1',
    oracle_id: 'oracle-1',
    name: 'Black Lotus',
    set: 'tst',
    setIndex: 0,
    collector_number: '1',
    released_at: '2020-01-01',
    promo: false,
    reprint: false,
    digital: false,
    isToken: false,
    full_name: 'Black Lotus [tst-1]',
    name_lower: 'black lotus',
    artist: 'Christopher Rush',
    scryfall_uri: 'https://scryfall.com/card/test/1',
    rarity: 'rare',
    legalities: {
      standard: 'not_legal',
      future: 'not_legal',
      historic: 'not_legal',
      timeless: 'not_legal',
      gladiator: 'not_legal',
      pioneer: 'not_legal',
      explorer: 'not_legal',
      modern: 'not_legal',
      legacy: 'legal',
      pauper: 'not_legal',
      vintage: 'legal',
      penny: 'not_legal',
      commander: 'legal',
      oathbreaker: 'legal',
      standardbrawl: 'not_legal',
      brawl: 'not_legal',
      alchemy: 'not_legal',
      paupercommander: 'not_legal',
      duel: 'legal',
      oldschool: 'legal',
      premodern: 'not_legal',
      predh: 'legal',
    },
    oracle_text: '{T}: Add three mana of any one color.',
    image_normal: 'https://img.scryfall.com/cards/normal/front/test/1.jpg',
    cmc: 0,
    type: 'Artifact',
    colors: [],
    color_identity: [],
    parsed_cost: [],
    colorcategory: 'Colorless',
    border_color: 'black',
    language: 'en',
    mtgo_id: 1,
    layout: 'normal',
    full_art: false,
    error: false,
    games: ['paper'],
    reserved: true,
    prices: {},
    tokens: [],
    keywords: [],
    set_name: 'Test Set',
    produced_mana: [],
    finishes: ['nonfoil'],
  };

  const mockCard2 = {
    scryfall_id: 'test-card-2',
    oracle_id: 'oracle-2',
    released_at: '2024-01-01',
    isToken: false,
    finishes: ['nonfoil'],
    set: 'tst',
    setIndex: 0,
    collector_number: '2',
    promo: false,
    reprint: false,
    digital: false,
    full_name: 'Lightning Bolt [tst-2]',
    name: 'Lightning Bolt',
    name_lower: 'lightning bolt',
    artist: 'Christopher Rush',
    scryfall_uri: 'https://scryfall.com/card/test/2',
    rarity: 'common',
    legalities: {
      standard: 'not_legal',
      future: 'not_legal',
      historic: 'not_legal',
      gladiator: 'not_legal',
      pioneer: 'not_legal',
      explorer: 'not_legal',
      modern: 'legal',
      legacy: 'legal',
      pauper: 'legal',
      vintage: 'legal',
      penny: 'not_legal',
      commander: 'legal',
      oathbreaker: 'legal',
      brawl: 'not_legal',
      standardbrawl: 'not_legal',
      alchemy: 'not_legal',
      paupercommander: 'legal',
      duel: 'legal',
      oldschool: 'not_legal',
      premodern: 'legal',
      predh: 'legal',
      timeless: 'not_legal',
    },
    oracle_text: 'Lightning Bolt deals 3 damage to any target.',
    image_normal: 'https://img.scryfall.com/cards/normal/front/test/2.jpg',
    cmc: 1,
    type: 'Instant',
    colors: ['R'],
    color_identity: ['R'],
    parsed_cost: ['r'],
    colorcategory: 'Red',
    border_color: 'black',
    language: 'en',
    mtgo_id: 0,
    layout: 'normal',
    tcgplayer_id: '',
    power: '',
    toughness: '',
    loyalty: '',
    error: false,
    full_art: false,
    prices: {
      usd: 0.5,
    },
    tokens: [],
    set_name: 'Test Set',
    produced_mana: [],
    keywords: [],
    games: ['paper'],
    reserved: false,
  };

  const mockCard3 = {
    scryfall_id: 'test-card-3',
    oracle_id: 'oracle-3',
    released_at: '2023-01-01',
    isToken: false,
    finishes: ['nonfoil'],
    set: 'tst',
    setIndex: 0,
    collector_number: '3',
    promo: false,
    reprint: false,
    digital: false,
    full_name: 'Llanowar Elves [tst-3]',
    name: 'Llanowar Elves',
    name_lower: 'llanowar elves',
    artist: 'Kev Walker',
    scryfall_uri: 'https://scryfall.com/card/test/3',
    rarity: 'common',
    legalities: {
      standard: 'not_legal',
      future: 'not_legal',
      historic: 'legal',
      gladiator: 'legal',
      pioneer: 'legal',
      explorer: 'legal',
      modern: 'legal',
      legacy: 'legal',
      pauper: 'legal',
      vintage: 'legal',
      penny: 'not_legal',
      commander: 'legal',
      oathbreaker: 'legal',
      brawl: 'not_legal',
      standardbrawl: 'not_legal',
      alchemy: 'not_legal',
      paupercommander: 'legal',
      duel: 'legal',
      oldschool: 'legal',
      premodern: 'legal',
      predh: 'legal',
      timeless: 'legal',
    },
    oracle_text: '{T}: Add {G}.',
    image_normal: 'https://img.scryfall.com/cards/normal/front/test/3.jpg',
    cmc: 1,
    type: 'Creature — Elf Druid',
    colors: ['G'],
    color_identity: ['G'],
    parsed_cost: ['g'],
    colorcategory: 'Green',
    border_color: 'black',
    language: 'en',
    mtgo_id: 0,
    layout: 'normal',
    tcgplayer_id: '',
    power: '1',
    toughness: '1',
    loyalty: '',
    error: false,
    full_art: false,
    prices: {},
    tokens: [],
    set_name: 'Test Set',
    produced_mana: ['G'],
    keywords: [],
    games: ['paper'],
    reserved: false,
  };

  const carddict = {
    'test-card-1': mockCard1,
    'test-card-2': mockCard2,
    'test-card-3': mockCard3,
  };

  const nameToId = {
    'black lotus': ['test-card-1'],
    'lightning bolt': ['test-card-2'],
    'llanowar elves': ['test-card-3'],
  };

  const oracleToId = {
    'oracle-1': ['test-card-1'],
    'oracle-2': ['test-card-2'],
    'oracle-3': ['test-card-3'],
  };

  const indexToOracle = ['oracle-1', 'oracle-2', 'oracle-3'];

  const cardnames = ['Black Lotus', 'Lightning Bolt', 'Llanowar Elves'];

  const fullNames = ['Black Lotus [tst-1]', 'Lightning Bolt [tst-2]', 'Llanowar Elves [tst-3]'];

  const imagedict = {
    'black lotus [tst-1]': {
      uri: 'https://img.scryfall.com/cards/normal/front/test/1.jpg',
      artist: 'Christopher Rush',
      id: 'test-card-1',
      imageName: 'black lotus [tst-1]',
    },
    'lightning bolt [tst-2]': {
      uri: 'https://img.scryfall.com/cards/normal/front/test/2.jpg',
      artist: 'Christopher Rush',
      id: 'test-card-2',
      imageName: 'lightning bolt [tst-2]',
    },
    'llanowar elves [tst-3]': {
      uri: 'https://img.scryfall.com/cards/normal/front/test/3.jpg',
      artist: 'Kev Walker',
      id: 'test-card-3',
      imageName: 'llanowar elves [tst-3]',
    },
  };

  const cardimages = {
    'test-card-1': {
      uri: 'https://img.scryfall.com/cards/normal/front/test/1.jpg',
      artist: 'Christopher Rush',
      id: 'test-card-1',
      imageName: 'black lotus [tst-1]',
    },
    'test-card-2': {
      uri: 'https://img.scryfall.com/cards/normal/front/test/2.jpg',
      artist: 'Christopher Rush',
      id: 'test-card-2',
      imageName: 'lightning bolt [tst-2]',
    },
    'test-card-3': {
      uri: 'https://img.scryfall.com/cards/normal/front/test/3.jpg',
      artist: 'Kev Walker',
      id: 'test-card-3',
      imageName: 'llanowar elves [tst-3]',
    },
  };

  const english = {
    'test-card-1': 'test-card-1',
    'test-card-2': 'test-card-2',
    'test-card-3': 'test-card-3',
  };

  const metadatadict = {};
  const cardtree = {};
  const comboTree = {};
  const cubeEmbeddings = {};

  // Create indexToOracleMap for ML models (maps index to oracle_id)
  const indexToOracleMap: Record<string, string> = {
    '0': 'oracle-1',
    '1': 'oracle-2',
    '2': 'oracle-3',
  };

  // Write all files
  fs.writeFileSync('../server/private/carddict.json', JSON.stringify(carddict, null, 2));
  fs.writeFileSync('../server/private/nameToId.json', JSON.stringify(nameToId, null, 2));
  fs.writeFileSync('../server/private/oracleToId.json', JSON.stringify(oracleToId, null, 2));
  fs.writeFileSync('../server/private/indexToOracle.json', JSON.stringify(indexToOracle, null, 2));
  fs.writeFileSync('../server/private/names.json', JSON.stringify(cardnames, null, 2));
  fs.writeFileSync('../server/private/full_names.json', JSON.stringify(fullNames, null, 2));
  fs.writeFileSync('../server/private/imagedict.json', JSON.stringify(imagedict, null, 2));
  fs.writeFileSync('../server/private/cardimages.json', JSON.stringify(cardimages, null, 2));
  fs.writeFileSync('../server/private/english.json', JSON.stringify(english, null, 2));
  fs.writeFileSync('../server/private/metadatadict.json', JSON.stringify(metadatadict, null, 2));
  fs.writeFileSync('../server/private/cardtree.json', JSON.stringify(cardtree, null, 2));
  fs.writeFileSync('../server/private/comboTree.json', JSON.stringify(comboTree, null, 2));
  fs.writeFileSync('../server/private/cubeEmbeddings.json', JSON.stringify(cubeEmbeddings, null, 2));

  // Write ML model file
  fs.writeFileSync('../server/model/indexToOracleMap.json', JSON.stringify(indexToOracleMap, null, 2));

  console.log('Created mock card catalog files with 3 test cards');
}

createMockFiles();
