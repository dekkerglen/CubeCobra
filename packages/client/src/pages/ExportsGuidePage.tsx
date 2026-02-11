import React from 'react';

import { Card, CardBody, CardHeader } from 'components/base/Card';
import Container from 'components/base/Container';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';

const CodeBlock: React.FC<{ children: string }> = ({ children }) => (
  <pre className="bg-bg-active text-text p-3 rounded font-mono text-sm overflow-x-auto border border-border whitespace-pre-wrap">
    {children}
  </pre>
);

const ExportsGuidePage: React.FC = () => (
  <MainLayout>
    <Container sm>
      <Flexbox direction="col" gap="4" className="my-4">
        <Text semibold xxl className="text-center mb-2">
          Data Exports Guide
        </Text>
        <Text md className="text-text-secondary text-center mb-4">
          Complete documentation for CubeCobra's public data exports
        </Text>

        {/* Download Instructions */}
        <Card>
          <CardHeader>
            <Text semibold lg>
              Downloading the Data
            </Text>
          </CardHeader>
          <CardBody>
            <Flexbox direction="col" gap="3">
              <Text md className="text-text-secondary">
                All exported data is available from our public S3 bucket. You can download the entire dataset using the{' '}
                <Link
                  href="https://docs.aws.amazon.com/cli/latest/userguide/getting-started-quickstart.html"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  AWS CLI
                </Link>
                :
              </Text>
              <CodeBlock>aws s3 sync s3://cubecobra-public/export/ ./data/ --no-sign-request</CodeBlock>
              <Text sm className="text-text-secondary">
                Data exports are updated every three months. See the{' '}
                <Link href="/tool/cardupdates">Card Database Status</Link> page for the date of the most recent export.
              </Text>
            </Flexbox>
          </CardBody>
        </Card>

        {/* Overview */}
        <Card>
          <CardHeader>
            <Text semibold lg>
              Export Structure Overview
            </Text>
          </CardHeader>
          <CardBody>
            <Flexbox direction="col" gap="3">
              <Text md className="text-text-secondary">
                The export consists of several JSON files that work together. To minimize file sizes, cards are
                represented as numeric indexes rather than full card names or IDs. Understanding the index system is key
                to working with this data.
              </Text>
              <CodeBlock>
                {`export/
├── indexToOracleMap.json    # Index → Oracle ID mapping
├── simpleCardDict.json      # Oracle ID → Card metadata
├── cubes.json               # All cube lists
├── decks/
│   └── {n}.json             # Completed draft decks (batched)
├── picks/
│   └── {n}.json             # Individual draft picks (batched)
└── cubeInstances/
    └── {n}.json             # Draft card pools (batched)`}
              </CodeBlock>
            </Flexbox>
          </CardBody>
        </Card>

        {/* Index to Oracle System */}
        <Card>
          <CardHeader>
            <Text semibold lg>
              The Index System
            </Text>
          </CardHeader>
          <CardBody>
            <Flexbox direction="col" gap="3">
              <Text md className="text-text-secondary">
                To keep file sizes manageable, all cards throughout the export are represented as numeric indexes. These
                indexes map to Scryfall Oracle IDs, which uniquely identify each card regardless of printing.
              </Text>

              <Text semibold md className="mt-2">
                indexToOracleMap.json
              </Text>
              <Text sm className="text-text-secondary">
                A mapping from numeric index to Oracle ID. Use this to convert card indexes found elsewhere in the
                export to Oracle IDs.
              </Text>
              <CodeBlock>
                {`{
  "0": "0000579f-7b35-4ed3-b44c-db2a538066fe",
  "1": "00006596-1166-4a79-8443-ca9f82e6db4e",
  "2": "0000a54c-a511-4925-92dc-01b937f9afad",
  ...
}`}
              </CodeBlock>

              <Text semibold md className="mt-2">
                simpleCardDict.json
              </Text>
              <Text sm className="text-text-secondary">
                Card metadata keyed by Oracle ID. After converting an index to an Oracle ID, look it up here to get card
                details.
              </Text>
              <CodeBlock>
                {`{
  "0000579f-7b35-4ed3-b44c-db2a538066fe": {
    "name": "Eli, Wings of Fealty",
    "image": "https://cards.scryfall.io/small/front/...",
    "elo": 1205,
    "type": "Legendary Creature — Angel",
    "cmc": 4
  },
  ...
}`}
              </CodeBlock>

              <Text semibold md className="mt-2">
                Converting Index to Card
              </Text>
              <Text sm className="text-text-secondary">
                To resolve a card index to its full details:
              </Text>
              <CodeBlock>
                {`// Example: Convert index 42 to card data
const indexToOracle = indexToOracleMap["42"];  // Get Oracle ID
const card = simpleCardDict[indexToOracle];     // Get card details
console.log(card.name);                         // "Lightning Bolt"`}
              </CodeBlock>
            </Flexbox>
          </CardBody>
        </Card>

        {/* Cubes */}
        <Card>
          <CardHeader>
            <Text semibold lg>
              cubes.json
            </Text>
          </CardHeader>
          <CardBody>
            <Flexbox direction="col" gap="3">
              <Text md className="text-text-secondary">
                Contains all public cubes on CubeCobra. Each cube's card list is represented as an array of card
                indexes.
              </Text>
              <CodeBlock>
                {`[
  {
    "id": "abc123",
    "name": "My Vintage Cube",
    "owner": "username",
    "owner_id": "user-uuid",
    "image_uri": "https://...",
    "image_artist": "Artist Name",
    "card_count": 540,
    "following": 42,
    "cards": [0, 15, 42, 103, ...]  // Card indexes
  },
  ...
]`}
              </CodeBlock>
              <Text sm className="text-text-secondary">
                The <code className="bg-bg-active px-1 rounded">cards</code> array contains numeric indexes. Use{' '}
                <code className="bg-bg-active px-1 rounded">indexToOracleMap.json</code> to convert these to Oracle IDs.
              </Text>
            </Flexbox>
          </CardBody>
        </Card>

        {/* Decks */}
        <Card>
          <CardHeader>
            <Text semibold lg>
              decks/{'{n}'}.json
            </Text>
          </CardHeader>
          <CardBody>
            <Flexbox direction="col" gap="3">
              <Text md className="text-text-secondary">
                Contains completed draft decks, batched across multiple files. Each file contains an array of deck
                objects from completed drafts.
              </Text>
              <CodeBlock>
                {`[
  {
    "id": "draft-uuid",
    "cube": "cube-uuid",
    "owner": "user-uuid",
    "mainboard": [42, 103, 256, ...],  // Card indexes
    "sideboard": [15, 89, ...],         // Card indexes
    "basics": [1204, 1204, 1205, ...]   // Basic land indexes
  },
  ...
]`}
              </CodeBlock>
              <Text sm className="text-text-secondary">
                All card references are numeric indexes. Multiple decks may share the same{' '}
                <code className="bg-bg-active px-1 rounded">id</code> if the draft had multiple players.
              </Text>
            </Flexbox>
          </CardBody>
        </Card>

        {/* Picks and CubeInstances */}
        <Card>
          <CardHeader>
            <Text semibold lg>
              picks/{'{n}'}.json and cubeInstances/{'{n}'}.json
            </Text>
          </CardHeader>
          <CardBody>
            <Flexbox direction="col" gap="3">
              <Text md className="text-text-secondary">
                These two files work together to represent individual draft picks. The{' '}
                <code className="bg-bg-active px-1 rounded">picks</code> files contain pick-by-pick draft decisions,
                while <code className="bg-bg-active px-1 rounded">cubeInstances</code> contains the card pool for each
                draft.
              </Text>

              <Text semibold md className="mt-2">
                picks/{'{n}'}.json
              </Text>
              <Text sm className="text-text-secondary">
                Each pick object represents a single pick decision during a draft:
              </Text>
              <CodeBlock>
                {`[
  {
    "cube": "cube-uuid",
    "cubeCards": 0,           // Index into cubeInstances array
    "owner": "user-uuid",
    "pack": [5, 12, 8, 3],    // Cards in pack (cubeInstance indexes)
    "picked": 5,              // Card picked (cubeInstance index)
    "pool": [2, 7]            // Cards already drafted (cubeInstance indexes)
  },
  ...
]`}
              </CodeBlock>

              <Text semibold md className="mt-2">
                cubeInstances/{'{n}'}.json
              </Text>
              <Text sm className="text-text-secondary">
                An array of card pools, where each entry is the complete list of cards available in a specific draft:
              </Text>
              <CodeBlock>
                {`[
  [42, 103, 256, 89, ...],   // Draft 0's card pool (card indexes)
  [15, 88, 201, 44, ...],    // Draft 1's card pool (card indexes)
  ...
]`}
              </CodeBlock>

              <Text semibold md className="mt-3">
                Understanding the Relationship
              </Text>
              <Text sm className="text-text-secondary">
                The picks file uses a two-level index system:
              </Text>
              <ol className="list-decimal list-inside space-y-2 text-text-secondary ml-4 mt-2">
                <li>
                  <code className="bg-bg-active px-1 rounded">cubeCards</code> points to an entry in the{' '}
                  <code className="bg-bg-active px-1 rounded">cubeInstances</code> array (the draft's card pool)
                </li>
                <li>
                  <code className="bg-bg-active px-1 rounded">pack</code>,{' '}
                  <code className="bg-bg-active px-1 rounded">picked</code>, and{' '}
                  <code className="bg-bg-active px-1 rounded">pool</code> contain indexes into that specific cube
                  instance
                </li>
                <li>
                  The values in the cube instance are card indexes that map to{' '}
                  <code className="bg-bg-active px-1 rounded">indexToOracleMap.json</code>
                </li>
              </ol>

              <Text semibold md className="mt-3">
                Example: Resolving a Pick
              </Text>
              <CodeBlock>
                {`// Given a pick object:
const pick = { cubeCards: 0, picked: 5, pack: [5, 12, 8], ... };

// Step 1: Get the cube instance (draft's card pool)
const cubeInstance = cubeInstances[pick.cubeCards];

// Step 2: Get the card index from the cube instance
const cardIndex = cubeInstance[pick.picked];

// Step 3: Convert to Oracle ID
const oracleId = indexToOracleMap[cardIndex];

// Step 4: Get card details
const card = simpleCardDict[oracleId];
console.log(card.name);  // "Black Lotus"`}
              </CodeBlock>
            </Flexbox>
          </CardBody>
        </Card>

        {/* Use Cases */}
        <Card>
          <CardHeader>
            <Text semibold lg>
              Common Use Cases
            </Text>
          </CardHeader>
          <CardBody>
            <Flexbox direction="col" gap="3">
              <ul className="list-disc list-inside space-y-3 text-text-secondary">
                <li>
                  <span className="font-semibold">Cube Analytics:</span> Use{' '}
                  <code className="bg-bg-active px-1 rounded">cubes.json</code> to analyze card inclusion rates, cube
                  sizes, and popular cards across the platform.
                </li>
                <li>
                  <span className="font-semibold">Draft AI Training:</span> The{' '}
                  <code className="bg-bg-active px-1 rounded">picks</code> data provides labeled training examples with
                  pack contents, pool context, and human decisions.
                </li>
                <li>
                  <span className="font-semibold">Deck Analysis:</span> Use{' '}
                  <code className="bg-bg-active px-1 rounded">decks</code> to study deck archetypes, mana curves, and
                  card synergies in actual drafted decks.
                </li>
                <li>
                  <span className="font-semibold">Card Correlations:</span> Analyze which cards appear together in cubes
                  or get drafted together in decks.
                </li>
              </ul>
            </Flexbox>
          </CardBody>
        </Card>

        {/* License */}
        <Card>
          <CardHeader>
            <Text semibold lg>
              License & Attribution
            </Text>
          </CardHeader>
          <CardBody>
            <Flexbox direction="col" gap="3">
              <Text md className="text-text-secondary">
                This data is provided freely for research, analysis, and tool development. Card images and Oracle data
                are sourced from{' '}
                <Link href="https://scryfall.com" target="_blank" rel="noopener noreferrer">
                  Scryfall
                </Link>{' '}
                and are subject to their terms of use. If you build something with this data, we'd love to hear about
                it!
              </Text>
            </Flexbox>
          </CardBody>
        </Card>
      </Flexbox>
    </Container>
  </MainLayout>
);

export default RenderToRoot(ExportsGuidePage);
