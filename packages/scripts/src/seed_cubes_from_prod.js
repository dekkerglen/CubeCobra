/**
 * Seeds local DynamoDB + S3 with cubes fetched from production CubeCobra.
 *
 * Usage (from repo root, inside the Docker container):
 *   node packages/scripts/src/seed_cubes_from_prod.js [cubeId1] [cubeId2] ...
 *
 * If no arguments are provided, seeds a default set of cubes.
 *
 * Environment variables (set automatically in Docker):
 *   AWS_ENDPOINT     - localstack endpoint (default: http://localstack:4566)
 *   DYNAMO_TABLE     - table name (default: LOCAL_CUBECOBRA)
 *   DATA_BUCKET      - S3 bucket (default: local)
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const PROD_BASE = 'https://cubecobra.com';
const TABLE = process.env.DYNAMO_TABLE || 'LOCAL_CUBECOBRA';
const BUCKET = process.env.DATA_BUCKET || 'local';
const ENDPOINT = process.env.AWS_ENDPOINT || 'http://localstack:4566';

const DEFAULT_CUBES = [
  'buildaround',
  'loam',
  '768edbac-627d-4e18-b555-4001ee1e5a13',
  '5f76cacbdebf310362b90289',  // Peasant
  '5fbb1c695132cb1052b6cec8',  // EDH
  '2f86175d-8675-4c23-bc20-644c6e9dcb07', // Old School
  '5ed16b287b7511525c0ca115',  // Premodern
  '5f7e7898164e9c108aa048ff',  // Un-Cube
  '5d8cdc9ddabc762f670c1d2a',  // Set Cubes (Innistrad)
  '5d5a660dc734425dbc94116a',  // Mono Black
  '5d2cb3f44153591614458e5d',  // MTGO Vintage Cube
  '5fbdb0735132cb1052e2a6a9',  // Unpowered Stuff
];

const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: 'us-east-1',
    endpoint: ENDPOINT,
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  }),
  { marshallOptions: { removeUndefinedValues: true } },
);

const s3Client = new S3Client({
  region: 'us-east-1',
  endpoint: ENDPOINT,
  credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  forcePathStyle: true,
});

async function fetchCubeFromProd(cubeId) {
  const url = `${PROD_BASE}/cube/api/cubeJSON/${encodeURIComponent(cubeId)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch cube ${cubeId}: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function ensureOwnerUser(ownerId, ownerUsername) {
  const existing = await dynamoClient.send(
    new GetCommand({ TableName: TABLE, Key: { PK: `USER#${ownerId}`, SK: 'USER' } }),
  );
  if (existing.Item) return;

  const passwordHash = await bcrypt.hash('password123', 10);
  const usernameLower = (ownerUsername || 'seeduser').toLowerCase();

  await dynamoClient.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK: `USER#${ownerId}`,
        SK: 'USER',
        GSI1PK: `USER#USERNAME#${usernameLower}`,
        GSI1SK: 'USER',
        DynamoVersion: 1,
        item: {
          id: ownerId,
          username: ownerUsername || 'seeduser',
          usernameLower,
          passwordHash,
          email: `${usernameLower}@local.dev`,
          emailVerified: true,
          about: '',
          imageName: 'Ambush Viper',
          roles: [],
          theme: 'system',
          hideFeatured: false,
          followedCubes: [],
          followedUsers: [],
          notifications: [],
          patron: '',
        },
      },
    }),
  );
  console.log(`  Created owner user: ${ownerUsername} (${ownerId})`);
}

function stripCardDetails(cards) {
  const stripped = {};
  for (const [board, list] of Object.entries(cards)) {
    if (!Array.isArray(list)) continue;
    stripped[board] = list.map((card) => {
      const { details, index, board: _b, editIndex, ...rest } = card;
      if (rest.tags) {
        rest.tags = rest.tags.map((t) => (typeof t === 'object' ? t.text : t));
      }
      return rest;
    });
  }
  return stripped;
}

/**
 * Replicates BaseDynamoDao.hash() — deterministic SHA-256 of sorted key-value pairs.
 */
async function computeHash(data) {
  data.ItemType = 'CUBE';
  const list = Object.entries(data)
    .map(([key, value]) => `${key}:${value}`)
    .sort();
  const hash = crypto.createHash('sha256').update(list.join(',')).digest();
  return Array.from(hash)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function writeHashRows(cubeDbId, cubeMeta, dateLastUpdated) {
  const shortId = cubeMeta.shortId;
  const cubeName = cubeMeta.name || '';
  const followers = (cubeMeta.following || []).length;
  const cardCount = cubeMeta.cardCount || 0;
  const hashPK = `HASH#CUBE#${cubeDbId}`;

  // Compute hashes we need for lookups
  const hashStrings = [];

  // shortId hash (critical for URL resolution)
  if (shortId) {
    hashStrings.push(await computeHash({ type: 'shortid', value: shortId }));
  }

  // generic "all cubes" hash
  hashStrings.push(await computeHash({ type: 'cube', value: 'all' }));

  // name keyword hashes
  if (cubeName) {
    const words = cubeName.replace(/[^\w\s]/gi, '').toLowerCase().split(' ').filter((w) => w.length > 0);
    for (let i = 0; i < words.length; i++) {
      for (let j = i + 1; j <= words.length; j++) {
        hashStrings.push(await computeHash({ type: 'keywords', value: words.slice(i, j).join(' ') }));
      }
    }
  }

  const uniqueHashes = [...new Set(hashStrings)];
  const rows = uniqueHashes.map((hashString) => ({
    PutRequest: {
      Item: {
        PK: hashPK,
        SK: hashString,
        GSI1PK: hashString,
        GSI1SK: `FOLLOWERS#${String(followers).padStart(10, '0')}`,
        GSI2PK: hashString,
        GSI2SK: `NAME#${cubeName.toLowerCase()}`,
        GSI3PK: hashString,
        GSI3SK: `CARDS#${String(cardCount).padStart(10, '0')}`,
        GSI4PK: hashString,
        GSI4SK: `DATE#${String(dateLastUpdated).padStart(15, '0')}`,
        cubeName,
        cubeFollowers: followers,
        cubeCardCount: cardCount,
      },
    },
  }));

  // Batch write in chunks of 25
  for (let i = 0; i < rows.length; i += 25) {
    await dynamoClient.send(
      new BatchWriteCommand({ RequestItems: { [TABLE]: rows.slice(i, i + 25) } }),
    );
  }

  return uniqueHashes.length;
}

async function seedCube(cubeId) {
  console.log(`\nFetching cube: ${cubeId}`);
  const data = await fetchCubeFromProd(cubeId);

  const { cards: rawCards, owner, image, ...cubeMeta } = data;
  const cubeDbId = cubeMeta.id || cubeId;
  const ownerId = typeof owner === 'object' ? owner.id : owner;
  const ownerUsername = typeof owner === 'object' ? owner.username : undefined;

  // Ensure owner user exists
  await ensureOwnerUser(ownerId, ownerUsername);

  // Strip card details for S3 storage
  const cardsForS3 = stripCardDetails(rawCards);

  // Upload cards to S3
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: `cube/${cubeDbId}.json`,
      Body: JSON.stringify(cardsForS3),
      ContentType: 'application/json',
    }),
  );

  // Calculate GSI keys
  const shard = cubeDbId.charCodeAt(cubeDbId.length - 1) % 10;
  const dateLastUpdated = cubeMeta.dateLastUpdated || cubeMeta.date || Date.now();

  const dynamoItem = {
    PK: `CUBE#${cubeDbId}`,
    SK: 'CUBE',
    GSI1PK: `CUBE#OWNER#${ownerId}`,
    GSI1SK: `DATE#${dateLastUpdated}`,
    GSI3PK: `CUBE#${shard}`,
    GSI3SK: cubeDbId,
    DynamoVersion: 1,
    item: {
      id: cubeDbId,
      shortId: cubeMeta.shortId || cubeId,
      owner: ownerId,
      name: cubeMeta.name || cubeId,
      visibility: cubeMeta.visibility || 'pu',
      priceVisibility: cubeMeta.priceVisibility || 'pu',
      featured: cubeMeta.featured || false,
      categoryOverride: cubeMeta.categoryOverride,
      categoryPrefixes: cubeMeta.categoryPrefixes || [],
      tagColors: cubeMeta.tagColors || [],
      defaultFormat: cubeMeta.defaultFormat ?? 0,
      numDecks: cubeMeta.numDecks || 0,
      description: cubeMeta.description || '',
      brief: cubeMeta.brief,
      imageName: cubeMeta.imageName || 'Ambush Viper',
      date: cubeMeta.date || Date.now(),
      dateCreated: cubeMeta.dateCreated || Date.now(),
      dateLastUpdated,
      defaultSorts: cubeMeta.defaultSorts || ['Color Category', 'Types-Multicolor'],
      showUnsorted: cubeMeta.showUnsorted,
      collapseDuplicateCards: cubeMeta.collapseDuplicateCards,
      formats: cubeMeta.formats || [],
      following: cubeMeta.following || [],
      collaborators: cubeMeta.collaborators || [],
      defaultStatus: cubeMeta.defaultStatus || 'Owned',
      defaultPrinting: cubeMeta.defaultPrinting || 'recent',
      disableAlerts: cubeMeta.disableAlerts || false,
      basics: cubeMeta.basics || [],
      views: cubeMeta.views,
      customSorts: cubeMeta.customSorts,
      tags: cubeMeta.tags || [],
      keywords: cubeMeta.keywords || [],
      cardCount: cubeMeta.cardCount || (rawCards.mainboard ? rawCards.mainboard.length : 0),
      version: cubeMeta.version || 1,
    },
  };

  await dynamoClient.send(new PutCommand({ TableName: TABLE, Item: dynamoItem }));

  // Write hash rows for shortId lookup and search
  const hashCount = await writeHashRows(cubeDbId, cubeMeta, dateLastUpdated);

  const mainboardCount = rawCards.mainboard ? rawCards.mainboard.length : 0;
  console.log(`  Seeded: "${cubeMeta.name}" (${cubeDbId}, shortId: ${cubeMeta.shortId}) - ${mainboardCount} cards, ${hashCount} hashes`);
}

async function main() {
  const cubeIds = process.argv.length > 2 ? process.argv.slice(2) : DEFAULT_CUBES;

  console.log(`Seeding ${cubeIds.length} cubes from production...`);
  console.log(`  DynamoDB table: ${TABLE}`);
  console.log(`  S3 bucket: ${BUCKET}`);
  console.log(`  Endpoint: ${ENDPOINT}`);

  let succeeded = 0;
  let failed = 0;

  for (const cubeId of cubeIds) {
    try {
      await seedCube(cubeId);
      succeeded++;
    } catch (err) {
      console.error(`  FAILED: ${cubeId} - ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone. ${succeeded} succeeded, ${failed} failed.`);
  console.log('Restart the cube container to pick up changes, or just hit the URLs:');
  for (const cubeId of cubeIds) {
    console.log(`  http://localhost:8080/cube/draftsimulator/${cubeId}`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
