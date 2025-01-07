import { Card, CardBody, CardHeader } from './base/Card';
import { Col, Flexbox, Row } from './base/Layout';
import Text from './base/Text';
import Deck from '../datatypes/Draft';
import DeckSeat from '../datatypes/DraftSeat';
import React, { useMemo } from 'react';

import CardGrid from './card/CardGrid';
import CommentsSection from './comments/CommentsSection';
import FoilCardImage from './FoilCardImage';
import Markdown from './Markdown';
import Username from './Username';
import CardType from '../datatypes/Card';
import { sortDeep } from 'utils/Sort';
import DecksPickBreakdown from './DecksPickBreakdown';

interface DeckStacksStaticProps {
  piles: number[][][];
  cards: any[];
}

const DeckStacksStatic: React.FC<DeckStacksStaticProps> = ({ piles, cards }) => (
  <CardBody className="pt-0 border-bottom">
    {piles.map((row, index) => (
      <Row key={index} xs={2} md={4} lg={8}>
        {row.map((column, index2) => (
          <Col key={index2} xs={1}>
            <div className="w-full text-center mb-1">
              <b>{column.length > 0 ? column.length : ''}</b>
            </div>
            <div className="stack">
              {column.map((cardIndex, index3) => {
                const card = cards[cardIndex];
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
        ))}
      </Row>
    ))}
  </CardBody>
);

interface DeckCardProps {
  seat: DeckSeat;
  view?: string;
  draft: Deck;
  seatIndex: string;
}

const DeckCard: React.FC<DeckCardProps> = ({ seat, draft, view = 'draft', seatIndex }) => {
  const stackedDeck = seat.mainboard.slice();
  const stackedSideboard = seat.sideboard.slice();
  let sbCount = 0;
  for (const col of stackedSideboard[0]) {
    sbCount += col.length;
  }
  if (sbCount <= 0) {
    stackedSideboard.splice(0, stackedSideboard.length);
  }
  // Cut off empty columns at the end.
  let lastFull;
  for (const row of stackedDeck) {
    for (lastFull = row.length - 1; lastFull >= 0; lastFull--) {
      if (row[lastFull] && row[lastFull].length > 0) {
        break;
      }
    }
    const startCut = lastFull + 1;
    row.splice(startCut, row.length - startCut);
  }

  let lastFullSB;
  for (const row of stackedSideboard) {
    for (lastFullSB = row.length - 1; lastFullSB >= 0; lastFullSB--) {
      if (row[lastFullSB] && row[lastFullSB].length > 0) {
        break;
      }
    }
    const startCut = lastFullSB + 1;
    row.splice(startCut, row.length - startCut);
  }

  const sorted = useMemo(() => {
    const deep = sortDeep(
      seat.mainboard.flat(3).map((cardIndex) => draft.cards[cardIndex]),
      true,
      'Unsorted',
      'Color Category',
      'Mana Value Full',
      'Unsorted',
    ) as [string, [string, [string, CardType[]][]][]][];

    return deep
      .map((tuple1) => tuple1[1].map((tuple2) => tuple2[1].map((tuple3) => tuple3[1].map((card) => card))))
      .flat(4);
  }, [draft.cards, seat.mainboard]);

  return (
    <Card>
      <CardHeader>
        <Flexbox direction="col" alignItems="start" gap="1">
          <Text semibold lg>
            {seat.name}
          </Text>
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
              {draft.seats[0].pickorder ? (
                <DecksPickBreakdown draft={draft} seatNumber={parseInt(seatIndex, 10)} />
              ) : (
                <p>There is no draft log associated with this draft.</p>
              )}
            </>
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
                  Sideboard
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
            Mainboard
          </Text>
          <CardGrid cards={sorted} xs={8} />
          {seat.sideboard.flat(2).length > 0 && (
            <>
              <hr className="my-4" />
              <Text semibold lg>
                Sideboard
              </Text>
              <CardGrid cards={seat.sideboard.flat(2).map((cardIndex) => draft.cards[cardIndex])} xs={8} />
            </>
          )}
        </CardBody>
      )}
      <CardBody>
        <Markdown markdown={seat.description} />
      </CardBody>
      <div className="border-top">
        <CommentsSection parentType="deck" parent={draft.id} collapse={false} />
      </div>
    </Card>
  );
};

export default DeckCard;
