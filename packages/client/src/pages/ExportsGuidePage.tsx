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
    └── {n}.json             # Draft card pools (batched)

cards/
├── manifest.json            # Version/checksum for card data
├── carddict.json            # Complete card database
├── indexToOracle.json       # Index → Oracle mapping
├── metadatadict.json        # Card metadata (ELO, picks, etc.)
├── nameToId.json            # Card name → ID lookup
├── oracleToId.json          # Oracle ID → card ID lookup
├── cardtree.json            # Autocomplete search tree
├── names.json               # All card names
├── full_names.json          # Full card names with set info
├── imagedict.json           # Card image URLs
├── cardimages.json          # Additional image data
├── english.json             # English card names
├── comboTree.json           # Combo/synergy data
└── comboOracleToIndex.json  # Combo oracle mappings

model/
├── indexToOracleMap.json    # ML-specific oracle mapping
├── encoder/                 # Shared encoder model
│   └── model.json + weights
├── cube_decoder/            # Cube recommendation model
│   └── model.json + weights
├── deck_build_decoder/      # Deck building model
│   └── model.json + weights
└── draft_decoder/           # Draft pick model
    └── model.json + weights`}
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
    "name": "Lightning Bolt",
    "image": "https://cards.scryfall.io/small/front/...",
    "elo": 1205,
    "type": "Instant",
    "cmc": 1
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
                These files work together as parallel batches. The nth picks file (e.g.,{' '}
                <code className="bg-bg-active px-1 rounded">picks/0.json</code>) corresponds to the nth cubeInstances
                file (<code className="bg-bg-active px-1 rounded">cubeInstances/0.json</code>). Each picks file contains
                many pick decisions from multiple drafts in that batch, and the corresponding cubeInstances file
                contains the card pools for those drafts.
              </Text>

              <Text semibold md className="mt-2">
                picks/{'{n}'}.json
              </Text>
              <Text sm className="text-text-secondary">
                Each pick object represents a single pick decision during a draft. The{' '}
                <code className="bg-bg-active px-1 rounded">cubeCards</code> field is an index into the corresponding
                cubeInstances file's array:
              </Text>
              <CodeBlock>
                {`[
  {
    "cube": "cube-uuid",
    "cubeCards": 0,           // Index into cubeInstances/{n}.json array
    "owner": "user-uuid",
    "pack": [5, 12, 8, 3],    // Cards in pack (oracle indexes)
    "picked": 5,              // Card picked (oracle index)
    "pool": [2, 7]            // Cards already drafted (oracle indexes)
  },
  ...
]`}
              </CodeBlock>

              <Text semibold md className="mt-2">
                cubeInstances/{'{n}'}.json
              </Text>
              <Text sm className="text-text-secondary">
                An array of card pools, where each entry is the subset of cards from a cube that were used in a specific
                draft. This represents the total pool of cards available in that draft—the cards the drafter expected
                they might see:
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
                The picks and cubeInstances files form parallel arrays across files:
              </Text>
              <ol className="list-decimal list-inside space-y-2 text-text-secondary ml-4 mt-2">
                <li>
                  For picks in <code className="bg-bg-active px-1 rounded">picks/{'{n}'}.json</code>, look up{' '}
                  <code className="bg-bg-active px-1 rounded">cubeCards</code> in{' '}
                  <code className="bg-bg-active px-1 rounded">cubeInstances/{'{n}'}.json</code>
                </li>
                <li>
                  The cubeInstance is the card pool for that draft—a subset of the full cube used for this draft
                  session. This gives context for understanding the pick: what cards the drafter expected to see.
                </li>
                <li>
                  <code className="bg-bg-active px-1 rounded">pack</code>,{' '}
                  <code className="bg-bg-active px-1 rounded">picked</code>, and{' '}
                  <code className="bg-bg-active px-1 rounded">pool</code> are oracle indexes that map directly to{' '}
                  <code className="bg-bg-active px-1 rounded">indexToOracleMap.json</code>
                </li>
                <li>
                  The values in the cubeInstance are card indexes that map to{' '}
                  <code className="bg-bg-active px-1 rounded">indexToOracleMap.json</code>
                </li>
              </ol>

              <Text semibold md className="mt-3">
                Example: Resolving a Pick
              </Text>
              <CodeBlock>
                {`// Given a pick from picks/0.json:
const pick = { cubeCards: 0, picked: 42, pack: [42, 103, 256], pool: [15, 89], ... };

// pack, picked, and pool are already oracle indexes!
// Step 1: Convert picked card index to Oracle ID
const oracleId = indexToOracleMap[pick.picked];

// Step 2: Get card details
const card = simpleCardDict[oracleId];
console.log(card.name);  // "Lightning Bolt"

// The cubeInstance provides context (what cards the drafter expected to see)
const cubeInstances = loadJson('cubeInstances/0.json');
const cubeInstance = cubeInstances[pick.cubeCards];  // Also oracle indexes`}
              </CodeBlock>
            </Flexbox>
          </CardBody>
        </Card>

        {/* Card Data Files */}
        <Card>
          <CardHeader>
            <Text semibold lg>
              cards/ - Card Database Files
            </Text>
          </CardHeader>
          <CardBody>
            <Flexbox direction="col" gap="3">
              <Text md className="text-text-secondary">
                The <code className="bg-bg-active px-1 rounded">cards/</code> directory contains CubeCobra's complete
                card database. These files power card search, autocomplete, and metadata display across the site.
              </Text>

              <Text semibold md className="mt-2">
                Key Files
              </Text>
              <ul className="list-disc list-inside space-y-2 text-text-secondary ml-4">
                <li>
                  <code className="bg-bg-active px-1 rounded">carddict.json</code> - Complete card database with all
                  card details (name, oracle text, types, colors, etc.)
                </li>
                <li>
                  <code className="bg-bg-active px-1 rounded">metadatadict.json</code> - Card statistics including ELO
                  ratings, pick counts, and cube inclusion rates
                </li>
                <li>
                  <code className="bg-bg-active px-1 rounded">indexToOracle.json</code> - Maps numeric indexes to Oracle
                  IDs (same mapping as export/indexToOracleMap.json)
                </li>
                <li>
                  <code className="bg-bg-active px-1 rounded">nameToId.json</code> and{' '}
                  <code className="bg-bg-active px-1 rounded">oracleToId.json</code> - Lookup tables for finding cards
                </li>
                <li>
                  <code className="bg-bg-active px-1 rounded">cardtree.json</code> - Prefix tree for fast autocomplete
                  search
                </li>
                <li>
                  <code className="bg-bg-active px-1 rounded">comboTree.json</code> - Card combo and synergy
                  relationships
                </li>
              </ul>

              <Text semibold md className="mt-2">
                Downloading
              </Text>
              <CodeBlock>aws s3 sync s3://cubecobra-public/cards/ ./cards/ --no-sign-request</CodeBlock>
            </Flexbox>
          </CardBody>
        </Card>

        {/* ML Model Files */}
        <Card>
          <CardHeader>
            <Text semibold lg>
              model/ - Machine Learning Models
            </Text>
          </CardHeader>
          <CardBody>
            <Flexbox direction="col" gap="3">
              <Text md className="text-text-secondary">
                The <code className="bg-bg-active px-1 rounded">model/</code> directory contains TensorFlow.js models
                trained on CubeCobra data. These power the site's recommendation and draft bot features.
              </Text>

              <Text semibold md className="mt-2">
                Available Models
              </Text>
              <ul className="list-disc list-inside space-y-2 text-text-secondary ml-4">
                <li>
                  <code className="bg-bg-active px-1 rounded">encoder/</code> - Shared encoder that converts a list of
                  cards into a latent vector representation
                </li>
                <li>
                  <code className="bg-bg-active px-1 rounded">cube_decoder/</code> - Given a cube's encoding, predicts
                  which cards fit the cube (used for add/cut recommendations)
                </li>
                <li>
                  <code className="bg-bg-active px-1 rounded">deck_build_decoder/</code> - Given a card pool, predicts
                  which cards should go in the main deck vs sideboard
                </li>
                <li>
                  <code className="bg-bg-active px-1 rounded">draft_decoder/</code> - Given a current pool, predicts
                  which card to pick from a pack
                </li>
              </ul>

              <Text semibold md className="mt-2">
                Model Format
              </Text>
              <Text sm className="text-text-secondary">
                Models are in TensorFlow.js GraphModel format. Each model directory contains a{' '}
                <code className="bg-bg-active px-1 rounded">model.json</code> manifest and binary weight files. The{' '}
                <code className="bg-bg-active px-1 rounded">indexToOracleMap.json</code> in the model directory maps the
                model's input/output indices to Oracle IDs.
              </Text>
              <CodeBlock>
                {`import { loadGraphModel, tensor } from '@tensorflow/tfjs';

// Load the encoder
const encoder = await loadGraphModel('file://model/encoder/model.json');

// Create input: one-hot vector of card indices
const input = new Array(numCards).fill(0);
cardIndices.forEach(i => input[i] = 1);

// Get the cube's latent representation
const encoded = encoder.predict(tensor([input]));`}
              </CodeBlock>

              <Text semibold md className="mt-2">
                Downloading
              </Text>
              <CodeBlock>aws s3 sync s3://cubecobra-public/model/ ./model/ --no-sign-request</CodeBlock>
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
                <li>
                  <span className="font-semibold">Card Database:</span> Use the{' '}
                  <code className="bg-bg-active px-1 rounded">cards/</code> data to build your own card search,
                  filtering, or display tools with up-to-date Oracle text and metadata.
                </li>
                <li>
                  <span className="font-semibold">Custom Recommenders:</span> Use the pre-trained ML models to build
                  your own cube recommendation tools, or fine-tune them on specific cube styles.
                </li>
                <li>
                  <span className="font-semibold">Draft Bots:</span> Build custom draft bots using the draft_decoder
                  model or train your own models on the picks data.
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
