import React, { useMemo } from 'react';

import CardType from '@utils/datatypes/Card';
import Deck from '@utils/datatypes/Draft';
import DeckSeat from '@utils/datatypes/DraftSeat';
import { sortDeep } from '@utils/sorting/Sort';

import { Card, CardBody, CardHeader } from './base/Card';
import { Col, Flexbox, Row } from './base/Layout';
import Text from './base/Text';
import CardGrid from './card/CardGrid';
import CommentsSection from './comments/CommentsSection';
import DecksPickBreakdown from './DecksPickBreakdown';
import FoilCardImage from './FoilCardImage';
import HousmanPickBreakdown from './HousmanPickBreakdown';
import Markdown from './Markdown';
import Username from './Username';

interface DeckStacksStaticProps {
  piles: number[][][];
  cards: any[];
  // Overrides the default card-body chrome (the all-decks view supplies its own).
  className?: string;
}

export const DeckStacksStatic: React.FC<DeckStacksStaticProps> = ({ piles, cards, className }) => (
  <CardBody className={className ?? 'pt-0 border-bottom'}>
    {/* Guard against malformed/legacy deck data (e.g. old Mongo-ID decks) whose
        mainboard/sideboard aren't the expected number[][][] — a mis-shaped row or
        column would otherwise throw `.map is not a function` and blank the page. */}
    {(Array.isArray(piles) ? piles : []).map((row, index) => (
      <Row key={index} xs={2} md={4} lg={8}>
        {(Array.isArray(row) ? row : []).map((column, index2) => {
          const col = Array.isArray(column) ? column : [];
          return (
            <Col key={index2} xs={1}>
              <div className="w-full text-center mb-1">
                <b>{col.length > 0 ? col.length : ''}</b>
              </div>
              <div className="stack">
                {col.map((cardIndex, index3) => {
                  const card = cards[cardIndex];
                  if (!card) return null;
                  return (
                    <div className="stacked" key={index3}>
                      <a href={card.cardID ? `/tool/card/${card.cardID}` : undefined}>
                        <FoilCardImage card={card} autocard />
                      </a>
                    </div>
                  );
                })}
              </div>
            </Col>
          );
        })}
      </Row>
    ))}
  </CardBody>
);

// Mainboard cards in display order: color category, then mana value.
const sortedDeckCards = (cards: CardType[]): CardType[] => {
  const deep = sortDeep(cards, true, 'Unsorted', 'Color Category', 'Mana Value Full', 'Unsorted') as [
    string,
    [string, [string, CardType[]][]][],
  ][];

  return deep
    .map((tuple1) => tuple1[1].map((tuple2) => tuple2[1].map((tuple3) => tuple3[1].map((card) => card))))
    .flat(4);
};

interface DeckCardProps {
  seat: DeckSeat;
  view?: string;
  draft: Deck;
  seatIndex: string;
  hideComments?: boolean;
}

// Coerce possibly-legacy/malformed board data into a clean number[][][] so the pile
// math and rendering below can't throw on unexpected shapes. Old Mongo-ID decks can
// store mainboard/sideboard at the wrong nesting depth; anything that isn't an array
// at a given level becomes an empty one rather than crashing the page.
const asPiles = (board: unknown): number[][][] =>
  (Array.isArray(board) ? board : []).map((row) =>
    (Array.isArray(row) ? row : []).map((col) => (Array.isArray(col) ? col : [])),
  );

// Drop the trailing empty columns of each row so a deck's stacks end where its cards
// do, instead of trailing off into eight empty mana-value slots.
const trimEmptyColumns = (piles: number[][][]): number[][][] =>
  piles.map((row) => {
    let lastFull = row.length - 1;
    for (; lastFull >= 0; lastFull--) {
      if (row[lastFull] && row[lastFull]!.length > 0) {
        break;
      }
    }
    return row.slice(0, lastFull + 1);
  });

// A board coerced and trimmed into the piles DeckStacksStatic renders. Exported so the
// all-decks view stacks a deck exactly the way the single-deck view does.
export const deckPiles = (board: unknown): number[][][] => trimEmptyColumns(asPiles(board));

const DeckCard: React.FC<DeckCardProps> = ({ seat, draft, view = 'draft', seatIndex, hideComments = false }) => {
  const hasSeat = !!seat;
  const mainboard = useMemo(() => asPiles(seat?.mainboard), [seat]);
  const sideboard = asPiles(seat?.sideboard);
  let sbCount = 0;
  for (const row of sideboard) {
    for (const col of row) {
      sbCount += col.length;
    }
  }
  const stackedDeck = trimEmptyColumns(mainboard);
  const stackedSideboard = sbCount > 0 ? trimEmptyColumns(sideboard) : [];

  const sorted = useMemo(
    () =>
      sortedDeckCards(
        mainboard
          .flat(3)
          .map((cardIndex) => draft.cards[cardIndex])
          .filter(Boolean),
      ),
    [draft.cards, mainboard],
  );

  const mbCount = sorted.length;

  if (!hasSeat) {
    return (
      <Card>
        <CardBody>
          <Text>This deck has no data for the selected seat.</Text>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <Flexbox direction="col" alignItems="start" gap="1">
          <Text semibold lg>
            {seat.title || seat.name} ({mbCount})
          </Text>
          {seat.title && seat.name && (
            <Text sm className="text-text-secondary">
              {seat.name}
            </Text>
          )}
          {!seat.bot && (
            <Text md semibold>
              Drafted by {seat.owner ? <Username user={seat.owner} /> : 'Anonymous'}
            </Text>
          )}
        </Flexbox>
      </CardHeader>
      {view === 'picks' && (
        <CardBody>
          {draft.type === 'd' ? (
            <>
              {draft.seats[0]?.pickorder ? (
                <DecksPickBreakdown draft={draft} seatNumber={parseInt(seatIndex, 10)} />
              ) : (
                <p>There is no draft log associated with this draft.</p>
              )}
            </>
          ) : draft.type === 'h' ? (
            <HousmanPickBreakdown draft={draft} seatNumber={parseInt(seatIndex, 10)} />
          ) : (
            <p>This type of draft does not have a pick breakdown yet.</p>
          )}
        </CardBody>
      )}
      {view === 'draft' && (
        <>
          <DeckStacksStatic piles={stackedDeck} cards={draft.cards} />
          {stackedSideboard && stackedSideboard.length > 0 && (
            <>
              <CardBody className="border-bottom">
                <Text semibold lg>
                  Sideboard ({sbCount})
                </Text>
              </CardBody>
              <DeckStacksStatic piles={stackedSideboard} cards={draft.cards} />
            </>
          )}
        </>
      )}
      {view === 'visual' && (
        <CardBody>
          <Text semibold lg>
            Mainboard ({mbCount})
          </Text>
          <CardGrid cards={sorted} xs={8} />
          {sideboard.flat(2).length > 0 && (
            <>
              <hr className="my-4" />
              <Text semibold lg>
                Sideboard ({sbCount})
              </Text>
              <CardGrid
                cards={sideboard
                  .flat(2)
                  .map((cardIndex) => draft.cards[cardIndex])
                  .filter(Boolean)}
                xs={8}
              />
            </>
          )}
        </CardBody>
      )}
      <CardBody>
        <Markdown markdown={seat.description} />
      </CardBody>
      {!hideComments && (
        <div className="border-top">
          <CommentsSection parentType="deck" parent={draft.id} collapse={false} />
        </div>
      )}
    </Card>
  );
};

export default DeckCard;
