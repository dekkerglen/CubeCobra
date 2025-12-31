// Thorough script to create DynamoDB table, S3 bucket, and insert mock card data for CI
const AWS = require('aws-sdk');

const dynamodb = new AWS.DynamoDB({
  endpoint: 'http://localhost:4566',
  region: 'us-east-1',
  accessKeyId: 'test',
  secretAccessKey: 'test',
});
const s3 = new AWS.S3({
  endpoint: 'http://localhost:4566',
  s3ForcePathStyle: true,
  region: 'us-east-1',
  accessKeyId: 'test',
  secretAccessKey: 'test',
});

const TABLE_NAME = 'local_CUBECOBRA';
const BUCKET_NAME = 'card-bucket';

// Sample card based on ScryfallCard and update_cards.ts
const MOCK_CARD = {
  id: 'mock-card-1',
  oracle_id: 'mock-oracle-1',
  name: 'Mock Card',
  lang: 'en',
  set: 'MCK',
  set_name: 'Mock Set',
  collector_number: '1',
  released_at: '2025-01-01',
  reprint: false,
  border_color: 'black',
  promo: false,
  promo_types: [],
  digital: false,
  finishes: ['nonfoil'],
  prices: {
    usd: '0.01',
    usd_foil: null,
    usd_etched: null,
    eur: null,
    tix: null,
  },
  image_uris: {
    small: '',
    normal: '',
    art_crop: '',
  },
  card_faces: undefined,
  loyalty: undefined,
  power: '1',
  toughness: '1',
  type_line: 'Creature — Test',
  oracle_text: 'This is a mock card for testing.',
  mana_cost: '{U}',
  cmc: 1,
  colors: ['U'],
  color_identity: ['U'],
  keywords: [],
  produced_mana: [],
  legalities: {
    standard: 'not_legal',
    modern: 'not_legal',
    legacy: 'not_legal',
    vintage: 'not_legal',
    commander: 'legal',
    pauper: 'not_legal',
    pioneer: 'not_legal',
    explorer: 'not_legal',
    brawl: 'not_legal',
    historic: 'not_legal',
    alchemy: 'not_legal',
    timeless: 'not_legal',
    gladiator: 'not_legal',
    oathbreaker: 'not_legal',
    premodern: 'not_legal',
    oldschool: 'not_legal',
  },
  layout: 'normal',
  rarity: 'common',
  artist: 'Test Artist',
  scryfall_uri: '',
  mtgo_id: 0,
  textless: false,
  tcgplayer_id: '',
  full_art: false,
  flavor_text: 'A test card.',
  frame_effects: [],
  frame: '',
  card_back_id: '',
  artist_id: '',
  illustration_id: '',
  content_warning: false,
  variation: false,
  games: ['paper'],
  reserved: false,
  preview: {
    source: '',
    source_uri: '',
    previewed_at: '',
  },
  related_uris: {
    gatherer: '',
    tcgplayer_decks: '',
    edhrec: '',
    mtgtop8: '',
  },
  all_parts: [],
  object: 'card',
};

// DynamoDB schema: PK/SK, plus card data as JSON
const MOCK_DDB_ITEM = {
  PK: { S: `CARD#${MOCK_CARD.id}` },
  SK: { S: `CARD#${MOCK_CARD.id}` },
  Data: { S: JSON.stringify(MOCK_CARD) },
  Name: { S: MOCK_CARD.name },
  Set: { S: MOCK_CARD.set },
  CollectorNumber: { S: MOCK_CARD.collector_number },
  OracleID: { S: MOCK_CARD.oracle_id },
};

async function createTable() {
  try {
    await dynamodb.createTable({
      TableName: TABLE_NAME,
      AttributeDefinitions: [
        { AttributeName: 'PK', AttributeType: 'S' },
        { AttributeName: 'SK', AttributeType: 'S' },
        { AttributeName: 'GSI1PK', AttributeType: 'S' },
        { AttributeName: 'GSI1SK', AttributeType: 'S' },
        { AttributeName: 'GSI2PK', AttributeType: 'S' },
        { AttributeName: 'GSI2SK', AttributeType: 'S' },
        { AttributeName: 'GSI3PK', AttributeType: 'S' },
        { AttributeName: 'GSI3SK', AttributeType: 'S' },
        { AttributeName: 'GSI4PK', AttributeType: 'S' },
        { AttributeName: 'GSI4SK', AttributeType: 'S' },
      ],
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' },
        { AttributeName: 'SK', KeyType: 'RANGE' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
      GlobalSecondaryIndexes: [
        {
          IndexName: 'GSI1',
          KeySchema: [
            { AttributeName: 'GSI1PK', KeyType: 'HASH' },
            { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
        {
          IndexName: 'GSI2',
          KeySchema: [
            { AttributeName: 'GSI2PK', KeyType: 'HASH' },
            { AttributeName: 'GSI2SK', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
        {
          IndexName: 'GSI3',
          KeySchema: [
            { AttributeName: 'GSI3PK', KeyType: 'HASH' },
            { AttributeName: 'GSI3SK', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
        {
          IndexName: 'GSI4',
          KeySchema: [
            { AttributeName: 'GSI4PK', KeyType: 'HASH' },
            { AttributeName: 'GSI4SK', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
    }).promise();
    console.log('DynamoDB table created');
  } catch (e) {
    if (e.code === 'ResourceInUseException') {
      console.log('DynamoDB table already exists');
    } else {
      throw e;
    }
  }
}

async function createBucket() {
  try {
    await s3.createBucket({ Bucket: BUCKET_NAME }).promise();
    console.log('S3 bucket created');
  } catch (e) {
    if (e.code === 'BucketAlreadyOwnedByYou') {
      console.log('S3 bucket already exists');
    } else {
      throw e;
    }
  }
}

async function insertMockData() {
  await dynamodb.putItem({
    TableName: TABLE_NAME,
    Item: MOCK_DDB_ITEM,
  }).promise();
  console.log('Inserted mock card data into DynamoDB');

  // Also upload a minimal JSON file to S3
  await s3.putObject({
    Bucket: BUCKET_NAME,
    Key: 'cards.json',
    Body: JSON.stringify([MOCK_CARD], null, 2),
    ContentType: 'application/json',
  }).promise();
  console.log('Uploaded cards.json to S3');
}

(async () => {
  await createTable();
  await createBucket();
  await insertMockData();
})();
