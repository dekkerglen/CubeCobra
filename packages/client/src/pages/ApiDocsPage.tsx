import React, { useState } from 'react';

import { Card, CardBody, CardHeader } from 'components/base/Card';
import Container from 'components/base/Container';
import { Flexbox } from 'components/base/Layout';
import Link from 'components/base/Link';
import Text from 'components/base/Text';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';

/* ── Reusable formatting helpers ────────────────────────────────────── */

const CodeBlock: React.FC<{ children: string }> = ({ children }) => (
  <pre className="bg-bg-active text-text p-3 rounded font-mono text-sm overflow-x-auto border border-border whitespace-pre-wrap">
    {children}
  </pre>
);

const InlineCode: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <code className="bg-bg-active px-1 rounded text-sm font-mono">{children}</code>
);

const MethodBadge: React.FC<{ method: string }> = ({ method }) => {
  const colors: Record<string, string> = {
    GET: 'bg-green-700 text-white',
    POST: 'bg-blue-700 text-white',
    DELETE: 'bg-red-700 text-white',
  };
  return (
    <span className={`${colors[method] ?? 'bg-gray-600 text-white'} text-xs font-bold px-2 py-0.5 rounded font-mono`}>
      {method}
    </span>
  );
};

const Param: React.FC<{ name: string; type: string; required?: boolean; children: React.ReactNode }> = ({
  name,
  type,
  required,
  children,
}) => (
  <li className="ml-4">
    <InlineCode>{name}</InlineCode>{' '}
    <span className="text-text-secondary text-sm">
      ({type}
      {required && ', required'})
    </span>{' '}
    — <span className="text-text-secondary text-sm">{children}</span>
  </li>
);

/* ── Table of Contents ──────────────────────────────────────────────── */

interface TocEntry {
  id: string;
  label: string;
}

const tocSections: TocEntry[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'cube-json', label: 'Cube JSON Export' },
  { id: 'cube-downloads', label: 'Cube File Downloads' },
  { id: 'deck-downloads', label: 'Deck File Downloads' },
  { id: 'draft-bots', label: 'Draft Bots & ML' },
  { id: 'rss', label: 'RSS Feed' },
  { id: 'rate-limits', label: 'Rate Limits & Best Practices' },
  { id: 'bulk-data', label: 'Bulk Data Exports' },
];

const TableOfContents: React.FC = () => (
  <Card>
    <CardHeader>
      <Text semibold lg>
        Table of Contents
      </Text>
    </CardHeader>
    <CardBody>
      <ol className="list-decimal list-inside space-y-1 text-text-secondary">
        {tocSections.map((s) => (
          <li key={s.id}>
            <a href={`#${s.id}`} className="text-link hover:underline">
              {s.label}
            </a>
          </li>
        ))}
      </ol>
    </CardBody>
  </Card>
);

/* ── Endpoint Card ──────────────────────────────────────────────────── */

interface EndpointProps {
  method: string;
  path: string;
  description: string;
  auth?: boolean;
  cors?: boolean;
  rateLimit?: string;
  params?: React.ReactNode;
  returnType?: string;
  responseFormat?: string;
  responseExample?: string;
  notes?: React.ReactNode;
}

const Endpoint: React.FC<EndpointProps> = ({
  method,
  path,
  description,
  auth = false,
  cors = false,
  rateLimit,
  params,
  returnType,
  responseFormat,
  responseExample,
  notes,
}) => (
  <div className="border border-border rounded p-4 space-y-3">
    <Flexbox direction="row" gap="2" alignItems="center" className="flex-wrap">
      <MethodBadge method={method} />
      <code className="font-mono text-sm font-semibold break-all">{path}</code>
      {returnType && <span className="text-xs text-text-secondary font-mono ml-auto">→ {returnType}</span>}
    </Flexbox>
    <Text sm className="text-text-secondary">
      {description}
    </Text>

    {/* Tags — only show when there's something notable */}
    {(auth || cors || rateLimit || responseFormat) && (
      <Flexbox direction="row" gap="2" className="flex-wrap">
        {auth && <span className="text-xs bg-yellow-900 text-yellow-200 px-2 py-0.5 rounded">Auth Required</span>}
        {cors && <span className="text-xs bg-purple-900 text-purple-200 px-2 py-0.5 rounded">CORS Enabled</span>}
        {rateLimit && (
          <span className="text-xs bg-orange-900 text-orange-200 px-2 py-0.5 rounded">Rate: {rateLimit}</span>
        )}
        {responseFormat && (
          <span className="text-xs bg-bg-active text-text px-2 py-0.5 rounded border border-border">
            {responseFormat}
          </span>
        )}
      </Flexbox>
    )}

    {params && (
      <div>
        <Text semibold sm>
          Parameters
        </Text>
        <ul className="space-y-1 mt-1 text-sm">{params}</ul>
      </div>
    )}

    {responseExample && <CodeBlock>{responseExample}</CodeBlock>}

    {notes && <div className="text-sm text-text-secondary">{notes}</div>}
  </div>
);

/* ── Collapsible Section ────────────────────────────────────────────── */

const CollapsibleSection: React.FC<{
  id: string;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ id, title, defaultOpen = true, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div id={id}>
      <Card>
        <CardHeader className="cursor-pointer select-none" onClick={() => setOpen(!open)}>
          <Flexbox direction="row" justify="between" alignItems="center">
            <Text semibold lg>
              {title}
            </Text>
            <Text className="text-text-secondary">{open ? '▾' : '▸'}</Text>
          </Flexbox>
        </CardHeader>
        {open && <CardBody>{children}</CardBody>}
      </Card>
    </div>
  );
};

/* ── Main Page ──────────────────────────────────────────────────────── */

const ApiDocsPage: React.FC = () => (
  <MainLayout>
    <Container sm>
      <Flexbox direction="col" gap="4" className="my-4">
        {/* Header */}
        <Text semibold xxl className="text-center mb-1">
          API Documentation
        </Text>
        <Text md className="text-text-secondary text-center mb-2">
          Public endpoints for programmatic access to CubeCobra data. All endpoints are relative to{' '}
          <InlineCode>https://cubecobra.com</InlineCode>.
        </Text>

        <TableOfContents />

        {/* ─── Overview ──────────────────────────────────────────── */}
        <CollapsibleSection id="overview" title="Overview">
          <Flexbox direction="col" gap="3">
            <Text md className="text-text-secondary">
              CubeCobra provides a set of public API endpoints that allow you to programmatically access cube lists,
              card data, search results, and download cube/deck files in a variety of formats. These endpoints are
              designed for tool builders, bot developers, and anyone who wants to integrate CubeCobra data into their
              own applications.
            </Text>
            <Text md className="text-text-secondary">
              <span className="font-semibold">Key points:</span>
            </Text>
            <ul className="list-disc list-inside space-y-1 text-text-secondary ml-4 text-sm">
              <li>
                Most read-only endpoints require <span className="font-semibold">no authentication</span>.
              </li>
              <li>
                Endpoints marked <span className="font-semibold">CORS Enabled</span> set{' '}
                <InlineCode>Access-Control-Allow-Origin: *</InlineCode> and can be called directly from browser
                JavaScript on any domain.
              </li>
              <li>
                Rate limits apply to CORS-enabled endpoints. See the{' '}
                <a href="#rate-limits" className="text-link hover:underline">
                  Rate Limits
                </a>{' '}
                section for details.
              </li>
              <li>
                Cube identifiers (<InlineCode>:id</InlineCode>) accept either the cube's UUID or its short ID / custom
                slug.
              </li>
              <li>
                For large-scale data analysis, prefer the{' '}
                <a href="#bulk-data" className="text-link hover:underline">
                  Bulk Data Exports
                </a>{' '}
                over making many API calls.
              </li>
            </ul>
            <Text md className="text-text-secondary">
              Looking for bulk data downloads instead of live API access? See the{' '}
              <Link href="/tool/exports">Data Exports Guide</Link>.
            </Text>
          </Flexbox>
        </CollapsibleSection>

        {/* ─── Cube JSON Export ───────────────────────────────────── */}
        <CollapsibleSection id="cube-json" title="Cube JSON Export">
          <Flexbox direction="col" gap="4">
            <Text md className="text-text-secondary">
              The primary endpoint for fetching a complete cube as structured JSON data. This is the recommended
              endpoint for integrations that need the full cube card list with metadata.
            </Text>

            <Endpoint
              method="GET"
              path="/cube/api/cubeJSON/:id"
              returnType="CubeJSON"
              description="Returns the full cube object including all boards (mainboard, maybeboard, etc.) with every card&#39;s complete details (name, colors, type, CMC, image URLs, tags, and more)."
              cors
              rateLimit="100 req/min"
              responseFormat="application/json"
              params={
                <>
                  <Param name=":id" type="path" required>
                    Cube UUID or short ID / custom slug
                  </Param>
                </>
              }
              responseExample={`{
  "name": "My Vintage Cube",
  "shortId": "myvintagecube",
  "owner": "username",
  "description": "A powered vintage cube.",
  "image_uri": "https://...",
  "cards": {
    "mainboard": [
      {
        "name": "Black Lotus",
        "colors": ["C"],
        "type_line": "Artifact",
        "cmc": 0,
        "image_small": "https://...",
        "image_normal": "https://...",
        "tags": ["Power"],
        "board": "mainboard",
        ...
      },
      ...
    ],
    "maybeboard": [ ... ]
  },
  "maybe": [ ... ],
  "tag_colors": [ ... ],
  "default_sorts": ["Color Category", "Types-Multicolor", "Mana Value", "Alphabetical"]
}`}
              notes={
                <Text sm className="text-text-secondary">
                  Cards are sorted by the default sort (Color Category → Types-Multicolor → Mana Value → Alphabetical).
                  All boards are always returned regardless of cube visibility settings.
                </Text>
              }
            />

            <Endpoint
              method="GET"
              path="/cube/api/cubelist/:id"
              returnType="string"
              description="Returns just the mainboard card names as a newline-separated plain text list. Useful for quick imports into other tools."
              cors
              responseFormat="text/plain"
              params={
                <>
                  <Param name=":id" type="path" required>
                    Cube UUID or short ID
                  </Param>
                </>
              }
              responseExample={`Black Lotus
Ancestral Recall
Time Walk
Mox Sapphire
...`}
            />
          </Flexbox>
        </CollapsibleSection>

        {/* ─── Cube File Downloads ───────────────────────────────── */}
        <CollapsibleSection id="cube-downloads" title="Cube File Downloads">
          <Flexbox direction="col" gap="4">
            <Text md className="text-text-secondary">
              Download a cube's card list as a file in various formats. All endpoints return a downloadable file
              attachment. These are useful for importing cube lists into other applications like MTGO, Arena, Forge,
              XMage, or spreadsheets.
            </Text>

            <Text semibold md>
              Shared Query Parameters
            </Text>
            <Text sm className="text-text-secondary mb-2">
              All download endpoints support these optional query parameters to control which cards are exported and how
              they're organized:
            </Text>
            <ul className="space-y-1 text-sm mb-4">
              <Param name="allBoards" type="query">
                Set to <InlineCode>1</InlineCode> to export cards from all boards (mainboard, maybeboard, etc.)
              </Param>
              <Param name="boards" type="query">
                Comma-separated list of boards to include, e.g. <InlineCode>mainboard,maybeboard</InlineCode>
              </Param>
              <Param name="filter" type="query">
                A <Link href="/filters">filter expression</Link> to include only matching cards
              </Param>
              <Param name="primary" type="query">
                Primary sort column (e.g. <InlineCode>Color Category</InlineCode>)
              </Param>
              <Param name="secondary" type="query">
                Secondary sort column
              </Param>
              <Param name="tertiary" type="query">
                Tertiary sort column
              </Param>
              <Param name="quaternary" type="query">
                Quaternary sort column
              </Param>
              <Param name="showother" type="query">
                Set to <InlineCode>true</InlineCode> to include the "other" category in the export
              </Param>
            </ul>

            <Endpoint
              method="GET"
              path="/cube/download/csv/:id"
              returnType="File (.csv)"
              description="Comma-separated values with full card details including name, CMC, type, color, set, collector number, rarity, color category, status, finish, image URLs, tags, and notes."
              responseFormat="text/csv (.csv)"
              params={
                <>
                  <Param name=":id" type="path" required>
                    Cube UUID or short ID
                  </Param>
                </>
              }
              responseExample={`Name,CMC,Type,Color,Set,Collector Number,Rarity,Color Category,...
"Black Lotus",0,"Artifact","","VMA","4","Mythic","Colorless",...
"Ancestral Recall",1,"Instant","U","VMA","1","Mythic","Blue",...`}
            />

            <Endpoint
              method="GET"
              path="/cube/download/plaintext/:id"
              returnType="File (.txt)"
              description="Plain text with board headers (e.g. mainboard:, maybeboard:) followed by card names, one per line."
              responseFormat="text/plain (.txt)"
              params={
                <>
                  <Param name=":id" type="path" required>
                    Cube UUID or short ID
                  </Param>
                </>
              }
              responseExample={`mainboard:
Black Lotus
Ancestral Recall
Time Walk

maybeboard:
Mystic Remora`}
            />

            <Endpoint
              method="GET"
              path="/cube/download/cubecobra/:id"
              returnType="File (.txt)"
              description="CubeCobra native text format — just card names, one per line, with no headers or metadata."
              responseFormat="text/plain (.txt)"
              params={
                <>
                  <Param name=":id" type="path" required>
                    Cube UUID or short ID
                  </Param>
                </>
              }
              responseExample={`Black Lotus
Ancestral Recall
Time Walk`}
            />

            <Endpoint
              method="GET"
              path="/cube/download/mtgo/:id"
              returnType="File (.txt)"
              description="MTGO deck format compatible with Magic: The Gathering Online."
              responseFormat="text/plain (.txt)"
              params={
                <>
                  <Param name=":id" type="path" required>
                    Cube UUID or short ID
                  </Param>
                </>
              }
            />

            <Endpoint
              method="GET"
              path="/cube/download/forge/:id"
              returnType="File (.dck)"
              description="Forge deck format compatible with the Forge MTG client."
              responseFormat="text/plain (.dck)"
              params={
                <>
                  <Param name=":id" type="path" required>
                    Cube UUID or short ID
                  </Param>
                </>
              }
            />

            <Endpoint
              method="GET"
              path="/cube/download/xmage/:id"
              returnType="File (.dck)"
              description="XMage deck format compatible with the XMage MTG client."
              responseFormat="text/plain (.dck)"
              params={
                <>
                  <Param name=":id" type="path" required>
                    Cube UUID or short ID
                  </Param>
                </>
              }
            />
          </Flexbox>
        </CollapsibleSection>

        {/* ─── Deck Downloads ────────────────────────────────────── */}
        <CollapsibleSection id="deck-downloads" title="Deck File Downloads">
          <Flexbox direction="col" gap="4">
            <Text md className="text-text-secondary">
              Download a drafted deck in various formats. Requires the draft deck ID and the seat index (0-based) of the
              player whose deck you want.
            </Text>

            <Endpoint
              method="GET"
              path="/cube/deck/download/txt/:id/:seat"
              returnType="File (.txt)"
              description="Plain text deck list with mainboard and sideboard sections."
              responseFormat="text/plain (.txt)"
              params={
                <>
                  <Param name=":id" type="path" required>
                    Deck / draft ID
                  </Param>
                  <Param name=":seat" type="path" required>
                    Seat index (0-based)
                  </Param>
                </>
              }
              responseExample={`// Mainboard
1 Lightning Bolt
1 Counterspell
1 Tarmogoyf
...

// Sideboard
1 Pyroblast
1 Blue Elemental Blast`}
            />

            <Endpoint
              method="GET"
              path="/cube/deck/download/arena/:id/:seat"
              returnType="File (.txt)"
              description="MTG Arena format compatible with Arena's deck import."
              responseFormat="text/plain (.txt)"
              params={
                <>
                  <Param name=":id" type="path" required>
                    Deck / draft ID
                  </Param>
                  <Param name=":seat" type="path" required>
                    Seat index (0-based)
                  </Param>
                </>
              }
            />

            <Endpoint
              method="GET"
              path="/cube/deck/download/mtgo/:id/:seat"
              returnType="File (.txt)"
              description="MTGO deck format."
              responseFormat="text/plain (.txt)"
              params={
                <>
                  <Param name=":id" type="path" required>
                    Deck / draft ID
                  </Param>
                  <Param name=":seat" type="path" required>
                    Seat index (0-based)
                  </Param>
                </>
              }
            />

            <Endpoint
              method="GET"
              path="/cube/deck/download/xmage/:id/:seat"
              returnType="File (.dck)"
              description="XMage deck format."
              responseFormat="text/plain (.dck)"
              params={
                <>
                  <Param name=":id" type="path" required>
                    Deck / draft ID
                  </Param>
                  <Param name=":seat" type="path" required>
                    Seat index (0-based)
                  </Param>
                </>
              }
            />

            <Endpoint
              method="GET"
              path="/cube/deck/download/forge/:id/:seat"
              returnType="File (.dck)"
              description="Forge deck format."
              responseFormat="text/plain (.dck)"
              params={
                <>
                  <Param name=":id" type="path" required>
                    Deck / draft ID
                  </Param>
                  <Param name=":seat" type="path" required>
                    Seat index (0-based)
                  </Param>
                </>
              }
            />

            <Endpoint
              method="GET"
              path="/cube/deck/download/cockatrice/:id/:seat"
              returnType="File (.cod)"
              description="Cockatrice deck format (XML-based)."
              responseFormat="text/xml (.cod)"
              params={
                <>
                  <Param name=":id" type="path" required>
                    Deck / draft ID
                  </Param>
                  <Param name=":seat" type="path" required>
                    Seat index (0-based)
                  </Param>
                </>
              }
            />

            <Endpoint
              method="GET"
              path="/cube/deck/download/topdecked/:id/:seat"
              returnType="File (.csv)"
              description="TopDecked CSV format."
              responseFormat="text/csv (.csv)"
              params={
                <>
                  <Param name=":id" type="path" required>
                    Deck / draft ID
                  </Param>
                  <Param name=":seat" type="path" required>
                    Seat index (0-based)
                  </Param>
                </>
              }
            />
          </Flexbox>
        </CollapsibleSection>

        {/* ─── Draft Bots & ML ───────────────────────────────────── */}
        <CollapsibleSection id="draft-bots" title="Draft Bots & ML">
          <Flexbox direction="col" gap="4">
            <Text md className="text-text-secondary">
              Machine learning endpoints for draft pick prediction, deck building, and card recommendations. These power
              CubeCobra's draft bots, "Recommended Adds/Cuts", and the AI deckbuilder.
            </Text>

            <Endpoint
              method="POST"
              path="/api/draftbots/predict/"
              returnType="{ prediction }"
              description="Given a pack and current picks, predict which card the ML model would pick. Returns a score/probability for each card in the pack."
              responseFormat="application/json"
              params={
                <>
                  <Param name="pack" type="body" required>
                    Array of Oracle IDs representing the current pack
                  </Param>
                  <Param name="picks" type="body" required>
                    Array of Oracle IDs already picked
                  </Param>
                </>
              }
              responseExample={`{ "prediction": [0.85, 0.12, 0.03, ...] }`}
              notes={
                <Text sm className="text-text-secondary">
                  The prediction array has one score per card in the pack, in the same order. Higher scores indicate the
                  model's preference.
                </Text>
              }
            />

            <Endpoint
              method="POST"
              path="/api/draftbots/batchpredict/"
              returnType="{ prediction }"
              description="Batch version of predict — submit up to 20 pack/picks pairs at once."
              responseFormat="application/json"
              params={
                <>
                  <Param name="inputs" type="body" required>
                    Array (max 20) of <InlineCode>{'{ pack: [...], picks: [...] }'}</InlineCode> objects
                  </Param>
                </>
              }
              responseExample={`{ "prediction": [ [0.85, 0.12, ...], [0.42, 0.55, ...], ... ] }`}
            />

            <Endpoint
              method="POST"
              path="/cube/api/adds"
              returnType="{ adds, hasMoreAdds }"
              description="Get AI-recommended cards to add to a cube."
              responseFormat="application/json"
              params={
                <>
                  <Param name="cubeID" type="body" required>
                    Cube UUID or short ID
                  </Param>
                  <Param name="filterText" type="body">
                    Filter expression to constrain suggestions
                  </Param>
                  <Param name="printingPreference" type="body">
                    Preferred printing style
                  </Param>
                  <Param name="skip" type="body">
                    Number of results to skip (pagination)
                  </Param>
                  <Param name="limit" type="body">
                    Max results to return
                  </Param>
                </>
              }
              responseExample={`{ "adds": [ { "name": "...", ... }, ... ], "hasMoreAdds": true }`}
            />

            <Endpoint
              method="POST"
              path="/cube/api/cuts"
              returnType="{ cuts }"
              description="Get AI-recommended cards to cut from a cube."
              responseFormat="application/json"
              params={
                <>
                  <Param name="cubeID" type="body" required>
                    Cube UUID or short ID
                  </Param>
                  <Param name="filterText" type="body">
                    Filter expression
                  </Param>
                  <Param name="printingPreference" type="body">
                    Preferred printing style
                  </Param>
                </>
              }
              responseExample={`{ "cuts": [ { "name": "...", ... }, ... ] }`}
            />

            <Endpoint
              method="POST"
              path="/cube/api/deckbuild"
              returnType="{ mainboard, sideboard }"
              description="AI deck builder — given a pool of cards and basic lands, build a main deck and sideboard."
              responseFormat="application/json"
              params={
                <>
                  <Param name="pool" type="body" required>
                    Array of card objects in the pool
                  </Param>
                  <Param name="basics" type="body" required>
                    Array of available basic land IDs
                  </Param>
                  <Param name="maxSpells" type="body">
                    Maximum non-land cards (default: 23)
                  </Param>
                  <Param name="maxLands" type="body">
                    Maximum lands (default: 17)
                  </Param>
                </>
              }
              responseExample={`{
  "mainboard": [ ... ],
  "sideboard": [ ... ]
}`}
            />

            <Endpoint
              method="POST"
              path="/cube/api/calculatebasics"
              returnType="{ basics }"
              description="Calculate the optimal basic land distribution for a deck."
              responseFormat="application/json"
              params={
                <>
                  <Param name="mainboard" type="body" required>
                    Array of non-land cards in the mainboard
                  </Param>
                  <Param name="basics" type="body" required>
                    Array of available basic land IDs
                  </Param>
                </>
              }
              responseExample={`{ "basics": [4, 4, 3, 3, 3] }`}
            />

            <Endpoint
              method="POST"
              path="/cube/api/getcombos/"
              returnType="{ combos }"
              description="Get known card combos involving a set of cards."
              responseFormat="application/json"
              params={
                <>
                  <Param name="oracles" type="body" required>
                    Array of Oracle IDs
                  </Param>
                </>
              }
              responseExample={`{ "combos": [ { "cards": [...], "description": "..." }, ... ] }`}
            />
          </Flexbox>
        </CollapsibleSection>

        {/* ─── RSS Feed ──────────────────────────────────────────── */}
        <CollapsibleSection id="rss" title="RSS Feed">
          <Flexbox direction="col" gap="4">
            <Text md className="text-text-secondary">
              Subscribe to cube updates via RSS. The feed includes blog posts and changelog entries for a cube.
            </Text>

            <Endpoint
              method="GET"
              path="/cube/rss/:id"
              returnType="XML (RSS 2.0)"
              description="RSS 2.0 feed for a cube's blog posts. Compatible with all standard RSS readers."
              responseFormat="text/xml (RSS 2.0)"
              params={
                <>
                  <Param name=":id" type="path" required>
                    Cube UUID or short ID
                  </Param>
                </>
              }
              responseExample={`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>My Vintage Cube - Cube Cobra</title>
    <link>https://cubecobra.com/cube/about/myvintagecube</link>
    <description>...</description>
    <item>
      <title>Blog Post Title</title>
      <description>Post content...</description>
      <link>https://cubecobra.com/cube/blog/blogpost/...</link>
      <pubDate>Sat, 15 Mar 2025 12:00:00 GMT</pubDate>
    </item>
    ...
  </channel>
</rss>`}
            />
          </Flexbox>
        </CollapsibleSection>

        {/* ─── Rate Limits & Best Practices ──────────────────────── */}
        <CollapsibleSection id="rate-limits" title="Rate Limits & Best Practices">
          <Flexbox direction="col" gap="3">
            <Text md className="text-text-secondary">
              CubeCobra's public API is free to use, but please be responsible with your usage so the service remains
              available for everyone.
            </Text>

            <Text semibold md>
              Rate Limits
            </Text>
            <ul className="list-disc list-inside space-y-1 text-text-secondary ml-4 text-sm">
              <li>
                CORS-enabled endpoints (<InlineCode>/cube/api/cubeJSON/:id</InlineCode>,{' '}
                <InlineCode>/public/cube/history/:id</InlineCode>) are rate limited to{' '}
                <span className="font-semibold">100 requests per minute</span> per IP address.
              </li>
              <li>Other endpoints do not have explicit rate limits but excessive usage may result in throttling.</li>
              <li>If you receive a 429 (Too Many Requests) response, back off and retry after a delay.</li>
            </ul>

            <Text semibold md className="mt-2">
              Best Practices
            </Text>
            <ul className="list-disc list-inside space-y-1 text-text-secondary ml-4 text-sm">
              <li>
                <span className="font-semibold">Cache responses.</span> Cube data doesn't change frequently — cache
                results for at least a few minutes.
              </li>
              <li>
                <span className="font-semibold">Use bulk endpoints.</span> Prefer batch endpoints (e.g.{' '}
                <InlineCode>POST /cube/api/getversions</InlineCode>) over making many individual requests.
              </li>
              <li>
                <span className="font-semibold">Use bulk data exports for analysis.</span> If you need data for many
                cubes, download the <Link href="/tool/exports">bulk data exports</Link> instead of hitting the API for
                each cube.
              </li>
              <li>
                <span className="font-semibold">Include a User-Agent header</span> identifying your application so we
                can reach out if there are issues.
              </li>
              <li>
                <span className="font-semibold">Respect robots.txt.</span> If scraping pages, respect the robots.txt
                file.
              </li>
            </ul>

            <Text semibold md className="mt-2">
              Example Request (cURL)
            </Text>
            <CodeBlock>
              {`# Fetch a cube as JSON
curl -H "User-Agent: MyApp/1.0" \\
  "https://cubecobra.com/cube/api/cubeJSON/myvintagecube"

# Download a cube as CSV
curl -o cube.csv \\
  "https://cubecobra.com/cube/download/csv/myvintagecube"

# Search for cards
curl "https://cubecobra.com/tool/api/searchcards/?f=cmc%3D1+t%3Acreature&s=Elo&d=desc&p=0"

# Draft bot prediction
curl -X POST \\
  -H "Content-Type: application/json" \\
  -d '{"pack":["oracle-id-1","oracle-id-2"],"picks":["oracle-id-3"]}' \\
  "https://cubecobra.com/api/draftbots/predict/"`}
            </CodeBlock>

            <Text semibold md className="mt-2">
              Example Request (JavaScript)
            </Text>
            <CodeBlock>
              {`// Fetch a cube as JSON
const response = await fetch('https://cubecobra.com/cube/api/cubeJSON/myvintagecube');
const cube = await response.json();
console.log(cube.name, cube.cards.mainboard.length + ' cards');

// Search for top-rated red creatures
const search = await fetch(
  'https://cubecobra.com/tool/api/searchcards/?f=c%3Dr+t%3Acreature&s=Elo&d=desc&p=0'
);
const results = await search.json();
console.log(results.numResults + ' results found');`}
            </CodeBlock>

            <Text semibold md className="mt-2">
              Example Request (Python)
            </Text>
            <CodeBlock>
              {`import requests

# Fetch a cube as JSON
response = requests.get(
    'https://cubecobra.com/cube/api/cubeJSON/myvintagecube',
    headers={'User-Agent': 'MyApp/1.0'}
)
cube = response.json()
print(f"{cube['name']}: {len(cube['cards']['mainboard'])} cards")

# Download a cube as CSV
csv_response = requests.get('https://cubecobra.com/cube/download/csv/myvintagecube')
with open('cube.csv', 'w') as f:
    f.write(csv_response.text)`}
            </CodeBlock>
          </Flexbox>
        </CollapsibleSection>

        {/* ─── Bulk Data Exports ─────────────────────────────────── */}
        <CollapsibleSection id="bulk-data" title="Bulk Data Exports">
          <Flexbox direction="col" gap="3">
            <Text md className="text-text-secondary">
              For large-scale analysis, CubeCobra publishes a complete data export to a public S3 bucket, updated
              quarterly. This includes all public cube lists, draft picks, drafted decks, card metadata, and pre-trained
              ML models.
            </Text>
            <Text md className="text-text-secondary">
              If you need data across many cubes, this is significantly more efficient than making individual API calls.
            </Text>
            <CodeBlock>aws s3 sync s3://cubecobra-public/export/ ./data/ --no-sign-request</CodeBlock>
            <Text md className="text-text-secondary">
              For complete documentation of the export format, file structure, and how to work with the data, see the{' '}
              <Link href="/tool/exports">Data Exports Guide</Link>.
            </Text>
          </Flexbox>
        </CollapsibleSection>

        {/* ─── Footer ────────────────────────────────────────────── */}
        <Card>
          <CardBody>
            <Flexbox direction="col" gap="2" alignItems="center">
              <Text sm className="text-text-secondary text-center">
                Have questions or building something cool? Reach out on{' '}
                <Link href="https://discord.gg/YYF9x65Ane" target="_blank" rel="noopener noreferrer">
                  Discord
                </Link>{' '}
                or open an issue on{' '}
                <Link href="https://github.com/dekkerglen/CubeCobra" target="_blank" rel="noopener noreferrer">
                  GitHub
                </Link>
                .
              </Text>
            </Flexbox>
          </CardBody>
        </Card>
      </Flexbox>
    </Container>
  </MainLayout>
);

export default RenderToRoot(ApiDocsPage);
