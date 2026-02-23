import fs from 'fs';

interface MockCardSpec {
  name: string;
  oracle_text: string;
  cmc: number;
  type: string;
  colors: string[];
  color_identity: string[];
  parsed_cost: string[];
  colorcategory: string;
  rarity: string;
  power?: string;
  toughness?: string;
  produced_mana?: string[];
  reserved?: boolean;
  keywords?: string[];
  artist?: string;
}

function createMockFiles() {
  // Ensure directories exist
  fs.mkdirSync('../server/private/', { recursive: true });
  fs.mkdirSync('../server/model/', { recursive: true });

  // Card specifications — each card gets test-card-N IDs and oracle-N oracle IDs
  const cardSpecs: MockCardSpec[] = [
    {
      name: 'Black Lotus',
      oracle_text: '{T}: Add three mana of any one color.',
      cmc: 0,
      type: 'Artifact',
      colors: [],
      color_identity: [],
      parsed_cost: [],
      colorcategory: 'Colorless',
      rarity: 'rare',
      reserved: true,
    },
    {
      name: 'Lightning Bolt',
      oracle_text: 'Lightning Bolt deals 3 damage to any target.',
      cmc: 1,
      type: 'Instant',
      colors: ['R'],
      color_identity: ['R'],
      parsed_cost: ['r'],
      colorcategory: 'Red',
      rarity: 'common',
    },
    {
      name: 'Llanowar Elves',
      oracle_text: '{T}: Add {G}.',
      cmc: 1,
      type: 'Creature — Elf Druid',
      colors: ['G'],
      color_identity: ['G'],
      parsed_cost: ['g'],
      colorcategory: 'Green',
      rarity: 'common',
      power: '1',
      toughness: '1',
      produced_mana: ['G'],
    },
    {
      name: 'Counterspell',
      oracle_text: 'Counter target spell.',
      cmc: 2,
      type: 'Instant',
      colors: ['U'],
      color_identity: ['U'],
      parsed_cost: ['u', 'u'],
      colorcategory: 'Blue',
      rarity: 'common',
    },
    {
      name: 'Swords to Plowshares',
      oracle_text: 'Exile target creature. Its controller gains life equal to its power.',
      cmc: 1,
      type: 'Instant',
      colors: ['W'],
      color_identity: ['W'],
      parsed_cost: ['w'],
      colorcategory: 'White',
      rarity: 'uncommon',
    },
    {
      name: 'Dark Ritual',
      oracle_text: 'Add {B}{B}{B}.',
      cmc: 1,
      type: 'Instant',
      colors: ['B'],
      color_identity: ['B'],
      parsed_cost: ['b'],
      colorcategory: 'Black',
      rarity: 'common',
      produced_mana: ['B'],
    },
    {
      name: 'Giant Growth',
      oracle_text: 'Target creature gets +3/+3 until end of turn.',
      cmc: 1,
      type: 'Instant',
      colors: ['G'],
      color_identity: ['G'],
      parsed_cost: ['g'],
      colorcategory: 'Green',
      rarity: 'common',
    },
    {
      name: 'Birds of Paradise',
      oracle_text: 'Flying\n{T}: Add one mana of any color.',
      cmc: 1,
      type: 'Creature — Bird',
      colors: ['G'],
      color_identity: ['G'],
      parsed_cost: ['g'],
      colorcategory: 'Green',
      rarity: 'rare',
      power: '0',
      toughness: '1',
      produced_mana: ['W', 'U', 'B', 'R', 'G'],
      keywords: ['flying'],
    },
    {
      name: 'Sol Ring',
      oracle_text: '{T}: Add {C}{C}.',
      cmc: 1,
      type: 'Artifact',
      colors: [],
      color_identity: [],
      parsed_cost: ['1'],
      colorcategory: 'Colorless',
      rarity: 'uncommon',
      produced_mana: ['C'],
    },
    {
      name: 'Brainstorm',
      oracle_text: 'Draw three cards, then put two cards from your hand on top of your library in any order.',
      cmc: 1,
      type: 'Instant',
      colors: ['U'],
      color_identity: ['U'],
      parsed_cost: ['u'],
      colorcategory: 'Blue',
      rarity: 'common',
    },
    {
      name: 'Path to Exile',
      oracle_text:
        'Exile target creature. Its controller may search their library for a basic land card, put that card onto the battlefield tapped, then shuffle.',
      cmc: 1,
      type: 'Instant',
      colors: ['W'],
      color_identity: ['W'],
      parsed_cost: ['w'],
      colorcategory: 'White',
      rarity: 'uncommon',
    },
    {
      name: 'Thoughtseize',
      oracle_text:
        'Target player reveals their hand. You choose a nonland card from it. That player discards that card. You lose 2 life.',
      cmc: 1,
      type: 'Sorcery',
      colors: ['B'],
      color_identity: ['B'],
      parsed_cost: ['b'],
      colorcategory: 'Black',
      rarity: 'rare',
    },
    {
      name: 'Fatal Push',
      oracle_text:
        'Destroy target creature if it has mana value 2 or less. Revolt — Destroy that creature if it has mana value 4 or less instead if a permanent you controlled left the battlefield this turn.',
      cmc: 1,
      type: 'Instant',
      colors: ['B'],
      color_identity: ['B'],
      parsed_cost: ['b'],
      colorcategory: 'Black',
      rarity: 'uncommon',
      keywords: ['revolt'],
    },
    {
      name: 'Mana Leak',
      oracle_text: 'Counter target spell unless its controller pays {3}.',
      cmc: 2,
      type: 'Instant',
      colors: ['U'],
      color_identity: ['U'],
      parsed_cost: ['1', 'u'],
      colorcategory: 'Blue',
      rarity: 'common',
    },
    {
      name: 'Doom Blade',
      oracle_text: 'Destroy target nonblack creature.',
      cmc: 2,
      type: 'Instant',
      colors: ['B'],
      color_identity: ['B'],
      parsed_cost: ['1', 'b'],
      colorcategory: 'Black',
      rarity: 'common',
    },
    {
      name: 'Rampant Growth',
      oracle_text:
        'Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.',
      cmc: 2,
      type: 'Sorcery',
      colors: ['G'],
      color_identity: ['G'],
      parsed_cost: ['1', 'g'],
      colorcategory: 'Green',
      rarity: 'common',
    },
  ];

  // Generate all data structures from the card specs
  const carddict: Record<string, any> = {};
  const nameToId: Record<string, string[]> = {};
  const oracleToId: Record<string, string[]> = {};
  const indexToOracle: string[] = [];
  const cardnames: string[] = [];
  const fullNames: string[] = [];
  const imagedict: Record<string, any> = {};
  const cardimages: Record<string, any> = {};
  const english: Record<string, string> = {};
  const comboOracleToIndex: Record<string, number> = {};
  const indexToOracleMap: Record<string, string> = {};

  const defaultArtists = ['Christopher Rush', 'Kev Walker', 'Ron Spencer', 'Terese Nielsen', 'Mark Poole'];

  cardSpecs.forEach((spec, index) => {
    const num = index + 1;
    const scryfallId = `test-card-${num}`;
    const oracleId = `oracle-${num}`;
    const fullName = `${spec.name} [tst-${num}]`;
    const nameLower = spec.name.toLowerCase();
    const artist = spec.artist || defaultArtists[index % defaultArtists.length];
    const imageUri = `https://img.scryfall.com/cards/normal/front/test/${num}.jpg`;

    carddict[scryfallId] = {
      scryfall_id: scryfallId,
      oracle_id: oracleId,
      name: spec.name,
      set: 'tst',
      setIndex: 0,
      collector_number: String(num),
      released_at: '2024-01-01',
      promo: false,
      reprint: false,
      digital: false,
      isToken: false,
      full_name: fullName,
      name_lower: nameLower,
      artist,
      scryfall_uri: `https://scryfall.com/card/test/${num}`,
      rarity: spec.rarity,
      legalities: {
        standard: 'not_legal',
        future: 'not_legal',
        historic: 'legal',
        timeless: 'legal',
        gladiator: 'legal',
        pioneer: 'legal',
        explorer: 'legal',
        modern: 'legal',
        legacy: 'legal',
        pauper: spec.rarity === 'common' ? 'legal' : 'not_legal',
        vintage: 'legal',
        penny: 'not_legal',
        commander: 'legal',
        oathbreaker: 'legal',
        standardbrawl: 'not_legal',
        brawl: 'not_legal',
        alchemy: 'not_legal',
        paupercommander: spec.rarity === 'common' ? 'legal' : 'not_legal',
        duel: 'legal',
        oldschool: 'not_legal',
        premodern: 'legal',
        predh: 'legal',
      },
      oracle_text: spec.oracle_text,
      image_normal: imageUri,
      art_crop: imageUri,
      cmc: spec.cmc,
      type: spec.type,
      colors: spec.colors,
      color_identity: spec.color_identity,
      parsed_cost: spec.parsed_cost,
      colorcategory: spec.colorcategory,
      border_color: 'black',
      language: 'en',
      mtgo_id: 0,
      layout: 'normal',
      tcgplayer_id: '',
      power: spec.power || '',
      toughness: spec.toughness || '',
      loyalty: '',
      error: false,
      full_art: false,
      prices: {},
      tokens: [],
      set_name: 'Test Set',
      produced_mana: spec.produced_mana || [],
      keywords: spec.keywords || [],
      games: ['paper'],
      reserved: spec.reserved || false,
      finishes: ['nonfoil'],
    };

    nameToId[nameLower] = [scryfallId];
    oracleToId[oracleId] = [scryfallId];
    indexToOracle.push(oracleId);
    cardnames.push(spec.name);
    fullNames.push(fullName);

    imagedict[fullName.toLowerCase()] = {
      uri: imageUri,
      artist,
      id: scryfallId,
      imageName: fullName.toLowerCase(),
    };

    cardimages[scryfallId] = {
      uri: imageUri,
      artist,
      id: scryfallId,
      imageName: fullName.toLowerCase(),
    };

    english[scryfallId] = scryfallId;
    comboOracleToIndex[oracleId] = index;
    indexToOracleMap[String(index)] = oracleId;
  });

  // Default fallback image used by getImageData when imageName is not found
  imagedict['doubling cube [10e-321]'] = {
    uri: 'https://img.scryfall.com/cards/normal/front/test/default.jpg',
    artist: 'Ron Spencer',
    id: 'default-image',
    imageName: 'doubling cube [10e-321]',
  };

  const metadatadict = {};
  const cardtree = {};
  const comboTree = {};
  const cubeEmbeddings = {};

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
  fs.writeFileSync('../server/private/comboOracleToIndex.json', JSON.stringify(comboOracleToIndex, null, 2));
  fs.writeFileSync('../server/private/cubeEmbeddings.json', JSON.stringify(cubeEmbeddings, null, 2));

  // Write ML model file
  fs.writeFileSync('../server/model/indexToOracleMap.json', JSON.stringify(indexToOracleMap, null, 2));

  console.log(`Created mock card catalog files with ${cardSpecs.length} test cards`);
}

createMockFiles();
